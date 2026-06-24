import { ipcMain, app } from 'electron';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import fsSync from 'fs';
import { execFile } from 'child_process';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory, getSetting } from '../db';
import crypto from 'crypto';
import { createWorker } from 'tesseract.js';
import path from 'path';
import { getGhostscriptPath, getTesseractDataPath } from '../utils/binResolver';

export function registerOptimizeHandlers() {
  // COMPRESS
  ipcMain.handle(
    'tool:compress',
    async (_event, filePath: string, outputPath: string, level: 'extreme' | 'recommended' | 'low') => {
      const check = checkToolAccess('compress');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));

        // Map settings level
        let settingsArg = '/screen'; // recommended
        if (level === 'extreme') settingsArg = '/ebook';
        if (level === 'low') settingsArg = '/printer';

        const runGhostscript = () => {
          return new Promise<void>((resolve, reject) => {
            const args = [
              '-sDEVICE=pdfwrite',
              '-dCompatibilityLevel=1.4',
              `-dPDFSETTINGS=${settingsArg}`,
              '-dNOPAUSE',
              '-dQUIET',
              '-dBATCH',
              `-sOutputFile=${outputPath}`,
              filePath,
            ];
            execFile(gsPath, args, (error) => {
              if (error) {
                if (!fsSync.existsSync(gsPath)) {
                  reject(new Error(`Ghostscript binary not found at "${gsPath}". Please install Ghostscript on your system or verify the path in Settings > Advanced.`));
                } else {
                  reject(new Error(`Ghostscript compression failed: ${error.message}`));
                }
              }
              else resolve();
            });
          });
        };

        try {
          await runGhostscript();
        } catch {
          // Fallback to pdf-lib internal compression
          const pdfBytes = await fs.readFile(filePath);
          const doc = await PDFDocument.load(pdfBytes);
          const compressedBytes = await doc.save({
            useObjectStreams: true,
          });
          await fs.writeFile(outputPath, compressedBytes);
        }

        const stats = await fs.stat(outputPath);
        saveHistory({
          id: historyId,
          tool_name: 'Compress PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath, size: stats.size };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Compress PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // REPAIR
  ipcMain.handle('tool:repair', async (_event, filePath: string, outputPath: string) => {
    const check = checkToolAccess('repair');
    if (!check.allowed) throw new Error(check.reason);

    const limit = checkBatchLimits([filePath]);
    if (!limit.allowed) throw new Error(limit.reason);

    const historyId = crypto.randomUUID();
    try {
      const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));

      const runGhostscriptRepair = () => {
        return new Promise<void>((resolve, reject) => {
          const args = ['-o', outputPath, '-sDEVICE=pdfwrite', filePath];
          execFile(gsPath, args, (error) => {
            if (error) {
              if (!fsSync.existsSync(gsPath)) {
                reject(new Error(`Ghostscript binary not found at "${gsPath}". Please install Ghostscript on your system or verify the path in Settings > Advanced.`));
              } else {
                reject(new Error(`Ghostscript repair failed: ${error.message}`));
              }
            }
            else resolve();
          });
        });
      };

      try {
        await runGhostscriptRepair();
      } catch {
        // Fallback: load and save using pdf-lib which rebuilds cross-references
        const pdfBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const savedBytes = await doc.save();
        await fs.writeFile(outputPath, savedBytes);
      }

      const stats = await fs.stat(outputPath);
      saveHistory({
        id: historyId,
        tool_name: 'Repair PDF',
        input_files: [filePath],
        output_file: outputPath,
        status: 'SUCCESS'
      });

      return { success: true, outputPath, size: stats.size };
    } catch (error: any) {
      saveHistory({
        id: historyId,
        tool_name: 'Repair PDF',
        input_files: [filePath],
        output_file: outputPath,
        status: 'FAILED',
        error_message: error.message
      });
      throw error;
    }
  });

  // OCR (using offline Tesseract worker)
  ipcMain.handle(
    'tool:ocr',
    async (
      event,
      filePath: string,
      outputPath: string,
      language = 'eng'
    ) => {
      const check = checkToolAccess('ocr');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const tessDataPath = getTesseractDataPath(getSetting('tesseract_data_path', ''));

        if (!fsSync.existsSync(tessDataPath)) {
          throw new Error(`Tesseract traineddata folder not found at "${tessDataPath}". Please make sure it is configured correctly in Settings > Advanced.`);
        }

        event.sender.send('ocr:progress', { status: 'initializing', progress: 0.1 });

        const resolvedWorkerPath = path.join(app.getAppPath(), 'node_modules/tesseract.js/src/worker-script/node/index.js');
        const worker = await createWorker(language, 1, {
          workerPath: resolvedWorkerPath,
          cachePath: tessDataPath,
          gzip: false,
          logger: (m) => {
            if (m.status === 'recognizing text') {
              // Standard single-image recognition progress
              event.sender.send('ocr:progress', {
                status: 'recognizing',
                progress: 0.2 + m.progress * 0.8
              });
            }
          }
        });

        const pdfDoc = await PDFDocument.create();
        const isPdf = filePath.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));
          const tempDir = path.join(app.getPath('temp'), `pdf-ocr-${Date.now()}`);
          await fs.mkdir(tempDir, { recursive: true });

          const renderPdfPages = () => {
            return new Promise<void>((resolve, reject) => {
              const args = [
                '-dNOPAUSE',
                '-dBATCH',
                '-sDEVICE=jpeg',
                '-r150',
                `-sOutputFile=${path.join(tempDir, 'page-%d.jpg')}`,
                filePath,
              ];
              execFile(gsPath, args, (error) => {
                if (error) {
                  reject(new Error(`Failed to render PDF pages using Ghostscript: ${error.message}`));
                } else {
                  resolve();
                }
              });
            });
          };

          await renderPdfPages();

          // Read the temporary files
          const filesInTemp = await fs.readdir(tempDir);
          const pageImages = filesInTemp
            .filter((f) => f.startsWith('page-') && f.endsWith('.jpg'))
            .sort((a, b) => {
              const numA = parseInt(a.replace('page-', '').replace('.jpg', '')) || 0;
              const numB = parseInt(b.replace('page-', '').replace('.jpg', '')) || 0;
              return numA - numB;
            });

          if (pageImages.length === 0) {
            throw new Error('Ghostscript did not output any pages. The PDF might be empty or corrupted.');
          }

          // Process each page
          for (let i = 0; i < pageImages.length; i++) {
            const imgName = pageImages[i];
            const imgPath = path.join(tempDir, imgName);

            event.sender.send('ocr:progress', {
              status: `processing page ${i + 1} of ${pageImages.length}`,
              progress: 0.2 + (i / pageImages.length) * 0.7
            });

            const { data: { text } } = await worker.recognize(imgPath);
            
            // Draw page text to PDF
            const page = pdfDoc.addPage();
            page.drawText(text, {
              x: 50,
              y: page.getHeight() - 50,
              size: 11,
              maxWidth: page.getWidth() - 100
            });

            // Clean up image file
            await fs.unlink(imgPath).catch(() => {});
          }

          // Clean up directory
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        } else {
          // Standard image file (PNG, JPG)
          const { data: { text } } = await worker.recognize(filePath);
          
          const page = pdfDoc.addPage();
          page.drawText(text, {
            x: 50,
            y: page.getHeight() - 50,
            size: 11,
            maxWidth: page.getWidth() - 100
          });
        }

        await worker.terminate();

        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(outputPath, pdfBytes);

        saveHistory({
          id: historyId,
          tool_name: 'OCR PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        event.sender.send('ocr:progress', { status: 'done', progress: 1.0 });
        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'OCR PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // OCR a set of page images and return the recognized text per image.
  // Used as a fallback for PDF -> Word/Excel when the PDF has no text layer.
  ipcMain.handle(
    'tool:ocr-image-texts',
    async (event, images: string[], language = 'eng') => {
      const tessDataPath = getTesseractDataPath(getSetting('tesseract_data_path', ''));
      if (!fsSync.existsSync(tessDataPath)) {
        throw new Error(`Tesseract traineddata folder not found at "${tessDataPath}". Please make sure it is configured correctly in Settings > Advanced.`);
      }

      const resolvedWorkerPath = path.join(app.getAppPath(), 'node_modules/tesseract.js/src/worker-script/node/index.js');
      const worker = await createWorker(language, 1, {
        workerPath: resolvedWorkerPath,
        cachePath: tessDataPath,
        gzip: false,
      });

      try {
        const texts: string[] = [];
        for (let i = 0; i < images.length; i++) {
          event.sender.send('ocr:progress', {
            status: `Recognizing page ${i + 1} of ${images.length}`,
            progress: (i + 1) / images.length,
          });
          const buffer = Buffer.from(images[i], 'base64');
          const { data: { text } } = await worker.recognize(buffer);
          texts.push(text);
        }
        return texts;
      } finally {
        await worker.terminate();
      }
    }
  );
}
