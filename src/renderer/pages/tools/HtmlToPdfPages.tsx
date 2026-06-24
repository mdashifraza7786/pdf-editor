import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface HtmlToPdfPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function HtmlToPdfPages({ onBack }: HtmlToPdfPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal' | 'Tabloid'>('A4');
  const [landscape, setLandscape] = useState(false);
  const [printBackground, setPrintBackground] = useState(true);

  const fileSelected = files[0]?.path || null;

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
    if (!fileSelected) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/HtmlToPdf_${Date.now()}.pdf`;
      const res = await window.electronAPI.convertHtmlToPdf(fileSelected, outFilePath, {
        pageSize,
        landscape,
        printBackground,
      });
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during HTML conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="HTML Converted to PDF Successfully"
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
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={onBack}
          className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">HTML to PDF Converter</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Offline Rendering Engine</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['html', 'htm']} maxFiles={1} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="text-center p-4 bg-secondary/35 rounded-xl border border-border space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <Globe className="w-4 h-4 text-primary animate-pulse" />
              Render Local HTML to PDF
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Uses the built-in Chromium engine to render your HTML file (with its CSS) into a print-ready PDF. No external server or internet needed.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Source File</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">{files[0].name}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                  <option value="Tabloid">Tabloid</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Orientation</label>
                <select
                  value={landscape ? 'landscape' : 'portrait'}
                  onChange={(e) => setLandscape(e.target.value === 'landscape')}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={printBackground}
                onChange={(e) => setPrintBackground(e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              Print background graphics & colors
            </label>

            <div className="space-y-2">
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
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[10px] font-bold rounded-xl leading-normal">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleExecute}
              disabled={isProcessing}
              className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Rendering...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Convert to PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
