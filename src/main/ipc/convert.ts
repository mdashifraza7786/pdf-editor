import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory, getSetting } from '../db';
import crypto from 'crypto';
import { getLibreOfficePath, getGhostscriptPath } from '../utils/binResolver';
import { PDFDocument } from 'pdf-lib';

export function registerConvertHandlers() {
  // Office conversions to PDF (Word/PPTX/Excel/HTML -> PDF)
  ipcMain.handle(
    'tool:office-to-pdf',
    async (_event, filePath: string, outputFolder: string) => {
      const check = checkToolAccess('jpg2pdf'); // grouped under conversions
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const loPath = getLibreOfficePath(getSetting('libreoffice_path', ''));

        const runLibreOffice = () => {
          return new Promise<string>((resolve, reject) => {
            const cmd = `"${loPath}" --headless --convert-to pdf --outdir "${outputFolder}" "${filePath}"`;
            exec(cmd, (error) => {
              if (error) {
                if (!fsSync.existsSync(loPath)) {
                  reject(new Error(`LibreOffice soffice binary not found at "${loPath}". Please install LibreOffice or verify the path in Settings > Advanced.`));
                } else {
                  reject(new Error(`LibreOffice execution failed: ${error.message}`));
                }
              } else {
                const baseName = path.basename(filePath, path.extname(filePath));
                const expectedOut = path.join(outputFolder, `${baseName}.pdf`);
                resolve(expectedOut);
              }
            });
          });
        };

        const resultPath = await runLibreOffice();

        saveHistory({
          id: historyId,
          tool_name: 'Office to PDF',
          input_files: [filePath],
          output_file: resultPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath: resultPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Office to PDF',
          input_files: [filePath],
          output_file: outputFolder,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // PDF to JPG helper: frontend renders PDF pages to images and sends them to main process to save
  ipcMain.handle(
    'tool:save-rendered-pages',
    async (
      _event,
      pdfPath: string,
      pages: { pageNumber: number; base64Data: string }[],
      outputFolder: string
    ) => {
      const check = checkToolAccess('pdf2jpg');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([pdfPath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      const outputFiles: string[] = [];
      try {
        const baseName = path.basename(pdfPath, '.pdf');

        for (const page of pages) {
          const buffer = Buffer.from(page.base64Data, 'base64');
          const fileName = `${baseName}_page_${page.pageNumber}.jpg`;
          const filePath = path.join(outputFolder, fileName);
          await fs.writeFile(filePath, buffer);
          outputFiles.push(filePath);
        }

        saveHistory({
          id: historyId,
          tool_name: 'PDF to JPG',
          input_files: [pdfPath],
          output_file: outputFolder,
          status: 'SUCCESS'
        });

        return { success: true, outputFiles };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'PDF to JPG',
          input_files: [pdfPath],
          output_file: outputFolder,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // JPG/PNG to PDF compiler
  ipcMain.handle(
    'tool:jpg-to-pdf',
    async (
      _event,
      imagePaths: string[],
      outputPath: string,
      options: {
        orientation: 'portrait' | 'landscape';
        pageSize: 'a4' | 'letter' | 'fit';
        margin: 'none' | 'small' | 'large';
      }
    ) => {
      const check = checkToolAccess('jpg2pdf');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits(imagePaths);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const pdfDoc = await PDFDocument.create();

        for (const imgPath of imagePaths) {
          const imgBytes = await fs.readFile(imgPath);
          let image;
          if (imgPath.toLowerCase().endsWith('.png')) {
            image = await pdfDoc.embedPng(imgBytes);
          } else {
            image = await pdfDoc.embedJpg(imgBytes);
          }

          // Page size and layout
          let pageW = image.width;
          let pageH = image.height;

          if (options.pageSize === 'a4') {
            pageW = 595.28; // standard A4 points
            pageH = 841.89;
          } else if (options.pageSize === 'letter') {
            pageW = 612;
            pageH = 792;
          }

          if (options.orientation === 'landscape' && options.pageSize !== 'fit') {
            // swap width & height
            const temp = pageW;
            pageW = pageH;
            pageH = temp;
          }

          const page = pdfDoc.addPage([pageW, pageH]);

          // Margins in points
          let m = 0;
          if (options.margin === 'small') m = 20;
          else if (options.margin === 'large') m = 40;

          // Fit image to page dimensions within margins
          const fitW = pageW - m * 2;
          const fitH = pageH - m * 2;

          const ratio = Math.min(fitW / image.width, fitH / image.height);
          const drawW = image.width * ratio;
          const drawH = image.height * ratio;

          // Centered drawing
          const drawX = m + (fitW - drawW) / 2;
          const drawY = m + (fitH - drawH) / 2;

          page.drawImage(image, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        }

        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(outputPath, pdfBytes);

        saveHistory({
          id: historyId,
          tool_name: 'JPG to PDF',
          input_files: imagePaths,
          output_file: outputPath,
          status: 'SUCCESS',
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'JPG to PDF',
          input_files: imagePaths,
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message,
        });
        throw error;
      }
    }
  );

  // PDF to Office (Word / PowerPoint / Excel) via headless LibreOffice reverse conversion
  ipcMain.handle(
    'tool:pdf-to-office',
    async (
      _event,
      filePath: string,
      outputFolder: string,
      target: 'word' | 'powerpoint' | 'excel'
    ) => {
      const check = checkToolAccess('pdf2office');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      // Map target to LibreOffice output extension/filter
      const targetMap: Record<string, { ext: string; filter: string; label: string }> = {
        word: { ext: 'docx', filter: 'docx:MS Word 2007 XML', label: 'PDF to Word' },
        powerpoint: { ext: 'pptx', filter: 'pptx:Impress MS PowerPoint 2007 XML', label: 'PDF to PowerPoint' },
        excel: { ext: 'xlsx', filter: 'xlsx:Calc MS Excel 2007 XML', label: 'PDF to Excel' },
      };
      const conf = targetMap[target];
      if (!conf) throw new Error(`Unsupported conversion target: ${target}`);

      const historyId = crypto.randomUUID();
      try {
        const loPath = getLibreOfficePath(getSetting('libreoffice_path', ''));

        const runLibreOffice = () => {
          return new Promise<string>((resolve, reject) => {
            const args = [
              '--headless',
              '--infilter=writer_pdf_import',
              '--convert-to',
              conf.filter,
              '--outdir',
              outputFolder,
              filePath,
            ];
            execFile(loPath, args, (error, stdout, stderr) => {
              if (error) {
                if (!fsSync.existsSync(loPath)) {
                  reject(new Error(`LibreOffice soffice binary not found at "${loPath}". Please install LibreOffice or verify the path in Settings > Advanced.`));
                } else {
                  reject(new Error(`LibreOffice conversion failed: ${stderr || error.message}`));
                }
              } else {
                const baseName = path.basename(filePath, path.extname(filePath));
                const expectedOut = path.join(outputFolder, `${baseName}.${conf.ext}`);
                resolve(expectedOut);
              }
            });
          });
        };

        const resultPath = await runLibreOffice();

        if (!fsSync.existsSync(resultPath)) {
          throw new Error('Conversion completed but the output file could not be located. The PDF may be image-only or unsupported for reverse conversion.');
        }

        saveHistory({
          id: historyId,
          tool_name: conf.label,
          input_files: [filePath],
          output_file: resultPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath: resultPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: conf.label,
          input_files: [filePath],
          output_file: outputFolder,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // PDF to PDF/A (archival format) via Ghostscript
  ipcMain.handle(
    'tool:pdf-to-pdfa',
    async (_event, filePath: string, outputPath: string) => {
      const check = checkToolAccess('pdfa');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const gsPath = getGhostscriptPath(getSetting('ghostscript_path', ''));

        const runGhostscript = () => {
          return new Promise<void>((resolve, reject) => {
            const args = [
              '-dPDFA=2',
              '-dBATCH',
              '-dNOPAUSE',
              '-dQUIET',
              '-sColorConversionStrategy=UseDeviceIndependentColor',
              '-sDEVICE=pdfwrite',
              '-dPDFACompatibilityPolicy=1',
              `-sOutputFile=${outputPath}`,
              filePath,
            ];
            execFile(gsPath, args, (error, _stdout, stderr) => {
              if (error) {
                if (!fsSync.existsSync(gsPath)) {
                  reject(new Error(`Ghostscript binary not found at "${gsPath}". Please install Ghostscript or verify the path in Settings > Advanced.`));
                } else {
                  reject(new Error(`PDF/A conversion failed: ${stderr || error.message}`));
                }
              } else {
                resolve();
              }
            });
          });
        };

        await runGhostscript();

        saveHistory({
          id: historyId,
          tool_name: 'PDF to PDF/A',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'PDF to PDF/A',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // HTML to PDF using Electron's offscreen renderer (fully offline, no external binary)
  ipcMain.handle(
    'tool:html-to-pdf',
    async (
      _event,
      filePath: string,
      outputPath: string,
      options: {
        pageSize: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
        landscape: boolean;
        printBackground: boolean;
      }
    ) => {
      const check = checkToolAccess('html2pdf');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      let offscreenWin: BrowserWindow | null = null;
      try {
        offscreenWin = new BrowserWindow({
          show: false,
          webPreferences: {
            offscreen: true,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            javascript: true,
          },
        });

        await offscreenWin.loadFile(filePath);
        // Give the page a brief moment to settle layout/fonts
        await new Promise((r) => setTimeout(r, 300));

        const pdfData = await offscreenWin.webContents.printToPDF({
          pageSize: options.pageSize || 'A4',
          landscape: !!options.landscape,
          printBackground: options.printBackground !== false,
          margins: { marginType: 'default' },
        });

        await fs.writeFile(outputPath, pdfData);

        saveHistory({
          id: historyId,
          tool_name: 'HTML to PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'HTML to PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      } finally {
        if (offscreenWin && !offscreenWin.isDestroyed()) {
          offscreenWin.destroy();
        }
      }
    }
  );
}
