import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Download,
  Eye,
  Check,
  Archive,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { splitPdf, downloadBytes, downloadZipBundle, formatBytes } from '../utils/pdfEngine';
import { renderAllPdfPagesToThumbnails, getPdfPageCount } from '../utils/pdfRenderer';

interface SplitToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const SplitTool: React.FC<SplitToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [splitMode, setSplitMode] = useState<'selected' | 'all' | 'ranges' | 'chunk'>('selected');
  const [customRangeText, setCustomRangeText] = useState('1-2, 3-4');
  const [chunkSize, setChunkSize] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [splitResults, setSplitResults] = useState<{ filename: string; bytes: Uint8Array; pageCount: number }[] | null>(null);

  // Load pages & thumbnails when file changes
  useEffect(() => {
    if (!file) {
      setPageThumbnails([]);
      setSelectedPages([]);
      setTotalPages(0);
      setSplitResults(null);
      return;
    }

    let isMounted = true;
    const load = async () => {
      try {
        const count = await getPdfPageCount(file);
        if (!isMounted) return;
        setTotalPages(count);
        // Default select first page
        setSelectedPages([0]);

        // Render thumbnails
        const thumbs = await renderAllPdfPagesToThumbnails(file, 40, 0.4);
        if (isMounted) setPageThumbnails(thumbs);
      } catch (err) {
        console.error('Error loading PDF for split:', err);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const handleTogglePage = (idx: number) => {
    setSelectedPages((prev) =>
      prev.includes(idx) ? prev.filter((p) => p !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleSelectAll = () => {
    setSelectedPages(Array.from({ length: totalPages }, (_, i) => i));
  };

  const handleSelectOdd = () => {
    setSelectedPages(Array.from({ length: totalPages }, (_, i) => i).filter((i) => (i + 1) % 2 !== 0));
  };

  const handleSelectEven = () => {
    setSelectedPages(Array.from({ length: totalPages }, (_, i) => i).filter((i) => (i + 1) % 2 === 0));
  };

  const handleClearSelection = () => {
    setSelectedPages([]);
  };

  const handleExecuteSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      let config = {};
      if (splitMode === 'selected') {
        if (selectedPages.length === 0) {
          alert('Please select at least one page to extract.');
          setIsProcessing(false);
          return;
        }
        config = { selectedPages };
      } else if (splitMode === 'chunk') {
        config = { chunkSize };
      } else if (splitMode === 'ranges') {
        const ranges = customRangeText.split(',').map((s) => s.trim()).filter(Boolean);
        config = { ranges };
      }

      const results = await splitPdf(file, splitMode, config, (p) => setProgress(p));
      setSplitResults(results);

      // If single file produced, download directly
      if (results.length === 1) {
        downloadBytes(results[0].bytes, results[0].filename);
      } else if (results.length > 1) {
        // Automatically package multiple files into ZIP
        await downloadZipBundle(results, `${file.name.replace(/\.pdf$/i, '')}_split_bundle.zip`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || 'Failed to split document.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Split & Extract PDF Pages
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Separate one page or whole ranges into new independent documents with zero hassle.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => setFile(files[0])}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to split or extract"
          subtitle="Choose single pages, specific page intervals, or split every page into a ZIP archive."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Info Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{totalPages} total pages</span>
              <span>·</span>
              <button
                onClick={() => onPreviewPdf(file, undefined, file.name)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Eye className="w-3 h-3" />
                <span>View Full PDF</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setFile(null)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Change File
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Choose Split Method
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => setSplitMode('selected')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              splitMode === 'selected'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Extract Selected Pages</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Click thumbnails below to choose exact pages to export.
            </div>
          </button>

          <button
            onClick={() => setSplitMode('all')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              splitMode === 'all'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Split Every Page</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Turns each page into an individual PDF file in a .ZIP archive.
            </div>
          </button>

          <button
            onClick={() => setSplitMode('ranges')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              splitMode === 'ranges'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Custom Ranges</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Define discrete intervals like 1-3, 4-6 into separate files.
            </div>
          </button>

          <button
            onClick={() => setSplitMode('chunk')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              splitMode === 'chunk'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Equal Chunks</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Split into equal parts (e.g. every 2 pages or 5 pages).
            </div>
          </button>
        </div>

        {/* Dynamic Mode Controls */}
        {splitMode === 'ranges' && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Page Range Intervals (comma separated)
            </label>
            <input
              type="text"
              value={customRangeText}
              onChange={(e) => setCustomRangeText(e.target.value)}
              placeholder="e.g. 1-2, 3-4"
              className="w-full sm:w-96 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Example: &quot;1-2, 3&quot; will create two files: one with pages 1-2 and one with page 3.
            </p>
          </div>
        )}

        {splitMode === 'chunk' && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pages per split file:
            </label>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={chunkSize}
              onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-1.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-500">
              Will generate approx {Math.ceil(totalPages / chunkSize)} files
            </span>
          </div>
        )}
      </div>

      {/* Visual Page Thumbnails Grid (when in Extract mode) */}
      {splitMode === 'selected' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Select Pages to Extract
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                ({selectedPages.length} of {totalPages} selected)
              </span>
            </div>

            {/* Quick selectors */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                All
              </button>
              <button
                onClick={handleSelectOdd}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Odd
              </button>
              <button
                onClick={handleSelectEven}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Even
              </button>
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const isSelected = selectedPages.includes(idx);
              const thumbUrl = pageThumbnails[idx];

              return (
                <div
                  key={idx}
                  onClick={() => handleTogglePage(idx)}
                  className={`group relative rounded-xl border p-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/50 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="aspect-[3/4] w-full rounded-md bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200/80 dark:border-slate-700 relative">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <FileText className="w-5 h-5" />
                        <span className="text-[10px] font-mono">Page {idx + 1}</span>
                      </div>
                    )}

                    {/* Selection Checkmark Badge */}
                    <div
                      className={`absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center transition-colors shadow-xs ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/80 dark:bg-slate-900/80 text-slate-400 border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                      Page {idx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Ready to Process Document
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {splitMode === 'selected'
              ? `Extracting ${selectedPages.length} selected pages into a single PDF.`
              : splitMode === 'all'
              ? `Generating ${totalPages} single-page files packed in a ZIP.`
              : `Splitting document into multiple parts.`}
          </p>
        </div>

        <button
          onClick={handleExecuteSplit}
          disabled={isProcessing}
          className="w-full sm:w-auto px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Splitting ({progress}%)...</span>
            </>
          ) : (
            <>
              <Scissors className="w-4 h-4" />
              <span>Split & Download</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Results Box */}
      {splitResults && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Split Complete! ({splitResults.length} {splitResults.length === 1 ? 'file' : 'files'} generated)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Your download should start automatically. You can also preview or re-download individual files below:
              </p>
            </div>

            {splitResults.length > 1 && (
              <button
                onClick={() =>
                  downloadZipBundle(splitResults, `${file.name.replace(/\.pdf$/i, '')}_split_all.zip`)
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Archive className="w-4 h-4" />
                <span>Download All as ZIP</span>
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
            {splitResults.map((res, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
              >
                <div className="truncate text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {res.filename}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {formatBytes(res.bytes.byteLength)} · {res.pageCount} p.
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onPreviewPdf(undefined, res.bytes, res.filename)}
                    className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => downloadBytes(res.bytes, res.filename)}
                    className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
