import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Loader2, Info } from 'lucide-react';
import FileSelector from '../../components/FileSelector';
import ResultScreen from './shared/ResultScreen';
import { extractPdfText } from './shared/extractText';
import { renderPdfPagesToJpeg, getPageCount } from './shared/renderHighRes';
import { LicenseStatus } from '../../types';

type Target = 'word' | 'powerpoint' | 'excel';

interface PdfToOfficePagesProps {
  onBack: () => void;
  license: LicenseStatus;
  target: Target;
}

const META: Record<Target, { title: string; label: string; ext: string }> = {
  word: { title: 'PDF to Word Converter', label: 'Word document', ext: 'docx' },
  powerpoint: { title: 'PDF to PowerPoint Converter', label: 'PowerPoint presentation', ext: 'pptx' },
  excel: { title: 'PDF to Excel Converter', label: 'Excel spreadsheet', ext: 'xlsx' },
};

export default function PdfToOfficePages({ onBack, target }: PdfToOfficePagesProps) {
  const meta = META[target];
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successPath, setSuccessPath] = useState<string | null>(null);
  // Word only: 'exact' embeds page images (preserves layout), 'editable' extracts text
  const [wordMode, setWordMode] = useState<'exact' | 'editable'>('exact');

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
    setStatusMsg('');
    try {
      const baseName = (files[0].name || 'document').replace(/\.[^/.]+$/, '');
      const outFilePath = `${outputPath}/${baseName}_converted.${meta.ext}`;

      if (target === 'powerpoint') {
        setStatusMsg('Rendering slides...');
        const pageCount = await getPageCount(fileSelected);
        const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
        const rendered = await renderPdfPagesToJpeg(fileSelected, pageNumbers, 2, 0.9);
        const res = await window.electronAPI.convertPdfToOffice(target, outFilePath, {
          sourcePath: fileSelected,
          images: rendered.map((r) => ({ base64: r.base64Data, width: r.width, height: r.height })),
        });
        if (res.success && res.outputPath) setSuccessPath(res.outputPath);
        return;
      }

      if (target === 'word' && wordMode === 'exact') {
        // Embed each page as a full-page image — preserves layout exactly.
        setStatusMsg('Rendering pages...');
        const pageCount = await getPageCount(fileSelected);
        const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
        const rendered = await renderPdfPagesToJpeg(fileSelected, pageNumbers, 2.5, 0.92);
        const res = await window.electronAPI.convertPdfToOffice(target, outFilePath, {
          sourcePath: fileSelected,
          mode: 'exact',
          images: rendered.map((r) => ({ base64: r.base64Data, width: r.width, height: r.height })),
        });
        if (res.success && res.outputPath) setSuccessPath(res.outputPath);
        return;
      }

      // Editable text path (Word editable mode + Excel): use the text layer, OCR if absent.
      setStatusMsg('Extracting text...');
      let pages = await extractPdfText(fileSelected);
      const totalChars = pages.reduce((sum, p) => sum + p.lines.join('').length, 0);

      if (totalChars < 10) {
        setStatusMsg('No text layer found — running OCR (this may take a moment)...');
        const pageCount = await getPageCount(fileSelected);
        const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
        const rendered = await renderPdfPagesToJpeg(fileSelected, pageNumbers, 2.5, 0.92);
        const texts = await window.electronAPI.ocrImageTexts(rendered.map((r) => r.base64Data));
        pages = texts.map((t) => ({
          lines: t.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.length > 0),
        }));
      }

      setStatusMsg('Building document...');
      const res = await window.electronAPI.convertPdfToOffice(target, outFilePath, {
        sourcePath: fileSelected,
        mode: 'editable',
        pages,
      });
      if (res.success && res.outputPath) {
        setSuccessPath(res.outputPath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during conversion.');
    } finally {
      setIsProcessing(false);
      setStatusMsg('');
    }
  };

  if (successPath) {
    return (
      <ResultScreen
        title={`Converted to ${meta.label} Successfully`}
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
          <h2 className="text-xl font-bold text-foreground">{meta.title}</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Local Processing</p>
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
              <FileText className="w-4 h-4 text-primary animate-pulse" />
              Reverse Conversion (.{meta.ext})
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {target === 'powerpoint'
                ? 'Each PDF page becomes a slide image. Runs fully offline with no extra software required.'
                : target === 'word'
                ? 'Converts your PDF to Word offline. Choose exact layout (preserves everything) or editable text below.'
                : `Extracts the text from your PDF into an editable ${meta.label}. Runs fully offline with no extra software required.`}
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Source Document</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">{files[0].name}</p>
            </div>

            {target === 'word' && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Conversion Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWordMode('exact')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      wordMode === 'exact'
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">Exact layout</p>
                    <p className="text-[10px] leading-snug mt-0.5">Looks identical to the PDF. Best fidelity. Not text-editable.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordMode('editable')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      wordMode === 'editable'
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">Editable text</p>
                    <p className="text-[10px] leading-snug mt-0.5">Fully editable text. Layout is approximate. OCR for scans.</p>
                  </button>
                </div>
              </div>
            )}

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

            <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-[10px] text-primary font-bold flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                {target === 'powerpoint'
                  ? 'Slides are built from page images, so they look identical to the PDF but are not text-editable.'
                  : 'Scanned/image-only PDFs have no embedded text. Run the OCR tool first to make them convertible.'}
              </span>
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
                  {statusMsg || 'Converting...'}
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Convert PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
