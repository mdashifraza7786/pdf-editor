import React, { useState, useEffect } from 'react';
import { ArrowLeft, ScanText, Loader2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface OcrPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function OcrPages({ onBack, license }: OcrPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
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

  // Monitor OCR progress from main process
  useEffect(() => {
    if (isProcessing) {
      const unsub = window.electronAPI.onOcrProgress((data) => {
        setOcrStatus(data.status);
        setOcrProgress(Math.floor(data.progress * 100));
      });
      return unsub;
    }
  }, [isProcessing]);

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
    setOcrStatus('initializing');
    setOcrProgress(5);
    try {
      const outFilePath = `${outputPath}/OCR_Text_${Date.now()}.pdf`;
      const res = await window.electronAPI.runOCR(fileSelected!, outFilePath, ocrLanguage);
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during OCR.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="OCR Extracted Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setOcrProgress(0);
          setOcrStatus('');
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
          <h2 className="text-xl font-bold text-foreground">OCR PDF Text</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Offline Recognition</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf', 'png', 'jpg', 'jpeg']} maxFiles={1} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="text-center p-4 bg-secondary/35 rounded-xl border border-border space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <ScanText className="w-4 h-4 text-primary animate-pulse" />
              Optical Character Recognition
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Convert scanned documents or image attachments into searchable PDF text. All OCR processes run offline using bundled language datasets.
            </p>
          </div>

          <div className="space-y-4">
            {/* SOURCE DISPLAY */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Source Attachment</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">{files[0].name}</p>
            </div>

            {/* LANGUAGE SELECT */}
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Recognition Language</label>
              <select
                value={ocrLanguage}
                onChange={(e) => setOcrLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              >
                <option value="eng">English (eng)</option>
                <option value="spa">Spanish (spa)</option>
                <option value="fra">French (fra)</option>
                <option value="deu">German (deu)</option>
              </select>
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

            {/* PROGRESS METER */}
            {isProcessing && (
              <div className="p-4 bg-secondary/30 border border-border rounded-xl space-y-2">
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                  <span className="capitalize">{ocrStatus || 'running ocr engine'}</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

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
                  Processing OCR...
                </>
              ) : (
                <>
                  <ScanText className="w-3.5 h-3.5" />
                  Start OCR
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
