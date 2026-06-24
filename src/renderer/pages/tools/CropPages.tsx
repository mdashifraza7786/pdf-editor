import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Crop, Loader2, RefreshCw } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface CropPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function CropPages({ onBack, license }: CropPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [pageIndex, setPageIndex] = useState(0); // 0-based page index
  const [applyToAll, setApplyToAll] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Crop box percentages (0 to 1)
  const [cropPercent, setCropPercent] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  // Auto-resolve initial output path
  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
      setPageIndex(0);
      setCropPercent({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // reset box
    }
  }, [fileSelected]);

  // Handle resizing and dragging of the crop box
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStart.x) / rect.width;
      const dy = (e.clientY - dragStart.y) / rect.height;

      setCropPercent((prev) => {
        let x = dragStart.cropX;
        let y = dragStart.cropY;
        let w = dragStart.cropW;
        let h = dragStart.cropH;

        if (dragMode === 'move') {
          x = Math.max(0, Math.min(1 - w, dragStart.cropX + dx));
          y = Math.max(0, Math.min(1 - h, dragStart.cropY + dy));
        } else if (dragMode === 'nw') {
          const newX = Math.max(0, Math.min(dragStart.cropX + dragStart.cropW - 0.05, dragStart.cropX + dx));
          w = dragStart.cropW + (dragStart.cropX - newX);
          x = newX;
          const newY = Math.max(0, Math.min(dragStart.cropY + dragStart.cropH - 0.05, dragStart.cropY + dy));
          h = dragStart.cropH + (dragStart.cropY - newY);
          y = newY;
        } else if (dragMode === 'ne') {
          w = Math.max(0.05, Math.min(1 - dragStart.cropX, dragStart.cropW + dx));
          const newY = Math.max(0, Math.min(dragStart.cropY + dragStart.cropH - 0.05, dragStart.cropY + dy));
          h = dragStart.cropH + (dragStart.cropY - newY);
          y = newY;
        } else if (dragMode === 'sw') {
          const newX = Math.max(0, Math.min(dragStart.cropX + dragStart.cropW - 0.05, dragStart.cropX + dx));
          w = dragStart.cropW + (dragStart.cropX - newX);
          x = newX;
          h = Math.max(0.05, Math.min(1 - dragStart.cropY, dragStart.cropH + dy));
        } else if (dragMode === 'se') {
          w = Math.max(0.05, Math.min(1 - dragStart.cropX, dragStart.cropW + dx));
          h = Math.max(0.05, Math.min(1 - dragStart.cropY, dragStart.cropH + dy));
        }

        return { x, y, w, h };
      });
    };

    const handleMouseUp = () => {
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, dragStart]);

  const selectOutputFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) setOutputPath(path);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropPercent.x,
      cropY: cropPercent.y,
      cropW: cropPercent.w,
      cropH: cropPercent.h,
    });
  };

  // Preset Ratio snappers
  const applyPreset = (preset: 'square' | 'a4' | 'letter' | 'custom') => {
    if (preset === 'square') {
      setCropPercent({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    } else if (preset === 'a4') {
      // 0.707 ratio
      setCropPercent({ x: 0.15, y: 0.1, w: 0.565, h: 0.8 });
    } else if (preset === 'letter') {
      // 0.773 ratio
      setCropPercent({ x: 0.15, y: 0.1, w: 0.618, h: 0.8 });
    } else {
      setCropPercent({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    }
  };

  const handleExecute = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Cropped_${Date.now()}.pdf`;

      // Transform Y coordinate to PDF bottom-left coordinate origin
      // PDF-Lib expects the Y to represent the lower-left corner from the bottom of the page
      const cropArea = {
        x: cropPercent.x,
        y: 1 - cropPercent.y - cropPercent.h,
        width: cropPercent.w,
        height: cropPercent.h,
      };

      const res = await window.electronAPI.cropPDF(
        fileSelected!,
        outFilePath,
        cropArea,
        applyToAll,
        pageIndex
      );

      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during cropping.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Cropped Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setPageIndex(0);
          setCropPercent({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
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
          <h2 className="text-xl font-bold text-foreground">Crop PDF</h2>
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
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                Visual Cropping Area
              </h3>

              {!pdfLoading && pages.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-bold">Crop Source Page:</span>
                  <select
                    value={pageIndex}
                    onChange={(e) => setPageIndex(parseInt(e.target.value))}
                    className="px-2 py-1 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none"
                  >
                    {pages.map((_, idx) => (
                      <option key={idx} value={idx}>
                        Page {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {pdfLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">Generating page view...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-primary font-bold">
                <p className="text-sm">{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && pages.length > 0 && (
              <div className="flex-1 flex items-center justify-center p-4 bg-secondary/15 rounded-xl border border-border">
                {/* Responsive relative container containing page image and draggable overlay */}
                <div
                  ref={containerRef}
                  className="relative select-none overflow-hidden max-h-[60vh]"
                  style={{ aspectRatio: 'auto' }}
                >
                  <img
                    src={pages[pageIndex]}
                    alt={`Crop Preview Page ${pageIndex + 1}`}
                    className="max-h-[60vh] object-contain max-w-full border border-border/80 shadow-md rounded-lg"
                    draggable={false}
                  />

                  {/* Resizable and Draggable Box */}
                  <div
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                    className="absolute border-2 border-dashed border-primary bg-primary/10 cursor-move shadow-inner transition-colors duration-150 hover:bg-primary/15"
                    style={{
                      left: `${cropPercent.x * 100}%`,
                      top: `${cropPercent.y * 100}%`,
                      width: `${cropPercent.w * 100}%`,
                      height: `${cropPercent.h * 100}%`,
                    }}
                  >
                    {/* Corners Resize Handles */}
                    {/* NW */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, 'nw')}
                      className="absolute top-[-5px] left-[-5px] w-3 h-3 bg-primary border border-white rounded-full cursor-nwse-resize shadow-md"
                    />
                    {/* NE */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, 'ne')}
                      className="absolute top-[-5px] right-[-5px] w-3 h-3 bg-primary border border-white rounded-full cursor-nesw-resize shadow-md"
                    />
                    {/* SW */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, 'sw')}
                      className="absolute bottom-[-5px] left-[-5px] w-3 h-3 bg-primary border border-white rounded-full cursor-nesw-resize shadow-md"
                    />
                    {/* SE */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, 'se')}
                      className="absolute bottom-[-5px] right-[-5px] w-3 h-3 bg-primary border border-white rounded-full cursor-nwse-resize shadow-md"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground font-semibold text-center mt-3">
              Drag the dashed crop box to reposition, or use corner handles to adjust the boundaries.
            </div>
          </div>

          {/* RIGHT CONFIG SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Crop Parameters
              </h3>

              {/* ASPECT PRESETS */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Presets</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => applyPreset('square')}
                    className="py-1.5 bg-card hover:bg-secondary/40 border border-border rounded-lg font-bold text-foreground transition-all shadow-sm"
                  >
                    1:1 Square
                  </button>
                  <button
                    onClick={() => applyPreset('a4')}
                    className="py-1.5 bg-card hover:bg-secondary/40 border border-border rounded-lg font-bold text-foreground transition-all shadow-sm"
                  >
                    A4 Canvas
                  </button>
                  <button
                    onClick={() => applyPreset('letter')}
                    className="py-1.5 bg-card hover:bg-secondary/40 border border-border rounded-lg font-bold text-foreground transition-all shadow-sm"
                  >
                    Letter
                  </button>
                  <button
                    onClick={() => applyPreset('custom')}
                    className="py-1.5 bg-card hover:bg-secondary/40 border border-border rounded-lg font-bold text-foreground transition-all shadow-sm"
                  >
                    Reset Full
                  </button>
                </div>
              </div>

              {/* NUMERICAL BOUNDS */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Precise Alignment</label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[9px] font-bold">X Offset</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(cropPercent.x * 100)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                        setCropPercent((prev) => ({ ...prev, x: Math.min(1 - prev.w, val) }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] font-bold">Y Offset</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(cropPercent.y * 100)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                        setCropPercent((prev) => ({ ...prev, y: Math.min(1 - prev.h, val) }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] font-bold">Width</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={Math.round(cropPercent.w * 100)}
                      onChange={(e) => {
                        const val = Math.max(5, Math.min(100, parseInt(e.target.value) || 5)) / 100;
                        setCropPercent((prev) => ({ ...prev, w: Math.min(1 - prev.x, val) }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] font-bold">Height</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={Math.round(cropPercent.h * 100)}
                      onChange={(e) => {
                        const val = Math.max(5, Math.min(100, parseInt(e.target.value) || 5)) / 100;
                        setCropPercent((prev) => ({ ...prev, h: Math.min(1 - prev.y, val) }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* TARGET OPTIONS */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Page Application</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setApplyToAll(true)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all capitalize font-bold ${
                      applyToAll
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border bg-card hover:border-primary/25 text-muted-foreground shadow-sm'
                    }`}
                  >
                    Crop all pages
                  </button>
                  <button
                    onClick={() => setApplyToAll(false)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all capitalize font-bold ${
                      !applyToAll
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border bg-card hover:border-primary/25 text-muted-foreground shadow-sm'
                    }`}
                  >
                    Crop current page only ({pageIndex + 1})
                  </button>
                </div>
              </div>

              {/* SAVE DIRECTORY */}
              <div className="space-y-2 pt-2 border-t border-border/60">
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
                    Cropping PDF...
                  </>
                ) : (
                  <>
                    <Crop className="w-3.5 h-3.5" />
                    Crop PDF
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
