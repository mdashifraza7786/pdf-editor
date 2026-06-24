import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, EyeOff, Loader2, Trash2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface RedactPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

// box stored in top-left origin ratios (0-1) of the page
interface RedactBox {
  page: number;
  left: number;
  top: number;
  w: number;
  h: number;
}

export default function RedactPages({ onBack }: RedactPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [drawing, setDrawing] = useState<RedactBox | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
      setSelectedPageIdx(0);
      setBoxes([]);
    }
  }, [fileSelected]);

  const selectOutputFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) setOutputPath(path);
    } catch (err) {
      console.error(err);
    }
  };

  const relCoords = (e: React.MouseEvent) => {
    const rect = previewRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!previewRef.current) return;
    const { x, y } = relCoords(e);
    startRef.current = { x, y };
    setDrawing({ page: selectedPageIdx, left: x, top: y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startRef.current) return;
    const { x, y } = relCoords(e);
    const s = startRef.current;
    setDrawing({
      page: selectedPageIdx,
      left: Math.min(s.x, x),
      top: Math.min(s.y, y),
      w: Math.abs(x - s.x),
      h: Math.abs(y - s.y),
    });
  };

  const handleMouseUp = () => {
    if (drawing && drawing.w > 0.01 && drawing.h > 0.01) {
      setBoxes((prev) => [...prev, drawing]);
    }
    setDrawing(null);
    startRef.current = null;
  };

  const removeBox = (idx: number) => {
    setBoxes((prev) => prev.filter((_, i) => i !== idx));
  };

  const currentPageBoxes = boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.page === selectedPageIdx);

  const handleExecute = async () => {
    if (boxes.length === 0) {
      setErrorMsg('Draw at least one redaction box over the content you want to hide.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const payload = boxes.map((b) => ({
        page: b.page,
        x: b.left,
        y: 1 - b.top - b.h, // convert to bottom-left origin
        width: b.w,
        height: b.h,
      }));
      const outFilePath = `${outputPath}/Redacted_${Date.now()}.pdf`;
      const res = await window.electronAPI.redactPDF(fileSelected!, outFilePath, payload);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during redaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Redacted Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setBoxes([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={onBack}
          className="p-2 bg-card border border-border hover:border-primary/30 rounded-xl text-muted-foreground hover:text-foreground shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Redact PDF</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} maxFiles={1} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* PREVIEW */}
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col items-center justify-center">
            <div className="w-full flex justify-between items-center mb-4 self-start">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                Drag to draw black boxes over sensitive content
              </h3>
            </div>

            {pdfLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">Generating page preview...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-primary font-bold">
                <p className="text-sm">{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && pages.length > 0 && (
              <div
                ref={previewRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative border border-border rounded-xl bg-card shadow-lg max-w-md w-full overflow-hidden cursor-crosshair select-none"
              >
                <img
                  src={pages[selectedPageIdx]}
                  alt="Page Preview"
                  className="w-full h-auto object-contain select-none pointer-events-none"
                />
                {/* committed boxes */}
                {currentPageBoxes.map(({ b, i }) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${b.left * 100}%`,
                      top: `${b.top * 100}%`,
                      width: `${b.w * 100}%`,
                      height: `${b.h * 100}%`,
                    }}
                    className="bg-black/85 border border-rose-500/50"
                  />
                ))}
                {/* live drawing box */}
                {drawing && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${drawing.left * 100}%`,
                      top: `${drawing.top * 100}%`,
                      width: `${drawing.w * 100}%`,
                      height: `${drawing.h * 100}%`,
                    }}
                    className="bg-black/60 border border-dashed border-primary"
                  />
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Redaction Options
              </h3>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Current Page</label>
                <select
                  value={selectedPageIdx}
                  onChange={(e) => setSelectedPageIdx(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  {pages.map((_, i) => (
                    <option key={i} value={i}>Page {i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">
                    Boxes ({boxes.length})
                  </span>
                  {boxes.length > 0 && (
                    <button
                      onClick={() => setBoxes([])}
                      className="text-[10px] text-rose-500 hover:underline font-bold"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {currentPageBoxes.length === 0 && (
                    <p className="text-[10px] text-muted-foreground font-medium">No boxes on this page yet.</p>
                  )}
                  {currentPageBoxes.map(({ i }, n) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-[10px]">
                      <span className="font-bold text-foreground">Box {n + 1}</span>
                      <button
                        onClick={() => removeBox(i)}
                        className="p-1 text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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

              <button
                onClick={handleExecute}
                disabled={isProcessing || pdfLoading || boxes.length === 0}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Redacting...
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Apply Redaction
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
