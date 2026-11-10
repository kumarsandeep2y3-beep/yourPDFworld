import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { downloadBytes } from '../utils/pdfEngine';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: File;
  bytes?: Uint8Array;
  filename: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  bytes,
  filename,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || (!file && !bytes)) return;

    let isMounted = true;
    setCurrentPage(1);
    setZoomScale(1.0);

    const init = async () => {
      setIsLoading(true);
      try {
        const source = file || (bytes as Uint8Array);
        const count = file ? await getPdfPageCount(file) : 1;
        if (isMounted) setTotalPages(count);

        const img = await renderPdfPageToDataUrl(source, 1, 1.2 * zoomScale);
        if (isMounted) {
          setPageImageUrl(img);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to preview PDF:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [isOpen, file, bytes]);

  useEffect(() => {
    if (!isOpen || (!file && !bytes)) return;

    let isMounted = true;
    const renderPage = async () => {
      setIsLoading(true);
      try {
        const source = file || (bytes as Uint8Array);
        const img = await renderPdfPageToDataUrl(source, currentPage, 1.2 * zoomScale);
        if (isMounted) {
          setPageImageUrl(img);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error rendering page:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [currentPage, zoomScale]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (bytes) {
      downloadBytes(bytes, filename);
    } else if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {filename}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Page {currentPage} of {totalPages}
              </p>
            </div>
          </div>

          {/* Center Pagination & Zoom */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.0, z + 0.2))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          {isLoading && !pageImageUrl ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Rendering page...</span>
            </div>
          ) : pageImageUrl ? (
            <div className="relative shadow-2xl rounded-sm transition-all duration-150">
              <img
                src={pageImageUrl}
                alt={`PDF Page ${currentPage}`}
                className="max-h-[75vh] w-auto object-contain rounded-xs border border-slate-300 dark:border-slate-800 bg-white"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">Unable to load page preview</div>
          )}
        </div>
      </div>
    </div>
  );
};
