import React, { useState, useEffect } from 'react';
import { ArrowLeft, Binary, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface PageNumbersPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function PageNumbersPages({ onBack, license }: PageNumbersPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Page Numbers Options
  const [pnPosition, setPnPosition] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>('bottom-right');
  const [pnStartNumber, setPnStartNumber] = useState(1);
  const [pnFormat, setPnFormat] = useState<'simple' | 'page-of'>('page-of');

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  // Auto-resolve initial output path
  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
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

  const handleExecute = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Numbered_${Date.now()}.pdf`;
      const res = await window.electronAPI.addPageNumbers(fileSelected!, outFilePath, {
        position: pnPosition,
        startNumber: pnStartNumber,
        format: pnFormat,
      });
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred adding page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert position option to flex alignment classes
  const getPositionClasses = () => {
    const vertical = pnPosition.startsWith('top') ? 'items-start pt-5' : 'items-end pb-5';
    let horizontal = 'justify-center';
    if (pnPosition.endsWith('left')) {
      horizontal = 'justify-start pl-6';
    } else if (pnPosition.endsWith('right')) {
      horizontal = 'justify-end pr-6';
    }
    return `absolute inset-0 flex select-none pointer-events-none ${vertical} ${horizontal}`;
  };

  const getPreviewLabel = () => {
    if (pnFormat === 'page-of') {
      return `Page ${pnStartNumber} of ${pages.length || 1}`;
    }
    return `${pnStartNumber}`;
  };

  if (successPath) {
    return (
      <ResultScreen
        title="Page Numbers Added Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
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
          className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Add Page Numbers</h2>
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
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col items-center justify-center">
            <div className="w-full flex justify-between items-center mb-4 self-start">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                Live Page Placement Preview (Page 1)
              </h3>
            </div>

            {pdfLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">Generating page previews...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-primary font-bold">
                <p className="text-sm">{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && pages.length > 0 && (
              <div className="relative border border-border rounded-xl bg-card shadow-lg p-2 max-w-md w-full">
                {/* PDF Page image */}
                <img src={pages[0]} alt="First Page Preview" className="w-full h-auto object-contain select-none pointer-events-none" />

                {/* Absolute overlay for page number preview */}
                <div className={getPositionClasses()}>
                  <span className="px-2 py-0.5 rounded bg-foreground text-background text-[9px] font-bold shadow-sm font-mono opacity-80">
                    {getPreviewLabel()}
                  </span>
                </div>

                <div className="p-1.5 text-center text-[10px] font-bold text-muted-foreground border-t border-border mt-1.5 bg-secondary/20">
                  Page 1 of {pages.length}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT CONFIG SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Number Layout
              </h3>

              {/* PLACEMENT POSITION */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Placement Location</label>
                <select
                  value={pnPosition}
                  onChange={(e) => setPnPosition(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              {/* FORMAT */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Display Format</label>
                <select
                  value={pnFormat}
                  onChange={(e) => setPnFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="page-of">Page X of Y</option>
                  <option value="simple">Simple X</option>
                </select>
              </div>

              {/* START NUMBER */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Starting Count</label>
                <input
                  type="number"
                  min={1}
                  value={pnStartNumber}
                  onChange={(e) => setPnStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
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
                    Numbering...
                  </>
                ) : (
                  <>
                    <Binary className="w-3.5 h-3.5" />
                    Add Page Numbers
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
