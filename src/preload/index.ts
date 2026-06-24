import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation helper from native menu
  onNavigate: (callback: (path: string) => void) => {
    const subscription = (_event: any, path: string) => callback(path);
    ipcRenderer.on('navigate', subscription);
    return () => {
      ipcRenderer.removeListener('navigate', subscription);
    };
  },

  // Dialog & Shell actions
  openFiles: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:open-files', filters),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
  locateFile: (path: string) => ipcRenderer.invoke('shell:locate-file', path),

  // Settings & History SQLite API
  getHistory: () => ipcRenderer.invoke('db:get-history'),
  getSetting: (key: string, defaultValue?: string) =>
    ipcRenderer.invoke('db:get-setting', key, defaultValue),
  saveSetting: (key: string, value: string) =>
    ipcRenderer.invoke('db:save-setting', key, value),
  getResolvedPaths: () => ipcRenderer.invoke('db:get-resolved-paths'),

  // License activation API
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),

  // Organize Tools
  mergePDF: (filePaths: string[], outputPath: string) =>
    ipcRenderer.invoke('tool:merge', filePaths, outputPath),
  splitPDF: (filePath: string, ranges: { start: number; end: number }[], outputFolder: string) =>
    ipcRenderer.invoke('tool:split', filePath, ranges, outputFolder),
  removePages: (filePath: string, pagesToRemove: number[], outputPath: string) =>
    ipcRenderer.invoke('tool:remove-pages', filePath, pagesToRemove, outputPath),
  extractPages: (filePath: string, pagesToExtract: number[], outputPath: string) =>
    ipcRenderer.invoke('tool:extract-pages', filePath, pagesToExtract, outputPath),
  reorderPDF: (filePath: string, newSequence: (number | { index: number; rotation?: number })[], outputPath: string) =>
    ipcRenderer.invoke('tool:reorder', filePath, newSequence, outputPath),

  // Optimize Tools
  compressPDF: (filePath: string, outputPath: string, level: 'extreme' | 'recommended' | 'low') =>
    ipcRenderer.invoke('tool:compress', filePath, outputPath, level),
  repairPDF: (filePath: string, outputPath: string) =>
    ipcRenderer.invoke('tool:repair', filePath, outputPath),
  runOCR: (filePath: string, outputPath: string, language?: string) =>
    ipcRenderer.invoke('tool:ocr', filePath, outputPath, language),
  onOcrProgress: (callback: (data: { status: string; progress: number }) => void) => {
    const subscription = (_event: any, data: { status: string; progress: number }) => callback(data);
    ipcRenderer.on('ocr:progress', subscription);
    return () => {
      ipcRenderer.removeListener('ocr:progress', subscription);
    };
  },

  // Convert Tools
  convertOfficeToPdf: (filePath: string, outputFolder: string) =>
    ipcRenderer.invoke('tool:office-to-pdf', filePath, outputFolder),
  convertJpgToPdf: (
    imagePaths: string[],
    outputPath: string,
    options: {
      orientation: 'portrait' | 'landscape';
      pageSize: 'a4' | 'letter' | 'fit';
      margin: 'none' | 'small' | 'large';
    }
  ) => ipcRenderer.invoke('tool:jpg-to-pdf', imagePaths, outputPath, options),
  saveRenderedPages: (
    pdfPath: string,
    pages: { pageNumber: number; base64Data: string }[],
    outputFolder: string
  ) => ipcRenderer.invoke('tool:save-rendered-pages', pdfPath, pages, outputFolder),

  convertPdfToOffice: (
    filePath: string,
    outputFolder: string,
    target: 'word' | 'powerpoint' | 'excel'
  ) => ipcRenderer.invoke('tool:pdf-to-office', filePath, outputFolder, target),
  convertPdfToPdfA: (filePath: string, outputPath: string) =>
    ipcRenderer.invoke('tool:pdf-to-pdfa', filePath, outputPath),
  convertHtmlToPdf: (
    filePath: string,
    outputPath: string,
    options: {
      pageSize: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
      landscape: boolean;
      printBackground: boolean;
    }
  ) => ipcRenderer.invoke('tool:html-to-pdf', filePath, outputPath, options),

  // Edit Tools
  rotatePDF: (filePath: string, outputPath: string, rotationAngle: number) =>
    ipcRenderer.invoke('tool:rotate', filePath, outputPath, rotationAngle),
  addWatermark: (
    filePath: string,
    outputPath: string,
    options: {
      type: 'text' | 'image';
      text?: string;
      imagePath?: string;
      opacity: number;
      position: 'center' | 'top-right' | 'bottom-left' | 'top-left' | 'bottom-right';
      fontSize?: number;
    }
  ) => ipcRenderer.invoke('tool:watermark', filePath, outputPath, options),
  addPageNumbers: (
    filePath: string,
    outputPath: string,
    options: {
      position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
      startNumber: number;
      format: 'simple' | 'page-of';
    }
  ) => ipcRenderer.invoke('tool:page-numbers', filePath, outputPath, options),

  // Security Tools
  protectPDF: (
    filePath: string,
    outputPath: string,
    userPassword: string,
    ownerPassword?: string
  ) => ipcRenderer.invoke('tool:protect', filePath, outputPath, userPassword, ownerPassword),
  unlockPDF: (filePath: string, outputPath: string, password?: string) =>
    ipcRenderer.invoke('tool:unlock', filePath, outputPath, password),

  // Crop & Binary Reader Tools
  cropPDF: (
    filePath: string,
    outputPath: string,
    cropArea: { x: number; y: number; width: number; height: number },
    applyToAll: boolean,
    pageIndex?: number
  ) => ipcRenderer.invoke('tool:crop', filePath, outputPath, cropArea, applyToAll, pageIndex),
  readBinaryFile: (filePath: string) => ipcRenderer.invoke('file:read-binary', filePath),

  // Sign & Redact Tools
  signPDF: (
    filePath: string,
    outputPath: string,
    options: {
      imagePath: string;
      pageIndex: number;
      x: number;
      y: number;
      widthRatio: number;
    }
  ) => ipcRenderer.invoke('tool:sign', filePath, outputPath, options),
  redactPDF: (
    filePath: string,
    outputPath: string,
    boxes: { page: number; x: number; y: number; width: number; height: number }[]
  ) => ipcRenderer.invoke('tool:redact', filePath, outputPath, boxes),
});
