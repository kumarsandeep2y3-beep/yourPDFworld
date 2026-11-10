import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  Search,
  Replace,
  Download,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Type,
  Maximize2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { TextReplacementItem } from '../types/pdf';
import {
  extractDocumentTextItems,
  applyTextReplacements,
  PageTextItem,
} from '../utils/pdfTextEditor';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { downloadBytes, formatBytes } from '../utils/pdfEngine';
import { performanceMonitor } from '../utils/performanceMonitor';

interface EditTextToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const EditTextTool: React.FC<EditTextToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageThumbnail, setPageThumbnail] = useState<string | null>(null);
  const [pageTextItems, setPageTextItems] = useState<PageTextItem[]>([]);
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);

  // Search & Replace state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [replaceTerm, setReplaceTerm] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);

  // Active Replacements Queue
  const [replacements, setReplacements] = useState<TextReplacementItem[]>([]);

  // Selected item for custom styling
  const [selectedFont, setSelectedFont] = useState<TextReplacementItem['fontFamily']>('Helvetica');
  const [selectedFontSize, setSelectedFontSize] = useState<number>(12);
  const [selectedColor, setSelectedColor] = useState<string>('#0f172a');
  const [selectedFillColor, setSelectedFillColor] = useState<string>('#ffffff');

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load document pages and text layer
  useEffect(() => {
    if (!file) {
      setTotalPages(1);
      setCurrentPage(1);
      setPageThumbnail(null);
      setPageTextItems([]);
      setReplacements([]);
      setResult(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const initDoc = async () => {
      try {
        const count = await getPdfPageCount(file);
        if (isMounted) setTotalPages(count);
      } catch (err) {
        console.error('Failed to get page count:', err);
      }
    };

    initDoc();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Render current page and extract text items
  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    setIsLoadingText(true);

    const loadPage = async () => {
      try {
        const [thumb, items] = await Promise.all([
          renderPdfPageToDataUrl(file, currentPage, 0.8),
          extractDocumentTextItems(file, currentPage),
        ]);

        if (isMounted) {
          setPageThumbnail(thumb);
          setPageTextItems(items);
          setIsLoadingText(false);
        }
      } catch (err: any) {
        console.error('Error loading page text:', err);
        if (isMounted) {
          setIsLoadingText(false);
        }
      }
    };

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [file, currentPage]);

  // Find all matches on current page or document
  const handleFindAndQueue = () => {
    if (!searchTerm.trim()) return;

    const term = caseSensitive ? searchTerm.trim() : searchTerm.trim().toLowerCase();
    const newItems: TextReplacementItem[] = [];

    pageTextItems.forEach((item) => {
      const text = caseSensitive ? item.str : item.str.toLowerCase();
      if (text.includes(term)) {
        newItems.push({
          id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          pageIndex: currentPage - 1,
          findText: item.str,
          replaceText: item.str.replace(new RegExp(escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi'), replaceTerm),
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          fontSize: item.fontSize || selectedFontSize,
          fontFamily: selectedFont,
          textColor: selectedColor,
          fillColor: selectedFillColor,
        });
      }
    });

    if (newItems.length === 0) {
      alert(`No matches for "${searchTerm}" found on Page ${currentPage}.`);
      return;
    }

    setReplacements((prev) => [...prev, ...newItems]);
    setSearchTerm('');
    setReplaceTerm('');
  };

  const handleSelectTextItem = (item: PageTextItem) => {
    const existing = replacements.find(
      (r) => r.pageIndex === item.pageIndex && Math.abs(r.x - item.x) < 2 && Math.abs(r.y - item.y) < 2
    );

    if (existing) {
      setReplacements((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    const newItem: TextReplacementItem = {
      id: `click_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: item.pageIndex,
      findText: item.str,
      replaceText: item.str,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      fontSize: item.fontSize || 12,
      fontFamily: selectedFont,
      textColor: selectedColor,
      fillColor: selectedFillColor,
    };

    setReplacements((prev) => [...prev, newItem]);
  };

  const handleRemoveReplacement = (id: string) => {
    setReplacements((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateReplacementText = (id: string, text: string) => {
    setReplacements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, replaceText: text } : r))
    );
  };

  const handleApplyEdits = async () => {
    if (!file || replacements.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    const taskId = performanceMonitor.startTask('Applying PDF Text Edits', totalPages);

    try {
      performanceMonitor.updateTask(1, 'Loading document structure...');
      const res = await applyTextReplacements(file, replacements, (p) => {
        setProgress(p);
        performanceMonitor.updateTask(
          Math.max(1, Math.round((p / 100) * totalPages)),
          `Rendering replacement glyphs (${p}%)...`
        );
      });

      setResult(res);
      performanceMonitor.finishTask('All text edits applied successfully!');
    } catch (err: any) {
      console.error('Failed to apply text edits:', err);
      setError(err?.message || 'Failed to edit text in document.');
      performanceMonitor.finishTask('Error applying text edits');
    } finally {
      setIsProcessing(false);
    }
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return (
    <div className="space-y-6">
      {/* Tool Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Edit3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Edit PDF Text
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Perform direct text replacements and minor edits inside existing PDFs without converting. 100% private in browser memory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {file && (
              <button
                onClick={() => setFile(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change File</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      {!file ? (
        <Dropzone
          onFilesSelected={(files) => {
            if (files.length > 0) setFile(files[0]);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drag & drop a PDF document to edit text"
          subtitle="Click to edit sentences, search and replace words, or correct typos client-side."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Editing Controls & Queue (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Find & Replace Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Find & Replace on Page {currentPage}</span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Match Case</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    Text to Find
                  </label>
                  <input
                    type="text"
                    placeholder="Enter word or phrase to replace..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    Replace With
                  </label>
                  <input
                    type="text"
                    placeholder="Enter updated replacement text..."
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                {/* Font Styling Options */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Font Style</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="Helvetica">Helvetica (Standard)</option>
                      <option value="Helvetica-Bold">Helvetica Bold</option>
                      <option value="Times-Roman">Times Roman</option>
                      <option value="Times-Bold">Times Bold</option>
                      <option value="Courier">Courier Monospace</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Font Color</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
                      />
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 uppercase">
                        {selectedColor}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleFindAndQueue}
                  disabled={!searchTerm.trim()}
                  className="w-full mt-2 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Replace className="w-3.5 h-3.5" />
                  <span>Queue Text Replacement</span>
                </button>
              </div>
            </div>

            {/* Replacements List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Pending Edits ({replacements.length})</span>
                </span>
                {replacements.length > 0 && (
                  <button
                    onClick={() => setReplacements([])}
                    className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {replacements.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <p>No edits queued yet.</p>
                  <p className="text-[11px] mt-1 text-slate-500">
                    Use Find & Replace above, or click any text line directly on the document preview to edit it!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {replacements.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Page {rep.pageIndex + 1}
                        </span>
                        <button
                          onClick={() => handleRemoveReplacement(rep.id)}
                          className="text-slate-400 hover:text-rose-500 p-0.5"
                          title="Remove edit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-400 line-through truncate text-[11px]">
                          {rep.findText}
                        </div>
                        <input
                          type="text"
                          value={rep.replaceText}
                          onChange={(e) => handleUpdateReplacementText(rep.id, e.target.value)}
                          placeholder="New text..."
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button */}
              {replacements.length > 0 && (
                <button
                  onClick={handleApplyEdits}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply {replacements.length} Edit{replacements.length > 1 ? 's' : ''} to PDF</span>
                </button>
              )}

              {result && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-2 mt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Edits Applied Successfully!</span>
                  </div>
                  <button
                    onClick={() => downloadBytes(result.bytes, result.filename)}
                    className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Edited PDF</span>
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Page Viewer & Text Picker (7 Cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
            {/* Page Header & Navigation */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>
                {isLoadingText && (
                  <span className="text-[11px] text-blue-500 animate-pulse">Scanning text layer...</span>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Document Preview Canvas with Interactive Text Lines */}
            <div className="relative bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-2 sm:p-4 overflow-hidden flex flex-col items-center min-h-[460px] justify-center">
              {pageThumbnail ? (
                <div className="relative max-w-full shadow-lg rounded overflow-hidden select-none">
                  <img
                    src={pageThumbnail}
                    alt={`Page ${currentPage}`}
                    className="max-h-[640px] w-auto object-contain block"
                  />

                  {/* Detected Text Line Click Targets */}
                  <div className="absolute inset-0 pointer-events-auto">
                    {pageTextItems.map((item) => {
                      const isQueued = replacements.some(
                        (r) => r.pageIndex === item.pageIndex && Math.abs(r.x - item.x) < 2 && Math.abs(r.y - item.y) < 2
                      );
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectTextItem(item)}
                          title={`Click to edit: "${item.str}"`}
                          className={`absolute cursor-pointer transition-colors rounded-xs border ${
                            isQueued
                              ? 'bg-amber-400/30 border-amber-500'
                              : 'bg-transparent hover:bg-blue-500/20 hover:border-blue-400 border-transparent'
                          }`}
                          style={{
                            left: `${(item.x / 595.28) * 100}%`,
                            bottom: `${(item.y / 841.89) * 100}%`,
                            width: `${Math.max(2, (item.width / 595.28) * 100)}%`,
                            height: `${Math.max(1.8, (item.height / 841.89) * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs py-12">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span>Loading document view...</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Tip: Click on any text block on the preview to add it to your edit queue.</span>
              <span className="font-mono">{pageTextItems.length} text items detected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
