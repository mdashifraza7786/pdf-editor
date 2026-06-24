import * as pdfjsLib from 'pdfjs-dist';

// Configure worker URL inside Vite bundles
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Extracts text from a PDF, grouped into lines per page, using pdf.js.
 * Items on roughly the same vertical position are merged into one line and
 * ordered left-to-right. Larger horizontal gaps insert extra spacing so that
 * tabular layouts have a chance of being split into columns downstream.
 */
export async function extractPdfText(filePath: string): Promise<{ lines: string[] }[]> {
  const binaryData = await window.electronAPI.readBinaryFile(filePath);
  const pdf = await pdfjsLib.getDocument({ data: binaryData }).promise;

  const pages: { lines: string[] }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Bucket items by their y position (rounded) to reconstruct lines
    const rows = new Map<number, { x: number; width: number; s: string }[]>();
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string' || item.str.length === 0) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5]);
      const key = Math.round(y / 3) * 3; // merge items within ~3 units vertically
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x, width: item.width || 0, s: item.str });
    }

    const sortedYKeys = Array.from(rows.keys()).sort((a, b) => b - a); // top -> bottom

    const lines = sortedYKeys
      .map((k) => {
        const items = rows.get(k)!.sort((a, b) => a.x - b.x);
        let line = '';
        let prevEnd: number | null = null;
        for (const it of items) {
          if (prevEnd !== null) {
            const gap = it.x - prevEnd;
            if (gap > 10) line += '   ';
            else if (gap > 1) line += ' ';
          }
          line += it.s;
          prevEnd = it.x + it.width;
        }
        return line.replace(/\s+$/, '');
      })
      .filter((l) => l.trim().length > 0);

    pages.push({ lines });
  }

  return pages;
}
