export interface HistoryRecord {
  id: string;
  tool_name: string;
  input_files: string[];
  output_file: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string | null;
  timestamp: string;
}

export interface LicenseStatus {
  tier: 'FREE' | 'PRO';
  isPro: boolean;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: 'organize' | 'optimize' | 'convert-to' | 'convert-from' | 'edit' | 'security';
  icon: string;
  isPremium?: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      onNavigate: (callback: (path: string) => void) => () => void;
      openFiles: (filters: { name: string; extensions: string[] }[]) => Promise<string[]>;
      selectFolder: () => Promise<string | null>;
      openPath: (path: string) => Promise<string>;
      locateFile: (path: string) => Promise<boolean>;
      getHistory: () => Promise<HistoryRecord[]>;
      getSetting: (key: string, defaultValue?: string) => Promise<string>;
      saveSetting: (key: string, value: string) => Promise<boolean>;
      getResolvedPaths: () => Promise<{ gsPath: string; loPath: string; tessDataPath: string }>;
      getLicenseStatus: () => Promise<LicenseStatus>;
      activateLicense: (key: string) => Promise<{ success: boolean; message: string }>;
      deactivateLicense: () => Promise<{ success: boolean }>;

      // Organize Tools
      mergePDF: (filePaths: string[], outputPath: string) => Promise<{ success: boolean; outputPath: string }>;
      splitPDF: (filePath: string, ranges: { start: number; end: number }[], outputFolder: string) => Promise<{ success: boolean; outputFiles: string[] }>;
      removePages: (filePath: string, pagesToRemove: number[], outputPath: string) => Promise<{ success: boolean; outputPath: string }>;
      extractPages: (filePath: string, pagesToExtract: number[], outputPath: string) => Promise<{ success: boolean; outputPath: string }>;
      reorderPDF: (filePath: string, newSequence: (number | { index: number; rotation?: number })[], outputPath: string) => Promise<{ success: boolean; outputPath: string }>;

      // Optimize Tools
      compressPDF: (filePath: string, outputPath: string, level: 'extreme' | 'recommended' | 'low') => Promise<{ success: boolean; outputPath: string }>;
      repairPDF: (filePath: string, outputPath: string) => Promise<{ success: boolean; outputPath: string }>;
      runOCR: (filePath: string, outputPath: string, language?: string) => Promise<{ success: boolean; outputPath: string }>;
      ocrImageTexts: (images: string[], language?: string) => Promise<string[]>;
      onOcrProgress: (callback: (data: { status: string; progress: number }) => void) => () => void;

      // Convert Tools
      convertOfficeToPdf: (filePath: string, outputFolder: string) => Promise<{ success: boolean; outputPath: string }>;
      convertJpgToPdf: (
        imagePaths: string[],
        outputPath: string,
        options: {
          orientation: 'portrait' | 'landscape';
          pageSize: 'a4' | 'letter' | 'fit';
          margin: 'none' | 'small' | 'large';
        }
      ) => Promise<{ success: boolean; outputPath: string }>;
      saveRenderedPages: (
        pdfPath: string,
        pages: { pageNumber: number; base64Data: string }[],
        outputFolder: string
      ) => Promise<{ success: boolean; outputFiles: string[] }>;

      convertPdfToOffice: (
        target: 'word' | 'powerpoint' | 'excel',
        outputPath: string,
        payload: {
          sourcePath: string;
          mode?: 'editable' | 'exact';
          pages?: { lines: string[] }[];
          images?: { base64: string; width: number; height: number }[];
        }
      ) => Promise<{ success: boolean; outputPath: string }>;
      convertPdfToPdfA: (filePath: string, outputPath: string) => Promise<{ success: boolean; outputPath: string }>;
      convertHtmlToPdf: (
        filePath: string,
        outputPath: string,
        options: {
          pageSize: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
          landscape: boolean;
          printBackground: boolean;
        }
      ) => Promise<{ success: boolean; outputPath: string }>;

      // Edit Tools
      rotatePDF: (filePath: string, outputPath: string, rotationAngle: number) => Promise<{ success: boolean; outputPath: string }>;
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
      ) => Promise<{ success: boolean; outputPath: string }>;
      addPageNumbers: (
        filePath: string,
        outputPath: string,
        options: {
          position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
          startNumber: number;
          format: 'simple' | 'page-of';
        }
      ) => Promise<{ success: boolean; outputPath: string }>;

      // Security Tools
      protectPDF: (
        filePath: string,
        outputPath: string,
        userPassword: string,
        ownerPassword?: string
      ) => Promise<{ success: boolean; outputPath: string }>;
      unlockPDF: (filePath: string, outputPath: string, password?: string) => Promise<{ success: boolean; outputPath: string }>;

      // Crop & Binary Reader Tools
      cropPDF: (
        filePath: string,
        outputPath: string,
        cropArea: { x: number; y: number; width: number; height: number },
        applyToAll: boolean,
        pageIndex?: number
      ) => Promise<{ success: boolean; outputPath: string }>;
      readBinaryFile: (filePath: string) => Promise<Uint8Array>;

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
      ) => Promise<{ success: boolean; outputPath: string }>;
      redactPDF: (
        filePath: string,
        outputPath: string,
        boxes: { page: number; x: number; y: number; width: number; height: number }[]
      ) => Promise<{ success: boolean; outputPath: string }>;
    };
  }
}
export {};
