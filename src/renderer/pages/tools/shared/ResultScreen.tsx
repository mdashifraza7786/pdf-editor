import React from 'react';
import { CheckCircle2, Eye, MapPin, RefreshCw } from 'lucide-react';

interface ResultScreenProps {
  title?: string;
  outputPath?: string;
  outputFiles?: string[];
  onReset: () => void;
}

export default function ResultScreen({
  title = 'Execution Completed',
  outputPath,
  outputFiles,
  onReset,
}: ResultScreenProps) {
  const handleOpen = (path: string) => {
    window.electronAPI.openPath(path);
  };

  const handleLocate = (path: string) => {
    window.electronAPI.locateFile(path);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="glass-panel border border-border rounded-2xl p-8 space-y-6 text-center shadow-sm">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="w-12 h-12 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your offline PDF operations completed successfully. The files have been written directly to your local workspace.
          </p>
        </div>

        {/* Single File Results */}
        {outputPath && (
          <div className="p-4 bg-secondary/35 rounded-xl border border-border space-y-3">
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider text-left">Saved Document Path</p>
            <div className="bg-card p-3 rounded-lg border border-border font-mono text-xs text-foreground truncate text-left shadow-inner select-all">
              {outputPath}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleOpen(outputPath)}
                className="flex-1 py-2.5 bg-card hover:bg-secondary/40 border border-border hover:border-primary/50 text-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-sm"
              >
                <Eye className="w-4 h-4 text-primary" />
                View PDF
              </button>
              <button
                onClick={() => handleLocate(outputPath)}
                className="flex-1 py-2.5 bg-card hover:bg-secondary/40 border border-border hover:border-primary/50 text-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-sm"
              >
                <MapPin className="w-4 h-4 text-primary" />
                Locate in Folder
              </button>
            </div>
          </div>
        )}

        {/* Multiple Files Results */}
        {outputFiles && outputFiles.length > 0 && (
          <div className="p-4 bg-secondary/35 rounded-xl border border-border space-y-3 text-left">
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Generated Output Files ({outputFiles.length})</p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {outputFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border shadow-sm">
                  <span className="font-mono text-xs text-foreground truncate flex-1 mr-3" title={file}>
                    {file.split(/[/\\]/).pop() || file}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpen(file)}
                      className="p-2 hover:bg-secondary border border-border/40 hover:border-primary/45 rounded-lg text-muted-foreground hover:text-primary transition-all shadow-sm"
                      title="View File"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleLocate(file)}
                      className="p-2 hover:bg-secondary border border-border/40 hover:border-primary/45 rounded-lg text-muted-foreground hover:text-primary transition-all shadow-sm"
                      title="Locate File"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border/60">
          <button
            onClick={onReset}
            className="px-6 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 mx-auto transition-all duration-200 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Start New Job
          </button>
        </div>
      </div>
    </div>
  );
}
