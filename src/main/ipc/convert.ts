import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory, getSetting } from '../db';
import crypto from 'crypto';
import { getLibreOfficePath, getGhostscriptPath } from '../utils/binResolver';
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, PageBreak, ImageRun } from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

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
            const args = ['--headless', '--convert-to', 'pdf', '--outdir', outputFolder, filePath];
            execFile(loPath, args, (error) => {
              if (error) {
                if (!fsSync.existsSync(loPath)) {
                  reject(new Error(`LibreOffice is required for this conversion but was not found. Install it (on macOS: "brew install --cask libreoffice") or set the soffice path in Settings > Advanced.`));
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

  // PDF to Office (Word / PowerPoint / Excel) — pure JS, no external binary required.
  // Two strategies depending on what the renderer sends:
  //   - mode 'exact'    : embed each page as a full-page image (preserves layout exactly, not editable)
  //   - mode 'editable' : rebuild from extracted/OCR'd text (editable, approximate layout)
  ipcMain.handle(
    'tool:pdf-to-office',
    async (
      _event,
      target: 'word' | 'powerpoint' | 'excel',
      outputPath: string,
      payload: {
        sourcePath: string;
        mode?: 'editable' | 'exact';
        pages?: { lines: string[] }[];
        images?: { base64: string; width: number; height: number }[];
      }
    ) => {
      const check = checkToolAccess('pdf2office');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([payload.sourcePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const labelMap: Record<string, string> = {
        word: 'PDF to Word',
        powerpoint: 'PDF to PowerPoint',
        excel: 'PDF to Excel',
      };
      const label = labelMap[target] || 'PDF to Office';
      const pages = payload.pages || [];
      const images = payload.images || [];

      const historyId = crypto.randomUUID();
      try {
        if (target === 'word' && payload.mode === 'exact') {
          // Full-page image per page — looks identical to the source PDF.
          if (images.length === 0) {
            throw new Error('No page images were provided for the exact-layout conversion.');
          }
          const children: Paragraph[] = [];
          images.forEach((im, idx) => {
            const buf = Buffer.from(im.base64, 'base64');
            // Fit each page image to the printable width (~6.5in @ 96dpi = 624px)
            const targetW = 624;
            const targetH = Math.round(targetW * (im.height / im.width || 1.414));
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'jpg',
                    data: buf,
                    transformation: { width: targetW, height: targetH },
                  }),
                ],
              })
            );
            if (idx < images.length - 1) {
              children.push(new Paragraph({ children: [new PageBreak()] }));
            }
          });
          const doc = new Document({
            sections: [
              {
                properties: { page: { margin: { top: 360, bottom: 360, left: 360, right: 360 } } },
                children,
              },
            ],
          });
          const buffer = await Packer.toBuffer(doc);
          await fs.writeFile(outputPath, buffer);
        } else if (target === 'word') {
          const paragraphs: Paragraph[] = [];
          pages.forEach((pg, pageIdx) => {
            const lines = pg.lines.length ? pg.lines : [''];
            lines.forEach((line) => {
              paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
            });
            if (pageIdx < pages.length - 1) {
              paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
            }
          });
          if (paragraphs.length === 0) {
            paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
          }
          const doc = new Document({ sections: [{ children: paragraphs }] });
          const buffer = await Packer.toBuffer(doc);
          await fs.writeFile(outputPath, buffer);
        } else if (target === 'excel') {
          const wb = XLSX.utils.book_new();
          pages.forEach((pg, pageIdx) => {
            const rows = (pg.lines.length ? pg.lines : ['']).map((line) =>
              line.split(/\s{2,}/).map((c) => c.trim())
            );
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const sheetName = `Page ${pageIdx + 1}`.slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          });
          if (pages.length === 0) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['']]), 'Page 1');
          }
          const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
          await fs.writeFile(outputPath, buf);
        } else {
          // powerpoint: one slide per page, page image fitted full-slide
          const pptx = new PptxGenJS();
          if (images.length === 0) {
            throw new Error('No page images were provided for the PowerPoint conversion.');
          }
          images.forEach((im) => {
            const slide = pptx.addSlide();
            slide.addImage({
              data: `data:image/jpeg;base64,${im.base64}`,
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
              sizing: { type: 'contain', w: 10, h: 5.63 },
            });
          });
          const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
          await fs.writeFile(outputPath, buf);
        }

        saveHistory({
          id: historyId,
          tool_name: label,
          input_files: [payload.sourcePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: label,
          input_files: [payload.sourcePath],
          output_file: outputPath,
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
