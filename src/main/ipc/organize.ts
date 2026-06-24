import { ipcMain } from 'electron';
import { PDFDocument, degrees } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { checkBatchLimits, checkToolAccess } from '../license';
import { saveHistory } from '../db';
import crypto from 'crypto';

export function registerOrganizeHandlers() {
  // MERGE
  ipcMain.handle('tool:merge', async (_event, filePaths: any[], outputPath: string) => {
    const check = checkToolAccess('merge');
    if (!check.allowed) throw new Error(check.reason);

    // Get input files list for limits and logs
    const inputPaths: string[] = filePaths.map((f) => typeof f === 'object' ? f.filePath : f);
    const uniquePaths = Array.from(new Set(inputPaths));
    const limit = checkBatchLimits(uniquePaths);
    if (!limit.allowed) throw new Error(limit.reason);

    const historyId = crypto.randomUUID();
    try {
      const mergedPdf = await PDFDocument.create();

      if (filePaths.length > 0 && typeof filePaths[0] === 'object') {
        // Detailed page-level merge across documents
        const pageSequence = filePaths as { filePath: string; pageNumber: number }[];
        const docCache: Record<string, PDFDocument> = {};

        for (const item of pageSequence) {
          if (!docCache[item.filePath]) {
            const bytes = await fs.readFile(item.filePath);
            docCache[item.filePath] = await PDFDocument.load(bytes);
          }
          const srcDoc = docCache[item.filePath];
          const pageIndex = item.pageNumber - 1;
          if (pageIndex >= 0 && pageIndex < srcDoc.getPageCount()) {
            const [copiedPage] = await mergedPdf.copyPages(srcDoc, [pageIndex]);
            mergedPdf.addPage(copiedPage);
          }
        }
      } else {
        // Traditional full-document merge
        const paths = filePaths as string[];
        for (const filePath of paths) {
          const pdfBytes = await fs.readFile(filePath);
          const doc = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      }

      const mergedPdfBytes = await mergedPdf.save();
      await fs.writeFile(outputPath, mergedPdfBytes);

      saveHistory({
        id: historyId,
        tool_name: 'Merge PDF',
        input_files: uniquePaths,
        output_file: outputPath,
        status: 'SUCCESS'
      });

      return { success: true, outputPath };
    } catch (error: any) {
      saveHistory({
        id: historyId,
        tool_name: 'Merge PDF',
        input_files: uniquePaths,
        output_file: outputPath,
        status: 'FAILED',
        error_message: error.message
      });
      throw error;
    }
  });

  // SPLIT
  ipcMain.handle(
    'tool:split',
    async (
      _event,
      filePath: string,
      ranges: { start: number; end: number }[],
      outputFolder: string
    ) => {
      const check = checkToolAccess('split');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pageCount = doc.getPageCount();
        const baseName = path.basename(filePath, '.pdf');
        const outputFiles: string[] = [];

        for (let i = 0; i < ranges.length; i++) {
          const range = ranges[i];
          const start = Math.max(1, range.start) - 1;
          const end = Math.min(pageCount, range.end) - 1;

          if (start > end) continue;

          const splitPdf = await PDFDocument.create();
          const pageIndices: number[] = [];
          for (let p = start; p <= end; p++) {
            pageIndices.push(p);
          }

          const copiedPages = await splitPdf.copyPages(doc, pageIndices);
          copiedPages.forEach((page) => splitPdf.addPage(page));

          const splitBytes = await splitPdf.save();
          const outName = `${baseName}_part_${i + 1}.pdf`;
          const outPath = path.join(outputFolder, outName);

          await fs.writeFile(outPath, splitBytes);
          outputFiles.push(outPath);
        }

        saveHistory({
          id: historyId,
          tool_name: 'Split PDF',
          input_files: [filePath],
          output_file: outputFolder,
          status: 'SUCCESS'
        });

        return { success: true, outputFiles };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Split PDF',
          input_files: [filePath],
          output_file: outputFolder,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // REMOVE PAGES
  ipcMain.handle(
    'tool:remove-pages',
    async (_event, filePath: string, pagesToRemove: number[], outputPath: string) => {
      const check = checkToolAccess('split'); // Grouped under split for access check
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pageCount = doc.getPageCount();
        const pagesToKeep: number[] = [];

        const removeSet = new Set(pagesToRemove.map((p) => p - 1));

        for (let i = 0; i < pageCount; i++) {
          if (!removeSet.has(i)) {
            pagesToKeep.push(i);
          }
        }

        if (pagesToKeep.length === 0) {
          throw new Error('Cannot remove all pages. At least one page must remain.');
        }

        const outPdf = await PDFDocument.create();
        const copiedPages = await outPdf.copyPages(doc, pagesToKeep);
        copiedPages.forEach((page) => outPdf.addPage(page));

        const outBytes = await outPdf.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Remove Pages',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Remove Pages',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // EXTRACT PAGES
  ipcMain.handle(
    'tool:extract-pages',
    async (_event, filePath: string, pagesToExtract: number[], outputPath: string) => {
      const check = checkToolAccess('split');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pageCount = doc.getPageCount();
        const pageIndices = pagesToExtract
          .map((p) => p - 1)
          .filter((p) => p >= 0 && p < pageCount);

        if (pageIndices.length === 0) {
          throw new Error('No valid pages selected for extraction.');
        }

        const outPdf = await PDFDocument.create();
        const copiedPages = await outPdf.copyPages(doc, pageIndices);
        copiedPages.forEach((page) => outPdf.addPage(page));

        const outBytes = await outPdf.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Extract Pages',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Extract Pages',
          input_files: [filePath],
          output_file: outputPath,
          status: 'FAILED',
          error_message: error.message
        });
        throw error;
      }
    }
  );

  // REORDER/ORGANIZE PAGES
  ipcMain.handle(
    'tool:reorder',
    async (_event, filePath: string, newSequence: (number | { index: number; rotation?: number })[], outputPath: string) => {
      const check = checkToolAccess('merge');
      if (!check.allowed) throw new Error(check.reason);

      const limit = checkBatchLimits([filePath]);
      if (!limit.allowed) throw new Error(limit.reason);

      const historyId = crypto.randomUUID();
      try {
        const fileBytes = await fs.readFile(filePath);
        const doc = await PDFDocument.load(fileBytes);
        const pageCount = doc.getPageCount();

        if (!newSequence || newSequence.length === 0) {
          throw new Error('Empty page sequence specified for reordering.');
        }

        const outPdf = await PDFDocument.create();

        for (const item of newSequence) {
          const isObj = typeof item === 'object';
          const oneBasedIdx = isObj ? item.index : item;
          const pageIdx = oneBasedIdx - 1;

          if (pageIdx >= 0 && pageIdx < pageCount) {
            const [copiedPage] = await outPdf.copyPages(doc, [pageIdx]);

            if (isObj && item.rotation !== undefined && item.rotation !== 0) {
              const currentRotation = copiedPage.getRotation().angle;
              const newRotation = (currentRotation + item.rotation) % 360;
              copiedPage.setRotation(degrees(newRotation));
            }

            outPdf.addPage(copiedPage);
          }
        }

        const outBytes = await outPdf.save();
        await fs.writeFile(outputPath, outBytes);

        saveHistory({
          id: historyId,
          tool_name: 'Organize PDF',
          input_files: [filePath],
          output_file: outputPath,
          status: 'SUCCESS'
        });

        return { success: true, outputPath };
      } catch (error: any) {
        saveHistory({
          id: historyId,
          tool_name: 'Organize PDF',
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
