import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import History from './pages/History';
import Settings from './pages/Settings';
import { LicenseStatus } from './types';

// Import tool workspace components
import MergePages from './pages/tools/MergePages';
import SplitPages from './pages/tools/SplitPages';
import RemovePages from './pages/tools/RemovePages';
import ExtractPages from './pages/tools/ExtractPages';
import ReorderPages from './pages/tools/ReorderPages';
import CompressPages from './pages/tools/CompressPages';
import RepairPages from './pages/tools/RepairPages';
import OcrPages from './pages/tools/OcrPages';
import JpgToPdfPages from './pages/tools/JpgToPdfPages';
import OfficeToPdfPages from './pages/tools/OfficeToPdfPages';
import PdfToJpgPages from './pages/tools/PdfToJpgPages';
import RotatePages from './pages/tools/RotatePages';
import WatermarkPages from './pages/tools/WatermarkPages';
import PageNumbersPages from './pages/tools/PageNumbersPages';
import ProtectPages from './pages/tools/ProtectPages';
import UnlockPages from './pages/tools/UnlockPages';
import CropPages from './pages/tools/CropPages';
import PdfToOfficePages from './pages/tools/PdfToOfficePages';
import PdfToPdfaPages from './pages/tools/PdfToPdfaPages';
import HtmlToPdfPages from './pages/tools/HtmlToPdfPages';
import SignPages from './pages/tools/SignPages';
import RedactPages from './pages/tools/RedactPages';
import ComparePages from './pages/tools/ComparePages';

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseStatus>({ tier: 'FREE', isPro: false });

  const loadLicenseStatus = async () => {
    try {
      const status = await window.electronAPI.getLicenseStatus();
      setLicense(status);
    } catch (err) {
      console.error('Failed to query license status', err);
    }
  };

  useEffect(() => {
    loadLicenseStatus();

    // Listen to native OS/menu navigations
    const unsubscribe = window.electronAPI.onNavigate((targetPath) => {
      setActiveToolId(null);
      setCurrentPath(targetPath);
    });

    return unsubscribe;
  }, []);

  const handleNavigate = (path: string) => {
    setActiveToolId(null);
    setCurrentPath(path);
  };

  const handleSelectTool = (toolId: string) => {
    setActiveToolId(toolId);
    setCurrentPath(`/tool/${toolId}`);
  };

  const renderContent = () => {
    if (activeToolId) {
      const onBack = () => handleNavigate('/');
      switch (activeToolId) {
        case 'merge':
          return <MergePages onBack={onBack} license={license} />;
        case 'split':
          return <SplitPages onBack={onBack} license={license} />;
        case 'remove-pages':
          return <RemovePages onBack={onBack} license={license} />;
        case 'extract-pages':
          return <ExtractPages onBack={onBack} license={license} />;
        case 'reorder':
          return <ReorderPages onBack={onBack} license={license} />;
        case 'compress':
          return <CompressPages onBack={onBack} license={license} />;
        case 'repair':
          return <RepairPages onBack={onBack} license={license} />;
        case 'ocr':
          return <OcrPages onBack={onBack} license={license} />;
        case 'jpg2pdf':
          return <JpgToPdfPages onBack={onBack} license={license} />;
        case 'office2pdf':
          return <OfficeToPdfPages onBack={onBack} license={license} />;
        case 'pdf2jpg':
          return <PdfToJpgPages onBack={onBack} license={license} />;
        case 'rotate':
          return <RotatePages onBack={onBack} license={license} />;
        case 'watermark':
          return <WatermarkPages onBack={onBack} license={license} />;
        case 'page-numbers':
          return <PageNumbersPages onBack={onBack} license={license} />;
        case 'protect':
          return <ProtectPages onBack={onBack} license={license} />;
        case 'unlock':
          return <UnlockPages onBack={onBack} license={license} />;
        case 'crop':
          return <CropPages onBack={onBack} license={license} />;
        case 'pdf2word':
          return <PdfToOfficePages onBack={onBack} license={license} target="word" />;
        case 'pdf2ppt':
          return <PdfToOfficePages onBack={onBack} license={license} target="powerpoint" />;
        case 'pdf2excel':
          return <PdfToOfficePages onBack={onBack} license={license} target="excel" />;
        case 'pdf2pdfa':
          return <PdfToPdfaPages onBack={onBack} license={license} />;
        case 'html2pdf':
          return <HtmlToPdfPages onBack={onBack} license={license} />;
        case 'sign':
          return <SignPages onBack={onBack} license={license} />;
        case 'redact':
          return <RedactPages onBack={onBack} license={license} />;
        case 'compare':
          return <ComparePages onBack={onBack} license={license} />;
        default:
          return <Home onSelectTool={handleSelectTool} license={license} />;
      }
    }

    switch (currentPath) {
      case '/':
        return <Home onSelectTool={handleSelectTool} license={license} />;
      case '/history':
        return <History />;
      case '/settings':
        return <Settings license={license} setLicense={setLicense} />;
      default:
        return <Home onSelectTool={handleSelectTool} license={license} />;
    }
  };

  return (
    <Layout
      activePath={currentPath}
      onNavigate={handleNavigate}
      license={license}
    >
      {renderContent()}
    </Layout>
  );
}
