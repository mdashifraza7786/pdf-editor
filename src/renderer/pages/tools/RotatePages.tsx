import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCw, RotateCcw, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface RotatePagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function RotatePages({ onBack, license }: RotatePagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageAngles, setPageAngles] = useState<number[]>([]); // stores angles (0, 90, 180, 270)
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
      setSelectedPages(new Set());
    }
  }, [fileSelected]);

  // Load angles list
  useEffect(() => {
    if (pages.length > 0) {
      setPageAngles(new Array(pages.length).fill(0));
    } else {
      setPageAngles([]);
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

  const togglePage = (pageNum1Based: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum1Based)) {
        next.delete(pageNum1Based);
      } else {
        next.add(pageNum1Based);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPages.size === pages.length) {
      setSelectedPages(new Set());
    } else {
      const all = new Set<number>();
      for (let i = 1; i <= pages.length; i++) {
        all.add(i);
      }
      setSelectedPages(all);
    }
  };

  const rotateSelected = (direction: 'cw' | 'ccw') => {
    const delta = direction === 'cw' ? 90 : 270;
    const targetPages = selectedPages.size > 0 
      ? selectedPages 
      : new Set(pageAngles.map((_, i) => i + 1)); // Default to all if none selected

    setPageAngles((prev) =>
      prev.map((angle, idx) => {
        const pageNum = idx + 1;
        if (targetPages.has(pageNum)) {
          return (angle + delta) % 360;
        }
        return angle;
      })
    );
  };

  const handleExecute = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Rotated_${Date.now()}.pdf`;
      
      // Build a reorder-style sequence incorporating the rotations per page
      const sequence = pageAngles.map((angle, idx) => ({
        index: idx + 1,
        rotation: angle,
      }));

      const res = await window.electronAPI.reorderPDF(fileSelected!, sequence, outFilePath);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during rotation.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Pages Rotated Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setSelectedPages(new Set());
          setPageAngles([]);
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
          <h2 className="text-xl font-bold text-foreground">Rotate PDF Pages</h2>
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
                Select Pages to Rotate
              </h3>
              <button
                onClick={selectAll}
                className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
              >
                {selectedPages.size === pages.length ? 'Deselect All' : 'Select All'}
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

            {!pdfLoading && !pdfError && pages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {pages.map((dataUrl, idx) => {
                  const pageNum = idx + 1;
                  const isSelected = selectedPages.has(pageNum);
                  const angle = pageAngles[idx] || 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => togglePage(pageNum)}
                      className={`relative group cursor-pointer border rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {/* Image Thumbnail with CSS Rotation */}
                      <div className="w-full aspect-[3/4] flex items-center justify-center p-3 overflow-hidden">
                        <img
                          src={dataUrl}
                          alt={`Page ${pageNum}`}
                          style={{
                            transform: `rotate(${angle}deg)`,
                            transition: 'transform 0.2s ease-in-out',
                          }}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      {/* Page Label */}
                      <div className={`p-1.5 text-center text-[10px] font-bold border-t flex justify-between px-3 ${
                        isSelected
                          ? 'bg-primary/20 text-primary border-primary/30 font-extrabold'
                          : 'bg-secondary/40 text-muted-foreground border-border'
                      }`}>
                        <span>Page {pageNum}</span>
                        {angle !== 0 && <span className="font-mono text-[9px]">{angle}°</span>}
                      </div>

                      {/* Top Right Corner Badge */}
                      {isSelected && (
                        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow">
                          {pageNum}
                        </span>
                      )}
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
                Rotation Options
              </h3>

              {/* Selection Summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Selected Pages</span>
                  <span className="font-bold text-foreground">
                    {selectedPages.size > 0 ? `${selectedPages.size} / ${pages.length}` : `All (${pages.length})`}
                  </span>
                </div>
              </div>

              {/* Rotator Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => rotateSelected('ccw')}
                  className="flex-1 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-foreground shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-primary" />
                  Rotate Left
                </button>
                <button
                  onClick={() => rotateSelected('cw')}
                  className="flex-1 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-foreground shadow-sm"
                >
                  <RotateCw className="w-3.5 h-3.5 text-primary" />
                  Rotate Right
                </button>
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
                disabled={isProcessing || pdfLoading}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Rotating PDF...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    Apply Rotation
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
