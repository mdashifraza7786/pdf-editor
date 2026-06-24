import React, { useEffect, useState } from 'react';
import { HistoryRecord } from '../types';
import { CheckCircle2, XCircle, Copy, FolderOpen, Calendar, Eye, MapPin } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const records = await window.electronAPI.getHistory();
      setHistory(records);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFileName = (fullPath: string) => {
    return fullPath.split(/[/\\]/).pop() || fullPath;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="pb-2 border-b border-border">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Operation Logs</h2>
        <p className="text-xs text-muted-foreground mt-1.5 font-bold leading-relaxed">
          Local auditing database of your file operations and conversions.
        </p>
      </div>

      {/* TIMELINE LIST */}
      {history.length > 0 ? (
        <div className="glass-panel border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">
                <th className="px-6 py-4">Tool Name</th>
                <th className="px-6 py-4">Input Documents</th>
                <th className="px-6 py-4">Saved Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Processed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm font-medium">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/20 transition-colors duration-150">
                  {/* Tool */}
                  <td className="px-6 py-4.5 text-foreground font-bold truncate max-w-[150px]">
                    {row.tool_name}
                  </td>

                  {/* Inputs */}
                  <td className="px-6 py-4.5 max-w-[200px]">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {row.input_files.map((file, idx) => (
                        <span key={idx} className="text-xs text-muted-foreground truncate block hover:text-foreground" title={file}>
                          {getFileName(file)}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Output */}
                  <td className="px-6 py-4.5 max-w-[250px]">
                    <div className="flex items-center gap-1.5 group overflow-hidden">
                      <span className="text-xs text-muted-foreground truncate block flex-1 font-mono text-[10px]" title={row.output_file}>
                        {getFileName(row.output_file)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        {row.status === 'SUCCESS' && (
                          <>
                            <button
                              onClick={() => window.electronAPI.openPath(row.output_file)}
                              className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                              title="View Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => window.electronAPI.locateFile(row.output_file)}
                              className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                              title="Locate in folder"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => copyToClipboard(row.output_file, row.id)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                          title="Copy saved path"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4.5 shrink-0">
                    {row.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs bg-emerald-500/5 px-2.5 py-1 rounded-md border border-emerald-500/25 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Success
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-rose-600 text-xs bg-rose-500/5 px-2.5 py-1 rounded-md border border-rose-500/25 shadow-sm w-fit">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          Failed
                        </span>
                        {row.error_message && (
                          <span className="text-[10px] text-muted-foreground font-medium max-w-[180px] line-clamp-1" title={row.error_message}>
                            {row.error_message}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="px-6 py-4.5 text-right font-bold text-muted-foreground text-xs tracking-wide uppercase shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <Calendar className="w-3 h-3 text-muted-foreground/60" />
                      {formatDate(row.timestamp)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-border rounded-2xl bg-card shadow-sm">
          <FolderOpen className="w-10 h-10 text-muted-foreground/60 mb-4" />
          <p className="text-foreground font-bold text-sm">Your log audit trail is empty</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
            Once you execute any PDF tool, details will appear in this database log.
          </p>
        </div>
      )}
    </div>
  );
}
