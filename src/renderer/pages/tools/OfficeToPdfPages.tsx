import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileSpreadsheet, Loader2, Info } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface OfficeToPdfPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function OfficeToPdfPages({ onBack, license }: OfficeToPdfPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const fileSelected = files[0]?.path || null;

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
    if (!fileSelected) return;

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await window.electronAPI.convertOfficeToPdf(fileSelected, outputPath);
      if (res.success && res.outputPath) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during Office conversion. Make sure LibreOffice paths are correct in settings.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="Office Document Converted Successfully"
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
          <h2 className="text-xl font-bold text-foreground">Office to PDF Converter</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Local Processing</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector
            files={files}
            setFiles={setFiles}
            allowedExtensions={['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'html']}
            maxFiles={1}
          />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="text-center p-4 bg-secondary/35 rounded-xl border border-border space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary animate-pulse" />
              Office Document Compiler
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Convert Word documents, Excel tables, PowerPoint slides, plain text, and HTML templates to standard PDF format offline using LibreOffice headless.
            </p>
          </div>

          <div className="space-y-4">
            {/* SOURCE DISPLAY */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Source Document</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">{files[0].name}</p>
            </div>

            {/* SAVE DIRECTORY */}
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

            {/* ADVISORY BOX */}
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-[10px] text-primary font-bold flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                Note: Office files require the LibreOffice binary. The app will search standard path directories automatically. You can review customized directories under Settings &gt; Advanced if needed.
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[10px] font-bold rounded-xl leading-normal">
                {errorMsg}
              </div>
            )}

            {/* PRIMARY ACTION */}
            <button
              onClick={handleExecute}
              disabled={isProcessing}
              className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running Local LibreOffice...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
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
