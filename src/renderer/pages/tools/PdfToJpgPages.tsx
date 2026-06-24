import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileImage, Loader2, Check, Square, CheckSquare } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import { renderPdfPagesToJpeg } from './shared/renderHighRes';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface PdfToJpgPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function PdfToJpgPages({ onBack, license }: PdfToJpgPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successFiles, setSuccessFiles] = useState<string[] | null>(null);

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  // Auto-resolve initial output path and select all pages by default
  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
    }
  }, [fileSelected]);

  // Set all pages selected when pages finish loading
  useEffect(() => {
    if (pages.length > 0) {
      const allPages = new Set(Array.from({ length: pages.length }, (_, i) => i + 1));
      setSelectedPages(allPages);
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

  const togglePage = (pageIndex1Based: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex1Based)) {
        next.delete(pageIndex1Based);
      } else {
        next.add(pageIndex1Based);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPages.size === pages.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(Array.from({ length: pages.length }, (_, i) => i + 1)));
    }
  };

  const handleExecute = async () => {
    if (selectedPages.size === 0) {
      setErrorMsg('Please select at least one page to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      // Render the selected pages fresh at high resolution rather than reusing
      // the low-res preview thumbnails, so exported images are sharp.
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      const pagesToConvert = await renderPdfPagesToJpeg(fileSelected!, sortedPages, 3);

      const res = await window.electronAPI.saveRenderedPages(fileSelected!, pagesToConvert, outputPath);
      if (res.success && res.outputFiles) {
        setSuccessFiles(res.outputFiles);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during image conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successFiles) {
    return (
      <ResultScreen
        title="PDF Converted to JPG Successfully"
        outputFiles={successFiles}
        onReset={() => {
          setFiles([]);
          setSuccessFiles(null);
          setSelectedPages(new Set());
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
          <h2 className="text-xl font-bold text-foreground">PDF to JPG Converter</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} maxFiles={1} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* MAIN PREVIEW GRID */}
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                Select Pages to Convert
              </h3>
              {!pdfLoading && pages.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                >
                  {selectedPages.size === pages.length ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      Select All
                    </>
                  )}
                </button>
              )}
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

                  return (
                    <div
                      key={idx}
                      onClick={() => togglePage(pageNum)}
                      className={`relative group cursor-pointer border rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/45 bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <img src={dataUrl} alt={`Page ${pageNum}`} className="w-full h-auto object-contain p-2" />

                      {/* Checkmark Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Page Badge Label */}
                      <div className={`p-1.5 text-center text-[10px] font-bold border-t ${
                        isSelected
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-secondary/40 text-muted-foreground border-border'
                      }`}>
                        Page {pageNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Convert Options
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Total Pages</span>
                  <span className="font-bold text-foreground">{pages.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground font-medium">Pages to Convert</span>
                  <span className="font-bold text-primary">{selectedPages.size}</span>
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
                disabled={isProcessing || pdfLoading || selectedPages.size === 0}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <FileImage className="w-3.5 h-3.5" />
                    Convert to JPG
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
