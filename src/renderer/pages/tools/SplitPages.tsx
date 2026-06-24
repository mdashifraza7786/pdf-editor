import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Loader2, Plus, Trash2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface SplitPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

const BADGE_COLORS = [
  'bg-primary/10 text-primary border-primary/20',
  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'bg-rose-500/10 text-rose-600 border-rose-500/20',
];

export default function SplitPages({ onBack, license }: SplitPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [splitMode, setSplitMode] = useState<'ranges' | 'fixed' | 'extract'>('ranges');
  const [ranges, setRanges] = useState<{ start: number; end: number }[]>([{ start: 1, end: 1 }]);
  const [fixedN, setFixedN] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successFiles, setSuccessFiles] = useState<string[] | null>(null);

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  // Auto-resolve initial output path
  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
    }
  }, [fileSelected]);

  // Reset parameters when pages count changes
  useEffect(() => {
    if (pages.length > 0) {
      setRanges([{ start: 1, end: Math.min(3, pages.length) }]);
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

  // Add range row
  const addRange = () => {
    setRanges((prev) => {
      const last = prev[prev.length - 1];
      const start = last ? Math.min(last.end + 1, pages.length) : 1;
      const end = Math.min(start + 2, pages.length);
      return [...prev, { start, end }];
    });
  };

  // Delete range row
  const deleteRange = (idx: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRange = (idx: number, key: 'start' | 'end', val: number) => {
    const safeVal = Math.max(1, Math.min(pages.length, val));
    setRanges((prev) =>
      prev.map((r, i) => {
        if (i === idx) {
          return { ...r, [key]: safeVal };
        }
        return r;
      })
    );
  };

  // Compile active ranges based on current mode
  const getCompiledRanges = (): { start: number; end: number }[] => {
    if (pages.length === 0) return [];

    if (splitMode === 'extract') {
      // Every page is a separate file
      return pages.map((_, i) => ({ start: i + 1, end: i + 1 }));
    }

    if (splitMode === 'fixed') {
      const compiled: { start: number; end: number }[] = [];
      const n = Math.max(1, fixedN);
      for (let i = 1; i <= pages.length; i += n) {
        compiled.push({
          start: i,
          end: Math.min(i + n - 1, pages.length),
        });
      }
      return compiled;
    }

    return ranges;
  };

  // Find which file split range a page falls into
  const getPageSplitAssignment = (pageIndex1Based: number) => {
    const activeRanges = getCompiledRanges();
    for (let rIdx = 0; rIdx < activeRanges.length; rIdx++) {
      const { start, end } = activeRanges[rIdx];
      if (pageIndex1Based >= start && pageIndex1Based <= end) {
        return {
          fileIndex: rIdx + 1,
          badgeColor: BADGE_COLORS[rIdx % BADGE_COLORS.length],
        };
      }
    }
    return null;
  };

  const handleExecute = async () => {
    const activeRanges = getCompiledRanges();
    if (activeRanges.length === 0) {
      setErrorMsg('No split ranges configured.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await window.electronAPI.splitPDF(fileSelected!, activeRanges, outputPath);
      if (res.success) {
        setSuccessFiles(res.outputFiles);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during splitting.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successFiles) {
    return (
      <ResultScreen
        title="PDF Split Successfully"
        outputFiles={successFiles}
        onReset={() => {
          setFiles([]);
          setSuccessFiles(null);
          setRanges([{ start: 1, end: 1 }]);
        }}
      />
    );
  }

  const activeRanges = getCompiledRanges();

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
          <h2 className="text-xl font-bold text-foreground">Split PDF Document</h2>
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
            <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-4">
              Visual Page Partition Output
            </h3>

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
                  const assign = getPageSplitAssignment(pageNum);

                  return (
                    <div
                      key={idx}
                      className={`relative border rounded-xl overflow-hidden shadow-sm bg-card transition-all duration-200 ${
                        assign ? 'border-primary/45 ring-1 ring-primary/10' : 'border-border opacity-50'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <img src={dataUrl} alt={`Page ${pageNum}`} className="w-full h-auto object-contain p-2" />

                      {/* File Assignment Badge Overlay */}
                      {assign && (
                        <div className="absolute top-2 left-2 right-2">
                          <span className={`inline-block w-full text-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${assign.badgeColor} shadow-sm`}>
                            File {assign.fileIndex}
                          </span>
                        </div>
                      )}

                      {/* Page Label */}
                      <div className="p-1.5 text-center text-[10px] font-bold bg-secondary/40 text-muted-foreground border-t border-border">
                        Page {pageNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT CONFIG SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-5">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Split Settings
              </h3>

              {/* MODE SELECTOR */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Split Mode</label>
                <select
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="ranges">Split by Custom Ranges</option>
                  <option value="fixed">Split every N Pages</option>
                  <option value="extract">Extract all Pages</option>
                </select>
              </div>

              {/* RANGES MODE UI */}
              {splitMode === 'ranges' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Configure Ranges</span>
                    <button
                      onClick={addRange}
                      disabled={ranges.length >= 10 || pdfLoading}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                    >
                      <Plus className="w-3 h-3" /> Add Range
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {ranges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/20 border border-border">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="number"
                            value={range.start}
                            onChange={(e) => updateRange(idx, 'start', parseInt(e.target.value) || 1)}
                            className="w-12 px-1.5 py-1 bg-card border border-border rounded-lg text-center text-xs font-bold text-foreground"
                          />
                          <span className="text-[10px] text-muted-foreground font-bold">to</span>
                          <input
                            type="number"
                            value={range.end}
                            onChange={(e) => updateRange(idx, 'end', parseInt(e.target.value) || 1)}
                            className="w-12 px-1.5 py-1 bg-card border border-border rounded-lg text-center text-xs font-bold text-foreground"
                          />
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${BADGE_COLORS[idx % BADGE_COLORS.length]}`}>
                          File {idx + 1}
                        </span>

                        {ranges.length > 1 && (
                          <button
                            onClick={() => deleteRange(idx)}
                            className="p-1 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FIXED N PAGES MODE UI */}
              {splitMode === 'fixed' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Split Interval (Pages)</label>
                  <input
                    type="number"
                    min={1}
                    max={pages.length || 1}
                    value={fixedN}
                    onChange={(e) => setFixedN(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  />
                  <p className="text-[9px] text-muted-foreground italic leading-relaxed">
                    Example: split interval 2 generates pages [1-2], [3-4], [5-6].
                  </p>
                </div>
              )}

              {/* EXTRACT MODE SUMMARY */}
              {splitMode === 'extract' && (
                <div className="p-3 bg-secondary/40 border border-border rounded-xl text-center text-[10px] text-muted-foreground font-medium leading-relaxed">
                  Generates {pages.length} separate PDF files (1 page per file).
                </div>
              )}

              {/* INFO BADGES SUMMARY */}
              <div className="space-y-1 text-xs pt-1 border-t border-border">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground font-medium">Output files</span>
                  <span className="font-bold text-primary">{activeRanges.length} files</span>
                </div>
              </div>

              {/* SAVE DIRECTORY */}
              <div className="space-y-2 pt-1">
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
                disabled={isProcessing || pdfLoading || activeRanges.length === 0}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Splitting...
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5" />
                    Split PDF
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
