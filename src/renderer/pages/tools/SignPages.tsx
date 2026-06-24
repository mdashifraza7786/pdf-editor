import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, PenTool, Loader2, Image as ImageIcon } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface SignPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function SignPages({ onBack }: SignPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const [sigImagePath, setSigImagePath] = useState('');
  const [sigPreview, setSigPreview] = useState('');
  const [sigAspect, setSigAspect] = useState(3); // width/height
  const [sigWidthRatio, setSigWidthRatio] = useState(0.25);
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  // placement center in ratios from top-left of preview
  const [placement, setPlacement] = useState<{ cx: number; cy: number }>({ cx: 0.75, cy: 0.85 });

  const previewRef = useRef<HTMLDivElement>(null);

  const fileSelected = files[0]?.path || null;
  const { pages, loading: pdfLoading, error: pdfError } = usePdfRenderer(fileSelected);

  useEffect(() => {
    if (fileSelected) {
      const baseDir = fileSelected.substring(0, fileSelected.lastIndexOf(/[/\\]/.exec(fileSelected)?.[0] || ''));
      setOutputPath(baseDir);
      setSelectedPageIdx(0);
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

  const selectSignatureImage = async () => {
    try {
      const paths = await window.electronAPI.openFiles([
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
      ]);
      if (paths && paths[0]) {
        const imgPath = paths[0];
        setSigImagePath(imgPath);
        const binary = await window.electronAPI.readBinaryFile(imgPath);
        let binaryString = '';
        for (let i = 0; i < binary.length; i++) {
          binaryString += String.fromCharCode(binary[i]);
        }
        const b64 = window.btoa(binaryString);
        const ext = imgPath.split('.').pop() || 'png';
        const dataUrl = `data:image/${ext};base64,${b64}`;
        setSigPreview(dataUrl);
        const probe = new Image();
        probe.onload = () => {
          if (probe.naturalHeight > 0) setSigAspect(probe.naturalWidth / probe.naturalHeight);
        };
        probe.src = dataUrl;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    if (!previewRef.current || !sigPreview) return;
    const rect = previewRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    setPlacement({ cx: Math.min(1, Math.max(0, cx)), cy: Math.min(1, Math.max(0, cy)) });
  };

  const handleExecute = async () => {
    if (!sigImagePath) {
      setErrorMsg('Please select a signature image first.');
      return;
    }
    if (!previewRef.current) return;

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const rect = previewRef.current.getBoundingClientRect();
      // signature dimensions in container ratios
      const sigWPx = sigWidthRatio * rect.width;
      const sigHPx = sigWPx / sigAspect;
      const sigHRatio = sigHPx / rect.height;

      // convert center (top-left origin) -> bottom-left box origin in pdf coords
      const leftRatio = placement.cx - sigWidthRatio / 2;
      const topRatio = placement.cy - sigHRatio / 2;
      const x = Math.min(1, Math.max(0, leftRatio));
      const y = Math.min(1, Math.max(0, 1 - topRatio - sigHRatio));

      const outFilePath = `${outputPath}/Signed_${Date.now()}.pdf`;
      const res = await window.electronAPI.signPDF(fileSelected!, outFilePath, {
        imagePath: sigImagePath,
        pageIndex: selectedPageIdx,
        x,
        y,
        widthRatio: sigWidthRatio,
      });
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while signing the PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="PDF Signed Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setSigImagePath('');
          setSigPreview('');
        }}
      />
    );
  }

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
          <h2 className="text-xl font-bold text-foreground">Sign PDF</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto glass-panel border border-border rounded-2xl p-8">
          <FileSelector files={files} setFiles={setFiles} allowedExtensions={['pdf']} maxFiles={1} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* PREVIEW */}
          <div className="lg:col-span-3 glass-panel border border-border rounded-2xl p-6 min-h-[500px] flex flex-col items-center justify-center">
            <div className="w-full flex justify-between items-center mb-4 self-start">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                {sigPreview ? 'Click on the page to place your signature' : 'Select a signature image to begin'}
              </h3>
            </div>

            {pdfLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">Generating page preview...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-primary font-bold">
                <p className="text-sm">{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && pages.length > 0 && (
              <div
                ref={previewRef}
                onClick={handlePreviewClick}
                className={`relative border border-border rounded-xl bg-card shadow-lg max-w-md w-full overflow-hidden ${sigPreview ? 'cursor-crosshair' : ''}`}
              >
                <img
                  src={pages[selectedPageIdx]}
                  alt="Page Preview"
                  className="w-full h-auto object-contain select-none pointer-events-none"
                />
                {sigPreview && (
                  <img
                    src={sigPreview}
                    alt="Signature"
                    style={{
                      position: 'absolute',
                      left: `${placement.cx * 100}%`,
                      top: `${placement.cy * 100}%`,
                      width: `${sigWidthRatio * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="object-contain pointer-events-none drop-shadow"
                  />
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="space-y-6">
            <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
                Signature Options
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Signature Image</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="No image selected"
                    value={sigImagePath ? sigImagePath.split(/[/\\]/).pop() : ''}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground truncate shadow-sm outline-none"
                  />
                  <button
                    onClick={selectSignatureImage}
                    className="px-3 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold transition-all text-foreground shadow-sm flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Browse
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Target Page</label>
                <select
                  value={selectedPageIdx}
                  onChange={(e) => setSelectedPageIdx(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  {pages.map((_, i) => (
                    <option key={i} value={i}>Page {i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Signature Width ({(sigWidthRatio * 100).toFixed(0)}%)</label>
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.01}
                  value={sigWidthRatio}
                  onChange={(e) => setSigWidthRatio(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

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

              <button
                onClick={handleExecute}
                disabled={isProcessing || pdfLoading || !sigImagePath}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <PenTool className="w-3.5 h-3.5" />
                    Sign PDF
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
