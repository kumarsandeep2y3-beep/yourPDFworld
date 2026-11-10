import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Scissors,
  Minimize2,
  Highlighter,
  Stamp,
  ScanText,
  RotateCw,
  Sparkles,
  Lock,
  FileType,
  Hash,
  Share2,
  Info,
  Edit3,
  X,
  ShieldCheck,
  Smartphone,
  Laptop,
  ArrowLeft,
} from 'lucide-react';
import { ToolMode, UploadedFileItem } from './types/pdf';
import { Header, ThemeMode } from './components/Header';
import { MergeTool } from './components/MergeTool';
import { SplitTool } from './components/SplitTool';
import { CompressTool } from './components/CompressTool';
import { EditTextTool } from './components/EditTextTool';
import { BatchTool } from './components/BatchTool';
import { ConverterTool } from './components/ConverterTool';
import { AnnotateTool } from './components/AnnotateTool';
import { WatermarkTool } from './components/WatermarkTool';
import { PageNumberTool } from './components/PageNumberTool';
import { OcrTool } from './components/OcrTool';
import { SecurityTool } from './components/SecurityTool';
import { RotateTool } from './components/RotateTool';
import { OrganizeTool } from './components/OrganizeTool';
import { PdfInfoTool } from './components/PdfInfoTool';
import { PdfViewerModal } from './components/PdfViewerModal';
import { OfflineBanner } from './components/OfflineBanner';
import { ShareModal } from './components/ShareModal';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { createSamplePdf } from './utils/samplePdfs';
import {
  getMaxFileSizeLimit,
  secureValidateFile,
  getValidatedPdfFile,
  loadPdfSafely,
} from './utils/justPdfSecurityProcessor';

export default function App() {
  const [currentMode, setCurrentMode] = useState<ToolMode>('dashboard');

  // Three-state theme mode: 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yourpdfworld_theme_mode') || localStorage.getItem('justpdf_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
    return 'system';
  });

  // Track system OS color scheme
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Mobile bottom nav active tab & drawers
  const [mobileTab, setMobileTab] = useState<'home' | 'tools' | 'recent' | 'settings'>('home');
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  // Listen to OS-level system theme changes in real time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute effective dark mode
  const effectiveIsDark =
    themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // Apply effective dark mode to document element & persist
  useEffect(() => {
    if (effectiveIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('yourpdfworld_theme_mode', themeMode);
  }, [effectiveIsDark, themeMode]);

  const handleCycleTheme = () => {
    setThemeMode((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  };

  // Global files queue for merge tool
  const [mergeFiles, setMergeFiles] = useState<UploadedFileItem[]>([]);

  // Preview modal state
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    file?: File;
    bytes?: Uint8Array;
    filename: string;
  }>({
    isOpen: false,
    filename: '',
  });

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenPreview = (file?: File, bytes?: Uint8Array, name?: string) => {
    setPreviewModal({
      isOpen: true,
      file,
      bytes,
      filename: name || file?.name || 'document_preview.pdf',
    });
  };

  // Sample Documents Generator - Loads real pre-built PDFs for immediate testing
  const handleLoadSamples = async () => {
    showToast('Generating demo documents: Strategic Report, Contract & Invoice...');
    try {
      const [report, contract, invoice] = await Promise.all([
        createSamplePdf('report'),
        createSamplePdf('contract'),
        createSamplePdf('invoice'),
      ]);

      const items: UploadedFileItem[] = [
        {
          id: 'sample-1',
          file: report,
          name: report.name,
          size: report.size,
          pageCount: 3,
        },
        {
          id: 'sample-2',
          file: contract,
          name: contract.name,
          size: contract.size,
          pageCount: 4,
        },
        {
          id: 'sample-3',
          file: invoice,
          name: invoice.name,
          size: invoice.size,
          pageCount: 2,
        },
      ];

      setMergeFiles(items);
      showToast('Loaded 3 sample PDFs! Ready to merge, edit text, compress, or batch process.');
    } catch (e) {
      console.error(e);
      showToast('Failed to load sample documents.');
    }
  };

  const maxLimitMB = Math.round(getMaxFileSizeLimit() / (1024 * 1024));

  const priorityFileInputRef = useRef<HTMLInputElement>(null);
  const [isDropzoneConverting, setIsDropzoneConverting] = useState(false);
  const [dropzoneError, setDropzoneError] = useState<string | null>(null);

  const handlePriorityDropzoneFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    setIsDropzoneConverting(true);
    setDropzoneError(null);

    const validUploadedItems: UploadedFileItem[] = [];

    for (const file of fileList) {
      if (file.size < 5 * 1024) {
        alert("File is too small or empty. Please upload a valid PDF.");
        setDropzoneError("File is too small or empty. Please upload a valid PDF.");
        setIsDropzoneConverting(false);
        return;
      }

      try {
        secureValidateFile(file);
        const readyPdf = await getValidatedPdfFile(file);
        if (readyPdf.size < 5 * 1024) {
          alert("File is too small or empty. Please upload a valid PDF.");
          continue;
        }

        const buf = await readyPdf.arrayBuffer();
        await loadPdfSafely(buf);

        validUploadedItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: readyPdf,
          name: readyPdf.name,
          size: readyPdf.size,
          pageCount: 1,
          pageRange: '',
        });
      } catch (err: any) {
        console.warn('Priority dropzone error:', err);
        alert(err?.message || 'Failed to process file.');
        setDropzoneError(err?.message || 'Failed to process file.');
      }
    }

    setIsDropzoneConverting(false);

    if (validUploadedItems.length > 0) {
      setMergeFiles((prev) => [...prev, ...validUploadedItems]);
      setCurrentMode('merge');
      setMobileTab('home');
      showToast(`Loaded ${validUploadedItems.length} document(s) into workspace.`);
    }
  };

  const allTools = [
    { id: 'merge', label: 'Merge PDFs', iconEmoji: '📂', desc: 'Combine multiple PDFs', icon: Layers },
    { id: 'split', label: 'Split & Extract', iconEmoji: '✂️', desc: 'Extract pages easily', icon: Scissors },
    { id: 'compress', label: 'Compress', iconEmoji: '📉', desc: 'Reduce file size', icon: Minimize2 },
    { id: 'edit', label: 'Edit & Draw', iconEmoji: '✍️', desc: 'Add text, annotations', icon: Edit3 },
    { id: 'batch', label: 'Batch Queue', iconEmoji: '📑', desc: 'Process multiple files', icon: Layers },
    { id: 'watermark', label: 'Watermark', iconEmoji: '©️', desc: 'Stamp branding', icon: Stamp },
    { id: 'ocr', label: 'OCR Scan', iconEmoji: '🔍', desc: 'Recognize text', icon: ScanText },
    { id: 'convert', label: 'Convert PDF', iconEmoji: '🔄', desc: 'To Word, JPG, etc.', icon: FileType },
    { id: 'rotate', label: 'Rotate Pages', iconEmoji: '🔄', desc: 'Fix orientation', icon: RotateCw },
    { id: 'annotate', label: 'Annotate', iconEmoji: '💬', desc: 'Highlights & notes', icon: Highlighter },
    { id: 'pagenumber', label: 'Page Numbers', iconEmoji: '#️⃣', desc: 'Add pagination', icon: Hash },
    { id: 'security', label: 'Security', iconEmoji: '🔒', desc: 'Encrypt & lock', icon: Lock },
    { id: 'organize', label: 'Organize', iconEmoji: '🗂️', desc: 'Rearrange pages', icon: RotateCw },
    { id: 'info', label: 'PDF Info', iconEmoji: 'ℹ️', desc: 'View metadata', icon: Info },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans pb-20 sm:pb-0">
      {/* 1. Header & Branding */}
      <Header
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode);
          setMobileTab('home');
        }}
        themeMode={themeMode}
        onCycleTheme={handleCycleTheme}
        onLoadSamples={handleLoadSamples}
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      {/* Main Content Wrapper */}
      <main className="main-workspace flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col space-y-8">
        {currentMode === 'dashboard' ? (
          <>
            {/* 2. Hero Section with Tagline & Trust Badges */}
            <section className="text-center space-y-4 pt-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Your Complete{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  PDF Solution.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Free online PDF tools. Fast, secure and easy to use.
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center items-center gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1">🔒 100% Secure (No Server Uploads)</span>
                <span className="flex items-center gap-1">⚡ Lightning Fast</span>
                <span className="flex items-center gap-1">🆓 Completely Free</span>
              </div>
            </section>

            {/* 3. Main Dropzone Workspace */}
            <section
              id="dropZone"
              className="upload-drop-zone w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6 text-center backdrop-blur-sm relative overflow-hidden transition-colors"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handlePriorityDropzoneFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                onClick={() => priorityFileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/40 hover:border-cyan-500/60 transition cursor-pointer"
              >
                <div className="upload-icon text-4xl mb-3 animate-bounce">☁️</div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-1">
                  {isDropzoneConverting ? 'Processing & Converting Files...' : 'Drop your PDF & Image files here'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  or browse files from your device (PDF, PNG, JPG, WebP)
                </p>

                {dropzoneError && (
                  <div className="mb-4 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
                    {dropzoneError}
                  </div>
                )}

                <label
                  htmlFor="priorityFileInput"
                  onClick={(e) => e.stopPropagation()}
                  className="browse-btn-primary bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm cursor-pointer shadow-lg shadow-cyan-500/20 transition active:scale-95 inline-block"
                >
                  + Browse Files
                  <input
                    ref={priorityFileInputRef}
                    id="priorityFileInput"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handlePriorityDropzoneFiles(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-500 mt-4">
                  Smart Limits: Up to 50MB (Mobile) / 150MB (Desktop)
                </span>
              </div>
            </section>

            {/* 4. All 14 PDF Tools Grid (Optimized Padding & Spacing for Mobile) */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-cyan-600 dark:text-cyan-400">
                  All PDF Tools (14 Tools)
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {allTools.map((tool) => (
                  <div
                    key={tool.id}
                    data-tool={tool.id}
                    onClick={() => {
                      setCurrentMode(tool.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/50 p-4 rounded-xl transition group cursor-pointer shadow-sm flex flex-col justify-between text-left hover:shadow-md"
                  >
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">
                      {tool.iconEmoji}
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-white mb-0.5">
                        {tool.label}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="space-y-6">
            {/* Quick Navigation Header & Tool Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setCurrentMode('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer shrink-0 shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Tools</span>
              </button>

              <nav className="tools-scroll-container flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs w-max min-w-full sm:min-w-0">
                {allTools.map((tool) => {
                  const isActive = currentMode === tool.id;
                  return (
                    <button
                      key={tool.id}
                      data-tool={tool.id}
                      onClick={() => {
                        setCurrentMode(tool.id);
                        setMobileTab('home');
                      }}
                      className={`tool-pill px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        isActive
                          ? 'active bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{tool.iconEmoji}</span>
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Active Tool Workspace */}
            <div className="animate-in fade-in-50 duration-200">
              {currentMode === 'merge' && (
                <MergeTool
                  files={mergeFiles}
                  setFiles={setMergeFiles}
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'split' && (
                <SplitTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'compress' && (
                <CompressTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'edit' && (
                <EditTextTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'batch' && (
                <BatchTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'convert' && (
                <ConverterTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'rotate' && (
                <RotateTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'annotate' && (
                <AnnotateTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'watermark' && (
                <WatermarkTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'pagenumber' && (
                <PageNumberTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'ocr' && (
                <OcrTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'security' && (
                <SecurityTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'organize' && (
                <OrganizeTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}

              {currentMode === 'info' && (
                <PdfInfoTool
                  onLoadSamples={handleLoadSamples}
                  onPreviewPdf={handleOpenPreview}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modern Compact Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">yourPDFworld</span>
            <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
              .com
            </span>
            <span>—</span>
            <span>Your Complete PDF Solution.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => setCurrentMode('dashboard')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              All Tools
            </button>
            <button
              onClick={() => setCurrentMode('merge')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Merge
            </button>
            <button
              onClick={() => setCurrentMode('compress')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Compress
            </button>
            <button
              onClick={() => setCurrentMode('edit')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Edit Text
            </button>
            <button
              onClick={() => setCurrentMode('batch')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Batch Queue
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer font-medium text-cyan-600 dark:text-cyan-400"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>

          <div>
            <span>100% Client-Side Privacy Guaranteed · No Server Uploads</span>
          </div>
        </div>
      </footer>

      {/* 5. Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex sm:hidden justify-around items-center z-50 px-2 shadow-2xl">
        <button
          id="home"
          onClick={() => {
            setMobileTab('home');
            setCurrentMode('dashboard');
            setIsMobileToolsOpen(false);
            setIsMobileSettingsOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center text-[11px] font-medium gap-1 transition cursor-pointer ${
            currentMode === 'dashboard' && mobileTab === 'home'
              ? 'text-cyan-500 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400'
          }`}
        >
          <span className="text-lg leading-none">🏠</span>
          <span>Home</span>
        </button>

        <button
          id="tools"
          onClick={() => {
            setMobileTab('tools');
            setIsMobileToolsOpen(true);
            setIsMobileSettingsOpen(false);
          }}
          className={`flex flex-col items-center text-[11px] font-medium gap-1 transition cursor-pointer ${
            isMobileToolsOpen || (currentMode !== 'dashboard' && mobileTab !== 'recent' && mobileTab !== 'settings')
              ? 'text-cyan-500 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400'
          }`}
        >
          <span className="text-lg leading-none">🛠️</span>
          <span>Tools</span>
        </button>

        <button
          id="recent"
          onClick={() => {
            setMobileTab('recent');
            showToast('yourPDFworld Telemetry: Zero Server Uploads · 100% In-Memory');
          }}
          className={`flex flex-col items-center text-[11px] font-medium gap-1 transition cursor-pointer ${
            mobileTab === 'recent'
              ? 'text-cyan-500 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400'
          }`}
        >
          <span className="text-lg leading-none">⏱️</span>
          <span>Recent</span>
        </button>

        <button
          id="settings"
          onClick={() => {
            setMobileTab('settings');
            setIsMobileSettingsOpen(true);
            setIsMobileToolsOpen(false);
          }}
          className={`flex flex-col items-center text-[11px] font-medium gap-1 transition cursor-pointer ${
            isMobileSettingsOpen
              ? 'text-cyan-500 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400'
          }`}
        >
          <span className="text-lg leading-none">⚙️</span>
          <span>Settings</span>
        </button>
      </nav>

      {/* Mobile Tools Drawer Sheet */}
      {isMobileToolsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:hidden">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  All PDF Tools
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold">
                  {allTools.length} Tools
                </span>
              </div>
              <button
                onClick={() => setIsMobileToolsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {allTools.map((tool) => {
                const IconComp = tool.icon;
                const isActive = currentMode === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setCurrentMode(tool.id);
                      setIsMobileToolsOpen(false);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span className="text-xs truncate">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Settings Drawer Sheet */}
      {isMobileSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:hidden">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                yourPDFworld Settings & Info
              </span>
              <button
                onClick={() => setIsMobileSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Color Theme
                </span>
                <span className="text-[11px] text-slate-500 capitalize">
                  Current: {themeMode} {themeMode === 'system' ? `(${effectiveIsDark ? 'Dark' : 'Light'})` : ''}
                </span>
              </div>
              <button
                onClick={handleCycleTheme}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white"
              >
                Toggle Theme
              </button>
            </div>

            {/* Smart Limit Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Smart Device File Limit: {maxLimitMB}MB</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Optimized for device memory protection (50MB for mobile, 150MB for desktop).
              </p>
            </div>

            {/* Security Guarantee */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <span>100% Client-Side Private</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Zero uploads. All PDF parsing, compression, and OCR are processed locally in your browser memory.
              </p>
            </div>

            {/* Share Trigger */}
            <button
              onClick={() => {
                setIsMobileSettingsOpen(false);
                setIsShareModalOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share yourPDFworld.com</span>
            </button>
          </div>
        </div>
      )}

      {/* In-app Fullscreen PDF Preview Modal */}
      <PdfViewerModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        file={previewModal.file}
        bytes={previewModal.bytes}
        filename={previewModal.filename}
      />

      {/* Share with Greeting Message Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Real-time Client Performance Analytics Overlay */}
      <PerformanceOverlay />

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 dark:text-blue-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Offline Connectivity Status Banner */}
      <OfflineBanner />
    </div>
  );
}
