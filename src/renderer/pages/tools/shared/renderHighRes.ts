import * as pdfjsLib from 'pdfjs-dist';

// Configure worker URL inside Vite bundles
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Renders the requested pages of a PDF at a high resolution and returns the
 * raw base64 (no data-URL prefix) for each, suitable for writing to disk.
 *
 * `scale` is relative to the PDF's native 72-DPI size, so scale 3 ≈ 216 DPI —
 * sharp enough for exported images. The whole document is loaded once.
 */
export async function renderPdfPagesToJpeg(
  filePath: string,
  pageNumbers: number[],
  scale = 3,
  quality = 0.95
): Promise<{ pageNumber: number; base64Data: string; width: number; height: number }[]> {
  const binaryData = await window.electronAPI.readBinaryFile(filePath);
  const pdf = await pdfjsLib.getDocument({ data: binaryData }).promise;

  const results: { pageNumber: number; base64Data: string; width: number; height: number }[] = [];

  for (const pageNumber of pageNumbers) {
    if (pageNumber < 1 || pageNumber > pdf.numPages) continue;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context!, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    results.push({
      pageNumber,
      base64Data: dataUrl.replace(/^data:image\/[a-z]+;base64,/, ''),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return results;
}

/** Returns the number of pages in a PDF without rendering them. */
export async function getPageCount(filePath: string): Promise<number> {
  const binaryData = await window.electronAPI.readBinaryFile(filePath);
  const pdf = await pdfjsLib.getDocument({ data: binaryData }).promise;
  return pdf.numPages;
}
