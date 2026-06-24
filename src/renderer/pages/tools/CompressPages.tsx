import React, { useState, useEffect } from 'react';
import { ArrowLeft, Minimize, Loader2, Info } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface CompressPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function CompressPages({ onBack, license }: CompressPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [compressLevel, setCompressLevel] = useState<'extreme' | 'recommended' | 'low'>('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ path: string; size: number } | null>(null);

  const fileSelected = files[0]?.path || null;
  const originalSize = files[0]?.size || 0;
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

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const handleExecute = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Compressed_${Date.now()}.pdf`;
      const res = await window.electronAPI.compressPDF(fileSelected!, outFilePath, compressLevel);
      if (res.success) {
        setSuccessData({ path: res.outputPath, size: (res as any).size || 0 });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during compression.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successData) {
    const savings = originalSize > 0 && successData.size > 0 
      ? Math.max(0, ((originalSize - successData.size) / originalSize) * 100)
      : 0;

    return (
      <div className="space-y-6 max-w-2xl mx-auto py-8">
        <ResultScreen
          title="PDF Compressed Successfully"
          outputPath={successData.path}
          onReset={() => {
            setFiles([]);
            setSuccessData(null);
          }}
        />

        <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Compression Statistics</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-secondary/35 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground font-bold">Before Size</p>
              <p className="text-base font-bold text-foreground mt-1">{formatSize(originalSize)}</p>
            </div>
            <div className="p-3 bg-secondary/35 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground font-bold">After Size</p>
              <p className="text-base font-bold text-primary mt-1">{formatSize(successData.size)}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-[10px] text-primary font-bold">Disk Space Saved</p>
              <p className="text-base font-bold text-primary mt-1">{savings.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
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
          <h2 className="text-xl font-bold text-foreground">Compress PDF</h2>
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
              Document Pages Preview
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
                {pages.map((dataUrl, idx) => (
                  <div key={idx} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm p-1.5">
                    <img src={dataUrl} alt={`Page ${idx + 1}`} className="w-full h-auto object-contain" />
                    <div className="p-1.5 text-center text-[10px] font-bold text-muted-foreground border-t border-border mt-1.5">
                      Page {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT CONFIG SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-5">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Compression Level
              </h3>

              {/* ORIGINAL SIZE SUMMARY */}
              <div className="p-3 bg-secondary/35 rounded-xl border border-border text-center">
                <p className="text-[10px] text-muted-foreground font-bold">Original File Size</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{formatSize(originalSize)}</p>
              </div>

              {/* RADIO SELECTION LIST */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/45 transition-colors">
                  <input
                    type="radio"
                    name="compress-level"
                    value="extreme"
                    checked={compressLevel === 'extreme'}
                    onChange={() => setCompressLevel('extreme')}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Extreme Compression</p>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">Less quality, high size reduction.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/45 transition-colors">
                  <input
                    type="radio"
                    name="compress-level"
                    value="recommended"
                    checked={compressLevel === 'recommended'}
                    onChange={() => setCompressLevel('recommended')}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Recommended Compression</p>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">Good quality and high compression.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/45 transition-colors">
                  <input
                    type="radio"
                    name="compress-level"
                    value="low"
                    checked={compressLevel === 'low'}
                    onChange={() => setCompressLevel('low')}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Less Compression</p>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">High quality, lower size reduction.</p>
                  </div>
                </label>
              </div>

              {/* SAVE DIRECTORY */}
              <div className="space-y-2 pt-2 border-t border-border">
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
                    Compressing...
                  </>
                ) : (
                  <>
                    <Minimize className="w-3.5 h-3.5" />
                    Compress PDF
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
