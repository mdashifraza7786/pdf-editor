import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker URL inside Vite bundles
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export function usePdfRenderer(filePath: string | null) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!filePath) {
      setPages([]);
      setLoading(false);
      setError('');
      return;
    }

    let isCancelled = false;
    const renderPdf = async () => {
      setLoading(true);
      setError('');
      setPages([]);
      try {
        const binaryData = await window.electronAPI.readBinaryFile(filePath);
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({ data: binaryData });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const totalPages = pdf.numPages;
        const tempPages: string[] = [];

        for (let i = 1; i <= totalPages; i++) {
          if (isCancelled) return;
          const page = await pdf.getPage(i);
          // Scale optimized for clean visual thumbnails
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context!, viewport }).promise;
          if (isCancelled) return;

          tempPages.push(canvas.toDataURL('image/jpeg', 0.85));
        }

        if (!isCancelled) {
          setPages(tempPages);
        }
      } catch (err: any) {
        console.error('Failed to render PDF pages', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to render PDF. Ensure it is not corrupted or password-protected.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [filePath]);

  return { pages, loading, error };
}
export default usePdfRenderer;
