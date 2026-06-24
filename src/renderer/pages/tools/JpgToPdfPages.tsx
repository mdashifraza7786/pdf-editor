import React, { useState, useEffect } from 'react';
import { ArrowLeft, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { LicenseStatus } from '../../types';

interface JpgToPdfPagesProps {
  onBack: () => void;
  license: LicenseStatus;
}

interface ImageItem {
  id: string;
  path: string;
  name: string;
  previewUrl: string;
}

export default function JpgToPdfPages({ onBack, license }: JpgToPdfPagesProps) {
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Settings options
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('fit');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState<'none' | 'small' | 'large'>('none');

  // Auto-resolve initial output path
  useEffect(() => {
    if (files.length > 0) {
      const firstFile = files[0].path;
      const baseDir = firstFile.substring(0, firstFile.lastIndexOf(/[/\\]/.exec(firstFile)?.[0] || ''));
      setOutputPath(baseDir);
    } else {
      setImageList([]);
    }
  }, [files]);

  // Load image base64 previews
  useEffect(() => {
    let isCancelled = false;

    const loadPreviews = async () => {
      if (files.length === 0) {
        setImageList([]);
        return;
      }
      setLoadingPreviews(true);

      try {
        const list: ImageItem[] = [];

        for (const file of files) {
          if (isCancelled) return;
          const existing = imageList.find((img) => img.path === file.path);
          if (existing) {
            list.push(existing);
            continue;
          }

          const binary = await window.electronAPI.readBinaryFile(file.path);
          let binaryString = '';
          for (let i = 0; i < binary.length; i++) {
            binaryString += String.fromCharCode(binary[i]);
          }
          const b64 = window.btoa(binaryString);
          const ext = file.path.split('.').pop() || 'jpg';

          list.push({
            id: `${file.path}-${Date.now()}-${Math.random()}`,
            path: file.path,
            name: file.name,
            previewUrl: `data:image/${ext};base64,${b64}`,
          });
        }

        if (!isCancelled) {
          setImageList(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) {
          setLoadingPreviews(false);
        }
      }
    };

    loadPreviews();

    return () => {
      isCancelled = true;
    };
  }, [files]);

  const selectOutputFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) setOutputPath(path);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setImageList((prev) => prev.filter((_, i) => i !== idx));
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // DRAG & DROP
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (idx: number) => {
    if (draggedIndex === null || draggedIndex === idx) return;

    setImageList((prev) => {
      const list = [...prev];
      const [draggedItem] = list.splice(draggedIndex, 1);
      list.splice(idx, 0, draggedItem);
      return list;
    });

    setDraggedIndex(null);
  };

  const handleExecute = async () => {
    if (imageList.length === 0) {
      setErrorMsg('No images selected.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const outFilePath = `${outputPath}/Images_Combined_${Date.now()}.pdf`;
      const paths = imageList.map((img) => img.path);
      const res = await window.electronAPI.convertJpgToPdf(paths, outFilePath, {
        pageSize,
        orientation,
        margin,
      });
      if (res.success) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during image compilation.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title="Images Converted to PDF Successfully"
        outputPath={successPath}
        onReset={() => {
          setFiles([]);
          setSuccessPath(null);
          setImageList([]);
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
          <h2 className="text-xl font-bold text-foreground">Convert JPG/PNG to PDF</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Visual Workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: MULTI IMAGE SELECTOR & PREVIEW */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel border border-border rounded-2xl p-6">
            <FileSelector files={files} setFiles={setFiles} allowedExtensions={['jpg', 'jpeg', 'png']} />
          </div>

          {files.length > 0 && (
            <div className="glass-panel border border-border rounded-2xl p-6 min-h-[400px] flex flex-col">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-4">
                Drag images to arrange their order inside the PDF
              </h3>

              {loadingPreviews && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground font-semibold">Generating image thumbnails...</p>
                </div>
              )}

              {!loadingPreviews && imageList.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground font-medium text-xs">
                  All images removed. Add more image files to begin.
                </div>
              )}

              {!loadingPreviews && imageList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  {imageList.map((item, idx) => {
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        className={`relative group cursor-grab active:cursor-grabbing border rounded-xl overflow-hidden shadow-sm bg-card hover:border-primary/50 transition-all duration-200 ${
                          draggedIndex === idx ? 'opacity-40 border-dashed border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        {/* Image preview */}
                        <div className="w-full aspect-[3/4] flex items-center justify-center p-2.5 overflow-hidden">
                          <img src={item.previewUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                        </div>

                        {/* Hover Delete Panel */}
                        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                          <button
                            onClick={(e) => handleDelete(idx, e)}
                            className="p-2.5 rounded-full bg-card border border-border hover:border-rose-500 text-foreground hover:text-rose-500 shadow transition-colors"
                            title="Remove Image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Label displaying order index and file name */}
                        <div className="p-1.5 bg-secondary/40 border-t border-border text-[9px] text-muted-foreground px-2 flex flex-col justify-center min-w-0">
                          <span className="font-extrabold text-foreground truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="font-medium mt-0.5">
                            Page: {idx + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT CONFIG SIDEBAR */}
        <div className="space-y-6">
          <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border pb-2.5">
              Layout Options
            </h3>

            {/* PAGE SIZE */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as any)}
                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              >
                <option value="fit">Fit (Same as Image dimensions)</option>
                <option value="a4">Standard A4 (595x841 pts)</option>
                <option value="letter">US Letter (612x792 pts)</option>
              </select>
            </div>

            {/* ORIENTATION */}
            {pageSize !== 'fit' && (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Orientation</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            )}

            {/* MARGIN */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Margins</label>
              <select
                value={margin}
                onChange={(e) => setMargin(e.target.value as any)}
                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              >
                <option value="none">No Margin (0 pts)</option>
                <option value="small">Small Margin (20 pts)</option>
                <option value="large">Large Margin (40 pts)</option>
              </select>
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
              disabled={isProcessing || loadingPreviews || imageList.length === 0}
              className="w-full py-3 bg-primary hover:opacity-95 disabled:bg-secondary text-primary-foreground disabled:text-muted-foreground/50 border border-transparent disabled:border-border rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  Convert to PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
