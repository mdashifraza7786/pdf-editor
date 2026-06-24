import React, { useState, useEffect } from 'react';
import { ArrowLeft, Type, Loader2, Image as ImageIcon } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import usePdfRenderer from './shared/usePdfRenderer';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface WatermarkPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

export default function WatermarkPages({ onBack, license }: WatermarkPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Watermark options
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmImagePath, setWmImagePath] = useState('');
  const [wmImagePreview, setWmImagePreview] = useState(''); // dataURL for preview
  const [wmOpacity, setWmOpacity] = useState(0.4);
  const [wmPosition, setWmPosition] = useState<'center' | 'top-right' | 'bottom-left' | 'top-left' | 'bottom-right'>('center');
  const [wmFontSize, setWmFontSize] = useState(40);
  const [wmRotation, setWmRotation] = useState(45);

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

  const selectWatermarkImage = async () => {
    try {
      const paths = await window.electronAPI.openFiles([
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
      ]);
      if (paths && paths[0]) {
        const imgPath = paths[0];
        setWmImagePath(imgPath);

        // Convert image file to preview base64
        const binary = await window.electronAPI.readBinaryFile(imgPath);
        let binaryString = '';
        for (let i = 0; i < binary.length; i++) {
          binaryString += String.fromCharCode(binary[i]);
        }
        const b64 = window.btoa(binaryString);
        const ext = imgPath.split('.').pop() || 'png';
        setWmImagePreview(`data:image/${ext};base64,${b64}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecute = async () => {
    if (wmType === 'image' && !wmImagePath) {
      setErrorMsg('Please select a watermark image file.');
      return;
    }
    if (wmType === 'text' && !wmText.trim()) {
      setErrorMsg('Please enter watermark text.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Watermarked_${Date.now()}.pdf`;
      const res = await window.electronAPI.addWatermark(fileSelected!, outFilePath, {
        type: wmType,
        text: wmText,
        imagePath: wmImagePath,
        opacity: wmOpacity,
        position: wmPosition,
        fontSize: wmFontSize,
      });
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred adding watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert position option to flex alignment classes
  const getPositionClasses = () => {
    const classes = {
      'center': 'items-center justify-center',
      'top-left': 'items-start justify-start p-6',
      'top-right': 'items-start justify-end p-6',
      'bottom-left': 'items-end justify-start p-6',
      'bottom-right': 'items-end justify-end p-6',
    };
    return classes[wmPosition] || 'items-center justify-center';
  };

  if (successPath) {
    return (
      <ResultScreen
        title="Watermark Applied Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setWmImagePath('');
          setWmImagePreview('');
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
          <h2 className="text-xl font-bold text-foreground">Add Watermark</h2>
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
                Live Preview Overlay (Page 1)
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

                {/* Absolute overlay for watermark preview */}
                <div className={`absolute inset-0 flex select-none pointer-events-none ${getPositionClasses()}`}>
                  {wmType === 'text' ? (
                    <div
                      style={{
                        transform: `rotate(${wmRotation}deg)`,
                        opacity: wmOpacity,
                        fontSize: `${wmFontSize * 0.4}px`, // scaled for thumbnail preview
                        transition: 'all 0.15s ease-in-out',
                      }}
                      className="font-extrabold text-gray-500 tracking-wider whitespace-nowrap"
                    >
                      {wmText || 'PREVIEW'}
                    </div>
                  ) : (
                    wmImagePreview && (
                      <img
                        src={wmImagePreview}
                        alt="Watermark image preview"
                        style={{
                          opacity: wmOpacity,
                          transform: `rotate(${wmRotation}deg)`,
                          maxHeight: '30%',
                          maxWidth: '40%',
                          transition: 'all 0.15s ease-in-out',
                        }}
                        className="object-contain"
                      />
                    )
                  )}
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
                Watermark Options
              </h3>

              {/* WATERMARK TYPE */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWmType('text')}
                  className={`flex-1 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    wmType === 'text'
                      ? 'bg-primary border-primary text-white'
                      : 'bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setWmType('image')}
                  className={`flex-1 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    wmType === 'image'
                      ? 'bg-primary border-primary text-white'
                      : 'bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Image
                </button>
              </div>

              {/* CONFIG FIELDS FOR TEXT */}
              {wmType === 'text' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Watermark Text</label>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Font Size ({wmFontSize}px)</label>
                    <input
                      type="range"
                      min={12}
                      max={120}
                      value={wmFontSize}
                      onChange={(e) => setWmFontSize(parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              ) : (
                /* CONFIG FIELDS FOR IMAGE */
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Stamp Image</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        placeholder="No image selected"
                        value={wmImagePath ? wmImagePath.split(/[/\\]/).pop() : ''}
                        className="flex-1 px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground truncate shadow-sm outline-none"
                      />
                      <button
                        onClick={selectWatermarkImage}
                        className="px-3 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl text-xs font-bold transition-all text-foreground shadow-sm"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* COMMON OPTIONS */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Position</label>
                  <select
                    value={wmPosition}
                    onChange={(e) => setWmPosition(e.target.value as any)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  >
                    <option value="center">Center</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Opacity ({(wmOpacity * 100).toFixed(0)}%)</label>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Rotation ({wmRotation}°)</label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={wmRotation}
                    onChange={(e) => setWmRotation(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
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
                disabled={isProcessing || pdfLoading || (wmType === 'image' && !wmImagePath)}
                className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Stamping...
                  </>
                ) : (
                  <>
                    <Type className="w-3.5 h-3.5" />
                    Add Watermark
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
