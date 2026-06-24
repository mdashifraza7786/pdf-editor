import React, { useState, useEffect } from 'react';
import { ArrowLeft, Merge, Loader2, Trash2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import * as pdfjsLib from 'pdfjs-dist';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

// Configure worker URL inside Vite bundles
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface MergePagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

interface MergePageItem {
  id: string;
  filePath: string;
  fileName: string;
  pageNumber: number; // 1-based inside that file
  dataUrl: string;
}

export default function MergePages({ onBack, license }: MergePagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [pagesList, setPagesList] = useState<MergePageItem[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Auto-resolve initial output path when files list changes
  useEffect(() => {
    if (files.length > 0) {
      const firstFile = files[0].path;
      const baseDir = firstFile.substring(0, firstFile.lastIndexOf(/[/\\]/.exec(firstFile)?.[0] || ''));
      setOutputPath(baseDir);
    } else {
      setPagesList([]);
    }
  }, [files]);

  // Load and render page thumbnails for all selected documents
  useEffect(() => {
    let isCancelled = false;

    const loadAllPages = async () => {
      if (files.length === 0) {
        setPagesList([]);
        return;
      }
      setLoadingThumbnails(true);
      setErrorMsg('');

      try {
        const newPagesList: MergePageItem[] = [];

        for (const file of files) {
          if (isCancelled) return;
          
          // Check if we already have page previews for this file to avoid re-rendering
          const existing = pagesList.filter((p) => p.filePath === file.path);
          if (existing.length > 0) {
            newPagesList.push(...existing);
            continue;
          }

          // Load PDF bytes via the bridge
          const binaryData = await window.electronAPI.readBinaryFile(file.path);
          if (isCancelled) return;

          const loadingTask = pdfjsLib.getDocument({ data: binaryData });
          const pdf = await loadingTask.promise;

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          for (let i = 1; i <= pdf.numPages; i++) {
            if (isCancelled) return;
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.8 * dpr }); // crisp merge thumbnails
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;

            newPagesList.push({
              id: `${file.path}-page-${i}-${Date.now()}-${Math.random()}`,
              filePath: file.path,
              fileName: file.name,
              pageNumber: i,
              dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            });
          }
        }

        if (!isCancelled) {
          setPagesList(newPagesList);
        }
      } catch (err: any) {
        console.error(err);
        if (!isCancelled) {
          setErrorMsg('Failed to render some files. Make sure they are not password protected.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingThumbnails(false);
        }
      }
    };

    loadAllPages();

    return () => {
      isCancelled = true;
    };
  }, [files]);

  const selectOutputFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) setOutputPath(path);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPagesList((prev) => prev.filter((_, i) => i !== idx));
  };

  // NATIVE HTML5 DRAG & DROP
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (idx: number) => {
    if (draggedIndex === null || draggedIndex === idx) return;

    setPagesList((prev) => {
      const list = [...prev];
      const [draggedItem] = list.splice(draggedIndex, 1);
      list.splice(idx, 0, draggedItem);
      return list;
    });

    setDraggedIndex(null);
  };

  const handleExecute = async () => {
    if (pagesList.length === 0) {
      setErrorMsg('No pages to merge.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Merged_${Date.now()}.pdf`;
      const sequence = pagesList.map((p) => ({
        filePath: p.filePath,
        pageNumber: p.pageNumber,
      }));

      // Call expanded tool:merge handler
      const res = await window.electronAPI.mergePDF(sequence as any, outFilePath);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during merge.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDFs Merged Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setPagesList([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={onBack}
          className="p-2 bg-card border border-border hover:border-primary/30 rounded-xl text-muted-foreground hover:text-foreground shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Merge PDF Documents</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: MULTI FILE SELECTOR & PREVIEW */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel border border-border rounded-2xl p-6">
            <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} />
          </div>

          {files.length > 0 && (
            <div className="glass-panel border border-border rounded-2xl p-6 min-h-[400px] flex flex-col">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-4">
                Drag pages to arrange merge sequence across documents
              </h3>

              {loadingThumbnails && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground font-semibold">Generating page previews...</p>
                </div>
              )}

              {!loadingThumbnails && pagesList.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground font-medium text-xs">
                  All pages removed from queue. Add more documents to begin.
                </div>
              )}

              {!loadingThumbnails && pagesList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  {pagesList.map((item, idx) => {
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        className={`relative group cursor-grab active:cursor-grabbing border rounded-xl overflow-hidden shadow-sm bg-card hover:border-primary/50 transition-all duration-200 ${
                          draggedIndex === idx ? 'opacity-40 border-dashed border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        {/* Image Thumbnail */}
                        <div className="w-full aspect-[3/4] flex items-center justify-center p-2.5 overflow-hidden">
                          <img src={item.dataUrl} alt={`${item.fileName} P${item.pageNumber}`} className="max-h-full max-w-full object-contain" />
                        </div>

                        {/* Hover Delete Panel */}
                        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                          <button
                            onClick={(e) => handleDelete(idx, e)}
                            className="p-2.5 rounded-full bg-card border border-border hover:border-rose-500 text-foreground hover:text-rose-500 shadow transition-colors"
                            title="Remove Page"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Label displaying page index and filename source */}
                        <div className="p-1.5 bg-secondary/40 border-t border-border text-[9px] text-muted-foreground px-2 flex flex-col justify-center min-w-0">
                          <span className="font-extrabold text-foreground truncate" title={item.fileName}>
                            {item.fileName}
                          </span>
                          <span className="flex justify-between font-medium mt-0.5">
                            <span>Pos: {idx + 1}</span>
                            <span className="text-primary font-bold">Page {item.pageNumber}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT CONFIG SIDEBAR */}
        <div className="space-y-6">
          <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
              Merge Settings
            </h3>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground font-medium">Selected Documents</span>
                <span className="font-bold text-foreground">{files.length} files</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground font-medium">Total Merge Pages</span>
                <span className="font-bold text-primary">{pagesList.length} pages</span>
              </div>
            </div>

            {/* SAVE DIRECTORY */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Save Destination</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={outputPath}
                  className="flex-1 px-3 py-2 bg-card border border-border rounded-xl text-xs outline-none text-foreground truncate shadow-sm"
                />
                <button
                  onClick={selectOutputFolder}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold transition-all text-foreground shadow-sm"
                >
                  Browse
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[10px] font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* PRIMARY ACTION */}
            <button
              onClick={handleExecute}
              disabled={isProcessing || loadingThumbnails || pagesList.length === 0}
              className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Merging PDFs...
                </>
              ) : (
                <>
                  <Merge className="w-3.5 h-3.5" />
                  Merge PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
