import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileStack, Loader2, RotateCw, Trash2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface ReorderPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

interface PageItem {
  id: string;
  originalIndex: number;
  dataUrl: string;
  rotation: number; // degrees: 0, 90, 180, 270
}

export default function ReorderPages({ onBack, license }: ReorderPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [pagesList, setPagesList] = useState<PageItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  // Auto-resolve initial output path
  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
    }
  }, [fileSelected]);

  // Load pages list when pdf renderer returns dataUrls
  useEffect(() => {
    if (pages.length > 0) {
      setPagesList(
        pages.map((url, i) => ({
          id: `page-${i + 1}-${Date.now()}`,
          originalIndex: i + 1,
          dataUrl: url,
          rotation: 0,
        }))
      );
    } else {
      setPagesList([]);
    }
  }, [pages]);

  const selectOutputFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) setOutputPath(path);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRotate = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPagesList((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          return { ...item, rotation: (item.rotation + 90) % 360 };
        }
        return item;
      })
    );
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
      setErrorMsg('No pages remaining in document.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Organized_${Date.now()}.pdf`;
      const sequence = pagesList.map((p) => ({
        index: p.originalIndex,
        rotation: p.rotation,
      }));

      const res = await window.electronAPI.reorderPDF(fileSelected!, sequence, outFilePath);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during reordering.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Organized Successfully"
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
          <h2 className="text-xl font-bold text-foreground">Organize PDF Pages</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} maxFiles={1} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* MAIN PAGE PREVIEW GRID */}
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                Drag to Reorder pages & Hover to edit
              </h3>
              <button
                onClick={() =>
                  setPagesList((prev) =>
                    pages.map((url, i) => ({
                      id: `page-${i + 1}-${Date.now()}`,
                      originalIndex: i + 1,
                      dataUrl: url,
                      rotation: 0,
                    }))
                  )
                }
                className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
              >
                Reset Order
              </button>
            </div>

            {pdfLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">Generating page thumbnails...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-primary font-bold">
                <p className="text-sm">{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && pagesList.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground font-medium text-xs">
                No pages remaining. Try resetting the order.
              </div>
            )}

            {!pdfLoading && !pdfError && pagesList.length > 0 && (
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
                      {/* Image Thumbnail with Live Rotation transform */}
                      <div className="w-full aspect-[3/4] flex items-center justify-center p-3 overflow-hidden">
                        <img
                          src={item.dataUrl}
                          alt={`Page ${item.originalIndex}`}
                          style={{
                            transform: `rotate(${item.rotation}deg)`,
                            transition: 'transform 0.2s ease-in-out',
                          }}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      {/* Hover Edit Panel */}
                      <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-3">
                        <button
                          onClick={(e) => handleRotate(idx, e)}
                          className="p-2.5 rounded-full bg-card border border-border hover:border-primary text-foreground hover:text-primary shadow transition-colors"
                          title="Rotate 90° Clockwise"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(idx, e)}
                          className="p-2.5 rounded-full bg-card border border-border hover:border-rose-500 text-foreground hover:text-rose-500 shadow transition-colors"
                          title="Delete Page"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Page Label */}
                      <div className="p-1.5 text-center text-[10px] font-bold bg-secondary/40 text-muted-foreground border-t border-border flex justify-between px-3">
                        <span>Pos: {idx + 1}</span>
                        <span className="font-mono text-primary font-bold">Orig: {item.originalIndex}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT CONFIG SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Organize PDF
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Original Pages</span>
                  <span className="font-bold text-foreground">{pages.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Configured Pages</span>
                  <span className="font-bold text-primary">{pagesList.length}</span>
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
                disabled={isProcessing || pdfLoading || pagesList.length === 0}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving PDF...
                  </>
                ) : (
                  <>
                    <FileStack className="w-3.5 h-3.5" />
                    Save PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
