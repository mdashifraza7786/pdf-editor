import React, { useState } from 'react';
import ToolCard from '../components/ToolCard';
import { ToolInfo, LicenseStatus } from '../types';

interface HomeProps {
  onSelectTool: (toolId: string) => void;
  license: LicenseStatus;
}

const TOOLS: ToolInfo[] = [
  // ORGANIZE
  {
    id: 'merge',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into a single document easily.',
    category: 'organize',
    icon: 'Merge',
    isPremium: false,
  },
  {
    id: 'split',
    name: 'Split PDF',
    description: 'Extract ranges of pages or split each page into a separate document.',
    category: 'organize',
    icon: 'Scissors',
    isPremium: false,
  },
  {
    id: 'remove-pages',
    name: 'Remove Pages',
    description: 'Delete specific pages from a PDF document to clean it up.',
    category: 'organize',
    icon: 'FileX',
    isPremium: true,
  },
  {
    id: 'extract-pages',
    name: 'Extract Pages',
    description: 'Select and save only the pages you need as a new document.',
    category: 'organize',
    icon: 'FileOutput',
    isPremium: true,
  },
  {
    id: 'reorder',
    name: 'Organize PDF',
    description: 'Rearrange, sort, or insert pages in your document as desired.',
    category: 'organize',
    icon: 'FileStack',
    isPremium: true,
  },

  // OPTIMIZE
  {
    id: 'compress',
    name: 'Compress PDF',
    description: 'Reduce the file size of your PDF while maintaining optimal quality.',
    category: 'optimize',
    icon: 'Minimize',
    isPremium: false,
  },
  {
    id: 'repair',
    name: 'Repair PDF',
    description: 'Fix corrupted PDF documents and recover lost data structure.',
    category: 'optimize',
    icon: 'Wrench',
    isPremium: true,
  },
  {
    id: 'ocr',
    name: 'OCR PDF',
    description: 'Convert scanned PDF pages or images into text-searchable documents.',
    category: 'optimize',
    icon: 'ScanText',
    isPremium: true,
  },

  // CONVERT TO PDF
  {
    id: 'jpg2pdf',
    name: 'JPG to PDF',
    description: 'Convert image files (JPEG, PNG) into standard PDF documents.',
    category: 'convert-to',
    icon: 'Image',
    isPremium: false,
  },
  {
    id: 'office2pdf',
    name: 'Office to PDF',
    description: 'Convert Microsoft Word, Excel, and PowerPoint files to PDF.',
    category: 'convert-to',
    icon: 'FileSpreadsheet',
    isPremium: true,
  },
  {
    id: 'html2pdf',
    name: 'HTML to PDF',
    description: 'Render a local HTML page with its CSS into a print-ready PDF.',
    category: 'convert-to',
    icon: 'Globe',
    isPremium: true,
  },

  // CONVERT FROM PDF
  {
    id: 'pdf2jpg',
    name: 'PDF to JPG',
    description: 'Extract images or convert each page of a PDF into JPG format.',
    category: 'convert-from',
    icon: 'FileImage',
    isPremium: false,
  },
  {
    id: 'pdf2word',
    name: 'PDF to Word',
    description: 'Turn your PDF into an editable Microsoft Word (.docx) document.',
    category: 'convert-from',
    icon: 'FileText',
    isPremium: true,
  },
  {
    id: 'pdf2ppt',
    name: 'PDF to PowerPoint',
    description: 'Convert your PDF into editable PowerPoint (.pptx) slides.',
    category: 'convert-from',
    icon: 'Presentation',
    isPremium: true,
  },
  {
    id: 'pdf2excel',
    name: 'PDF to Excel',
    description: 'Pull data straight from PDFs into editable Excel (.xlsx) sheets.',
    category: 'convert-from',
    icon: 'Table',
    isPremium: true,
  },
  {
    id: 'pdf2pdfa',
    name: 'PDF to PDF/A',
    description: 'Convert to the ISO-standardized format for long-term archiving.',
    category: 'convert-from',
    icon: 'Archive',
    isPremium: true,
  },

  // EDIT
  {
    id: 'rotate',
    name: 'Rotate PDF',
    description: 'Rotate your PDF pages clockwise or counterclockwise.',
    category: 'edit',
    icon: 'RotateCw',
    isPremium: false,
  },
  {
    id: 'crop',
    name: 'Crop PDF',
    description: 'Trim page margins or select custom crop boundaries visually.',
    category: 'edit',
    icon: 'Crop',
    isPremium: true,
  },
  {
    id: 'watermark',
    name: 'Watermark PDF',
    description: 'Add a customized text or image stamp overlay onto your pages.',
    category: 'edit',
    icon: 'Type',
    isPremium: false,
  },
  {
    id: 'page-numbers',
    name: 'Page Numbers',
    description: 'Insert fully styled page numbers on your PDF document easily.',
    category: 'edit',
    icon: 'Binary',
    isPremium: false,
  },

  // SECURITY
  {
    id: 'protect',
    name: 'Protect PDF',
    description: 'Encrypt your PDF document with a secure password requirement.',
    category: 'security',
    icon: 'Lock',
    isPremium: false,
  },
  {
    id: 'unlock',
    name: 'Unlock PDF',
    description: 'Decrypt and remove password security from protected documents.',
    category: 'security',
    icon: 'Unlock',
    isPremium: false,
  },
  {
    id: 'sign',
    name: 'Sign PDF',
    description: 'Place your signature image anywhere on the document pages.',
    category: 'security',
    icon: 'PenTool',
    isPremium: true,
  },
  {
    id: 'redact',
    name: 'Redact PDF',
    description: 'Permanently black out sensitive text and areas of your PDF.',
    category: 'security',
    icon: 'EyeOff',
    isPremium: true,
  },
];

export default function Home({ onSelectTool, license }: HomeProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'All Tools' },
    { id: 'organize', label: 'Organize' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'convert-to', label: 'Convert To PDF' },
    { id: 'convert-from', label: 'Convert From PDF' },
    { id: 'edit', label: 'Edit PDF' },
    { id: 'security', label: 'Security' },
  ];

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* SEARCH & FILTERS HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Local PDF Toolkit</h2>
          <p className="text-xs text-muted-foreground mt-1.5 font-bold leading-relaxed">
            All PDF operations run securely inside your system memory. No telemetry or server syncing.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search for tools (e.g. Merge, OCR)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all duration-200 text-foreground shadow-sm"
          />
        </div>
      </div>

      {/* CATEGORY SELECTOR */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide uppercase transition-all duration-200 border ${
              activeCategory === cat.id
                ? 'bg-primary border-primary text-white font-bold shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground shadow-sm'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* TOOLS GRID */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onClick={() => onSelectTool(tool.id)}
              isLocked={!!tool.isPremium && !license.isPro}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-card">
          <p className="text-muted-foreground font-semibold text-sm">No tools matching your selection</p>
          <button
            onClick={() => {
              setActiveCategory('all');
              setSearchQuery('');
            }}
            className="text-xs text-primary hover:underline font-bold mt-2"
          >
            Clear Filters & Search
          </button>
        </div>
      )}
    </div>
  );
}
