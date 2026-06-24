import React, { useState } from 'react';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Columns, Layers } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import { LicenseStatus } from '../../types';

interface ComparePagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function ComparePages({ onBack }: ComparePagesProps) {
  const [filesA, setFilesA] = useState<{ path: string; name: string; size: number }[]>([]);
  const [filesB, setFilesB] = useState<{ path: string; name: string; size: number }[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [mode, setMode] = useState<'side' | 'overlay'>('side');
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  const pathA = filesA[0]?.path || null;
  const pathB = filesB[0]?.path || null;

  const { pages: pagesA, loading: loadingA, error: errorA } = usePdfRenderer(pathA);
  const { pages: pagesB, loading: loadingB, error: errorB } = usePdfRenderer(pathB);

  const bothLoaded = pathA && pathB && !loadingA && !loadingB && pagesA.length > 0 && pagesB.length > 0;
  const maxPages = Math.max(pagesA.length, pagesB.length);
  const countMismatch = pagesA.length !== pagesB.length;

  const goPrev = () => setPageIdx((i) => Math.max(0, i - 1));
  const goNext = () => setPageIdx((i) => Math.min(maxPages - 1, i + 1));

  const reset = () => {
    setFilesA([]);
    setFilesB([]);
    setPageIdx(0);
  };

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
          <h2 className="text-xl font-bold text-foreground">Compare PDF</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      {!pathA || !pathB ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-3">
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Original Document (A)</p>
            <FileSelector files={filesA} setFiles={setFilesA} allowedExtensions={['pdf']} maxFiles={1} />
          </div>
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-3">
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Modified Document (B)</p>
            <FileSelector files={filesB} setFiles={setFilesB} allowedExtensions={['pdf']} maxFiles={1} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* TOOLBAR */}
          <div className="glass-panel border border-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('side')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                  mode === 'side' ? 'bg-primary border-primary text-white' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                Side by Side
              </button>
              <button
                onClick={() => setMode('overlay')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                  mode === 'overlay' ? 'bg-primary border-primary text-white' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Overlay
              </button>
            </div>

            {/* PAGE NAV */}
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={pageIdx === 0}
                className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-foreground tabular-nums">
                Page {pageIdx + 1} / {maxPages}
              </span>
              <button
                onClick={goNext}
                disabled={pageIdx >= maxPages - 1}
                className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button onClick={reset} className="text-xs text-primary hover:underline font-bold">
              Change files
            </button>
          </div>

          {countMismatch && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-amber-600 text-[11px] font-bold rounded-xl">
              Page counts differ — Document A has {pagesA.length} page(s), Document B has {pagesB.length}.
            </div>
          )}

          {(errorA || errorB) && (
            <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[11px] font-bold rounded-xl">
              {errorA || errorB}
            </div>
          )}

          {(loadingA || loadingB) && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-semibold">Rendering both documents...</p>
            </div>
          )}

          {bothLoaded && mode === 'side' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-panel border border-border rounded-2xl p-4 flex flex-col items-center">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-3 self-start">A · {filesA[0].name}</p>
                {pagesA[pageIdx] ? (
                  <img src={pagesA[pageIdx]} alt={`A page ${pageIdx + 1}`} className="w-full h-auto object-contain rounded-lg border border-border" />
                ) : (
                  <div className="py-16 text-xs text-muted-foreground font-medium">No page {pageIdx + 1} in this document</div>
                )}
              </div>
              <div className="glass-panel border border-border rounded-2xl p-4 flex flex-col items-center">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-3 self-start">B · {filesB[0].name}</p>
                {pagesB[pageIdx] ? (
                  <img src={pagesB[pageIdx]} alt={`B page ${pageIdx + 1}`} className="w-full h-auto object-contain rounded-lg border border-border" />
                ) : (
                  <div className="py-16 text-xs text-muted-foreground font-medium">No page {pageIdx + 1} in this document</div>
                )}
              </div>
            </div>
          )}

          {bothLoaded && mode === 'overlay' && (
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <div className="space-y-1 max-w-md mx-auto w-full">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">
                  Overlay opacity of B ({(overlayOpacity * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="relative max-w-md mx-auto w-full border border-border rounded-lg overflow-hidden bg-white">
                {pagesA[pageIdx] && (
                  <img src={pagesA[pageIdx]} alt={`A page ${pageIdx + 1}`} className="w-full h-auto object-contain" />
                )}
                {pagesB[pageIdx] && (
                  <img
                    src={pagesB[pageIdx]}
                    alt={`B page ${pageIdx + 1}`}
                    style={{ opacity: overlayOpacity }}
                    className="absolute inset-0 w-full h-full object-contain mix-blend-difference"
                  />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center font-medium">
                Differences appear highlighted where the two pages do not match.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
