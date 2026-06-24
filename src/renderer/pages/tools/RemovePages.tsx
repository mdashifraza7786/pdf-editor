import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface RemovePagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function RemovePages({ onBack, license }: RemovePagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [removedPages, setRemovedPages] = useState<Set<number>>(new Set());
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
      setRemovedPages(new Set()); // Reset selections
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

  const togglePage = (pageIndex1Based: number) => {
    setRemovedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex1Based)) {
        next.delete(pageIndex1Based);
      } else {
        next.add(pageIndex1Based);
      }
      return next;
    });
  };

  const handleExecute = async () => {
    if (removedPages.size === 0) {
      setErrorMsg('Please select at least one page to remove.');
      return;
    }
    if (removedPages.size === pages.length) {
      setErrorMsg('Cannot remove all pages. At least one page must remain.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Pages_Removed_${Date.now()}.pdf`;
      const sortedPagesToRemove = Array.from(removedPages).sort((a, b) => a - b);
      const res = await window.electronAPI.removePages(fileSelected!, sortedPagesToRemove, outFilePath);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during removal.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="Pages Removed Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setRemovedPages(new Set());
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
          <h2 className="text-xl font-bold text-foreground">Remove PDF Pages</h2>
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
              Select Pages to Delete
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
                  const isRemoved = removedPages.has(pageNum);

                  return (
                    <div
                      key={idx}
                      onClick={() => togglePage(pageNum)}
                      className={`relative group cursor-pointer border rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${
                        isRemoved
                          ? 'border-rose-500 ring-2 ring-rose-500 bg-rose-500/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <img src={dataUrl} alt={`Page ${pageNum}`} className="w-full h-auto object-contain p-2" />

                      {/* Overlays */}
                      {isRemoved && (
                        <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center transition-opacity">
                          <div className="p-2.5 rounded-full bg-rose-600 text-white shadow">
                            <Trash2 className="w-5 h-5" />
                          </div>
                        </div>
                      )}

                      {/* Page Badge Label */}
                      <div className={`p-1.5 text-center text-[10px] font-bold border-t ${
                        isRemoved
                          ? 'bg-rose-500/20 text-rose-700 border-rose-500/30'
                          : 'bg-secondary/40 text-muted-foreground border-border'
                      }`}>
                        Page {pageNum}
                      </div>

                      {/* Top Right Corner Badge */}
                      {isRemoved && (
                        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow">
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
                Removal Options
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Total Pages</span>
                  <span className="font-bold text-foreground">{pages.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Pages to Remove</span>
                  <span className="font-bold text-rose-600">{removedPages.size}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Pages Remaining</span>
                  <span className="font-bold text-foreground">{pages.length - removedPages.size}</span>
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
                disabled={isProcessing || pdfLoading || removedPages.size === 0}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Pages
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
