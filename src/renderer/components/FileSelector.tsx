import React, { useState } from 'react';
import { UploadCloud, FileText, Trash2, FilePlus } from 'lucide-react';

interface FileSelectorProps {
  files: { path: string; name: string; size: number }[];
  setFiles: React.Dispatch<React.SetStateAction<{ path: string; name: string; size: number }[]>>;
  allowedExtensions: string[];
  maxFiles?: number;
}

export default function FileSelector({ files, setFiles, allowedExtensions, maxFiles }: FileSelectorProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFileList = (incomingFiles: File[]) => {
    const validFiles: { path: string; name: string; size: number }[] = [];
    const filterRegex = new RegExp(`\\.(${allowedExtensions.join('|')})$`, 'i');

    for (const file of incomingFiles) {
      if (filterRegex.test(file.name)) {
        // In Electron, file objects dragged into the window contain a native 'path' property
        const nativePath = (file as any).path || file.name;
        validFiles.push({
          path: nativePath,
          name: file.name,
          size: file.size,
        });
      }
    }

    if (validFiles.length === 0) return;

    setFiles((prev) => {
      const combined = [...prev, ...validFiles];
      return maxFiles ? combined.slice(0, maxFiles) : combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileList(Array.from(e.dataTransfer.files));
    }
  };

  const selectFilesViaDialog = async () => {
    try {
      const paths = await window.electronAPI.openFiles([
        { name: 'Supported Files', extensions: allowedExtensions },
      ]);
      if (paths && paths.length > 0) {
        const fileObjects = paths.map((p) => {
          const name = p.split(/[/\\]/).pop() || p;
          return {
            path: p,
            name,
            size: 0, // native dialog returns paths, size will be fetched in main/stats if needed
          };
        });

        setFiles((prev) => {
          const combined = [...prev, ...fileObjects];
          return maxFiles ? combined.slice(0, maxFiles) : combined;
        });
      }
    } catch (err) {
      console.error('File dialog failed', err);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return 'Local File';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4 w-full">
      {/* DRAG AND DROP ZONE */}
      {files.length === 0 ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={selectFilesViaDialog}
          className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border bg-secondary/15 hover:border-primary/40 hover:bg-secondary/25'
          }`}
        >
          <div className="p-4 rounded-full bg-secondary border border-border text-muted-foreground mb-4 shadow-sm">
            <UploadCloud className="w-8 h-8 text-foreground" />
          </div>
          <p className="font-bold text-sm text-foreground">
            Drag & drop files here, or <span className="text-primary hover:underline">browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            Supported extensions: {allowedExtensions.map((e) => `.${e}`).join(', ')}
          </p>
        </div>
      ) : (
        /* FILE LIST */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">
              Selected Files ({files.length})
            </span>
            <button
              onClick={selectFilesViaDialog}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Add More
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={file.path + idx}
                className="flex items-center justify-between p-4 rounded-xl glass-panel border border-border hover:border-primary/25 transition-all duration-200"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 rounded-lg bg-secondary text-muted-foreground border border-border">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground font-extrabold tracking-wide uppercase mt-0.5">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(idx)}
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
