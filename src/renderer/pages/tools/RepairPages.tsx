import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wrench, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface RepairPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function RepairPages({ onBack, license }: RepairPagesProps) {
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
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Repaired_${Date.now()}.pdf`;
      const res = await window.electronAPI.repairPDF(fileSelected!, outFilePath);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during PDF repair.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Repaired Successfully"
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
          <h2 className="text-xl font-bold text-foreground">Repair PDF</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Local Processing Wizard</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} maxFiles={1} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="text-center p-4 bg-secondary/35 rounded-xl border border-border space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <Wrench className="w-4 h-4 text-primary animate-bounce" />
              Repair Corrupted PDF
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              We will rebuild the PDF cross-reference table and rebuild catalog files. Standard structures will be restored using bundled Ghostscript parameters.
            </p>
          </div>

          <div className="space-y-4">
            {/* FILE DISPLAY */}
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

            {errorMsg && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[10px] font-bold rounded-xl">
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
                  Repairing...
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  Repair PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
