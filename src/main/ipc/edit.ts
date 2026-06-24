import { ipcMain } from 'electron';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory } from '../db';
import crypto from 'crypto';

export function registerEditHandlers() {
  // ROTATE PDF
  ipcMain.handle(
    'tool:rotate',
    async (
      _event,
      filePath: string,
      outputPath: string,
      rotationAngle: number // 90, 180, 270
    ) => {
      const check = checkToolAccess('rotate');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pages = doc.getPages();

        for (const page of pages) {
          const currentRotation = page.getRotation().angle;
          const newRotation = (currentRotation + rotationAngle) % 360;
          page.setRotation(degrees(newRotation));
        }

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Rotate PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Rotate PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // WATERMARK
  ipcMain.handle(
    'tool:watermark',
    async (
      _event,
      filePath: string,
      outputPath: string,
      options: {
        type: 'text' | 'image';
        text?: string;
        imagePath?: string;
        opacity: number;
        position: 'center' | 'top-right' | 'bottom-left' | 'top-left' | 'bottom-right';
        fontSize?: number;
      }
    ) => {
      const check = checkToolAccess('watermark');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const pages = doc.getPages();

        for (const page of pages) {
          const { width, height } = page.getSize();

          if (options.type === 'text' && options.text) {
            const text = options.text;
            const size = options.fontSize || 40;
            const textWidth = font.widthOfTextAtSize(text, size);
            const textHeight = font.heightAtSize(size);

            let x = width / 2 - textWidth / 2;
            let y = height / 2 - textHeight / 2;
            let rot = 45;

            if (options.position === 'top-right') {
              x = width - textWidth - 50;
              y = height - textHeight - 50;
              rot = 0;
            } else if (options.position === 'bottom-left') {
              x = 50;
              y = 50;
              rot = 0;
            } else if (options.position === 'top-left') {
              x = 50;
              y = height - textHeight - 50;
              rot = 0;
            } else if (options.position === 'bottom-right') {
              x = width - textWidth - 50;
              y = 50;
              rot = 0;
            }

            page.drawText(text, {
              x,
              y,
              size,
              font,
              color: rgb(0.7, 0.7, 0.7),
              opacity: options.opacity || 0.4,
              rotate: degrees(rot),
            });
          } else if (options.type === 'image' && options.imagePath) {
            const imgBytes = await fs.readFile(options.imagePath);
            let image;
            if (options.imagePath.endsWith('.png')) {
              image = await doc.embedPng(imgBytes);
            } else {
              image = await doc.embedJpg(imgBytes);
            }

            const imgWidth = image.width / 2;
            const imgHeight = image.height / 2;

            let x = width / 2 - imgWidth / 2;
            let y = height / 2 - imgHeight / 2;

            if (options.position === 'top-right') {
              x = width - imgWidth - 50;
              y = height - imgHeight - 50;
            } else if (options.position === 'bottom-left') {
              x = 50;
              y = 50;
            } else if (options.position === 'top-left') {
              x = 50;
              y = height - imgHeight - 50;
            } else if (options.position === 'bottom-right') {
              x = width - imgWidth - 50;
              y = 50;
            }

            page.drawImage(image, {
              x,
              y,
              width: imgWidth,
              height: imgHeight,
              opacity: options.opacity || 0.4,
            });
          }
        }

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Watermark PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Watermark PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // PAGE NUMBERS
  ipcMain.handle(
    'tool:page-numbers',
    async (
      _event,
      filePath: string,
      outputPath: string,
      options: {
        position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        startNumber: number;
        format: 'simple' | 'page-of';
      }
    ) => {
      const check = checkToolAccess('watermark'); // Grouped under watermark access
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        const totalPages = pages.length;

        for (let i = 0; i < totalPages; i++) {
          const page = pages[i];
          const { width, height } = page.getSize();
          const pageNum = options.startNumber + i;

          const label = options.format === 'page-of'
            ? `Page ${pageNum} of ${totalPages}`
            : `${pageNum}`;

          const size = 10;
          const textWidth = font.widthOfTextAtSize(label, size);
          const textHeight = font.heightAtSize(size);

          let x = 50;
          let y = 30; // bottom default

          // Calculate Position X
          if (options.position.endsWith('center')) {
            x = width / 2 - textWidth / 2;
          } else if (options.position.endsWith('right')) {
            x = width - textWidth - 50;
          }

          // Calculate Position Y
          if (options.position.startsWith('top')) {
            y = height - textHeight - 40;
          }

          page.drawText(label, {
            x,
            y,
            size,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
        }

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Page Numbers',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Page Numbers',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // CROP PDF
  ipcMain.handle(
    'tool:crop',
    async (
      _event,
      filePath: string,
      outputPath: string,
      cropArea: { x: number; y: number; width: number; height: number }, // percentages 0-1
      applyToAll: boolean,
      pageIndex = 0
    ) => {
      const check = checkToolAccess('rotate');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pages = doc.getPages();

        const applyCrop = (page: any) => {
          const { width, height } = page.getSize();
          const cropX = cropArea.x * width;
          const cropY = cropArea.y * height;
          const cropW = cropArea.width * width;
          const cropH = cropArea.height * height;
          page.setCropBox(cropX, cropY, cropW, cropH);
        };

        if (applyToAll) {
          for (const page of pages) {
            applyCrop(page);
          }
        } else {
          if (pageIndex >= 0 && pageIndex < pages.length) {
            applyCrop(pages[pageIndex]);
          }
        }

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Crop PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Crop PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // SIGN PDF (place a signature image onto a page)
  ipcMain.handle(
    'tool:sign',
    async (
      _event,
      filePath: string,
      outputPath: string,
      options: {
        imagePath: string;
        pageIndex: number;          // 0-based; -1 means last page
        x: number;                  // 0-1 relative position of the box's left edge
        y: number;                  // 0-1 relative position of the box's bottom edge
        widthRatio: number;         // signature width as a fraction of page width (0-1)
      }
    ) => {
      const check = checkToolAccess('sign');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        if (!options.imagePath) {
          throw new Error('A signature image is required.');
        }

        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pages = doc.getPages();

        const imgBytes = await fs.readFile(options.imagePath);
        let image;
        if (options.imagePath.toLowerCase().endsWith('.png')) {
          image = await doc.embedPng(imgBytes);
        } else {
          image = await doc.embedJpg(imgBytes);
        }

        let targetIndex = options.pageIndex;
        if (targetIndex < 0 || targetIndex >= pages.length) {
          targetIndex = pages.length - 1; // default to last page
        }

        const page = pages[targetIndex];
        const { width, height } = page.getSize();

        const drawW = Math.max(20, options.widthRatio * width);
        const drawH = (image.height / image.width) * drawW;
        const drawX = options.x * width;
        const drawY = options.y * height;

        page.drawImage(image, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Sign PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Sign PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // REDACT PDF (draw opaque blocks over selected regions)
  ipcMain.handle(
    'tool:redact',
    async (
      _event,
      filePath: string,
      outputPath: string,
      // each box: page is 0-based, coords are 0-1 relative to page size (origin bottom-left)
      boxes: { page: number; x: number; y: number; width: number; height: number }[]
    ) => {
      const check = checkToolAccess('redact');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        if (!boxes || boxes.length === 0) {
          throw new Error('No redaction areas were specified.');
        }

        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pages = doc.getPages();

        for (const box of boxes) {
          if (box.page < 0 || box.page >= pages.length) continue;
          const page = pages[box.page];
          const { width, height } = page.getSize();
          page.drawRectangle({
            x: box.x * width,
            y: box.y * height,
            width: box.width * width,
            height: box.height * height,
            color: rgb(0, 0, 0),
            opacity: 1,
          });
        }

        const outBytes = await doc.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Redact PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Redact PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );
}
