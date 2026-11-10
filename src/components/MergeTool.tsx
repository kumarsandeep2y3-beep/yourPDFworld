import React, { useState, useEffect } from 'react';
import {
  FileText,
  MoveUp,
  MoveDown,
  Trash2,
  Plus,
  ArrowRight,
  Download,
  Eye,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { UploadedFileItem } from '../types/pdf';
import { mergePdfs, downloadBytes, formatBytes, loadPdfSafely } from '../utils/pdfEngine';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { Dropzone } from './Dropzone';
import { getValidatedPdfFile } from '../utils/justPdfSecurityProcessor';

interface MergeToolProps {
  files: UploadedFileItem[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const MergeTool: React.FC<MergeToolProps> = ({
  files,
  setFiles,
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [outputName, setOutputName] = useState('yourPDFworld_Merged_Document.pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mergedResult, setMergedResult] = useState<{
    bytes: Uint8Array;
    pageCount: number;
    filename: string;
  } | null>(null);

  // Load thumbnails and page counts for newly added files
  useEffect(() => {
    files.forEach(async (item) => {
      if (!item.thumbnailUrl) {
        try {
          const thumb = await renderPdfPageToDataUrl(item.file, 1, 0.4);
          const count = await getPdfPageCount(item.file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, thumbnailUrl: thumb, pageCount: count } : f
            )
          );
        } catch (e) {
          console.warn('Could not render thumbnail for', item.name, e);
          // Graceful fallback: Clear faulty file from preview list automatically
          setFiles((prev) => prev.filter((f) => f.id !== item.id));
          alert(`Could not read PDF metadata for "${item.name}". The faulty file has been removed from the preview list.`);
        }
      }
    });
  }, [files, setFiles]);

  const handleAddFiles = async (newFiles: File[]) => {
    const newItems: UploadedFileItem[] = [];
    const faultyFiles: string[] = [];

    for (const file of newFiles) {
      // 1. Strict Size Check: reject under 5 KB
      if (file.size < 5 * 1024) {
        faultyFiles.push(file.name);
        continue;
      }

      try {
        const readyPdf = await getValidatedPdfFile(file);
        if (readyPdf.size < 5 * 1024) {
          faultyFiles.push(file.name);
          continue;
        }

        // Test that PDF loads safely with pdf-lib before adding to preview list
        const arrayBuffer = await readyPdf.arrayBuffer();
        await loadPdfSafely(arrayBuffer);

        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: readyPdf,
          name: readyPdf.name,
          size: readyPdf.size,
          pageCount: 1,
          pageRange: '',
        });
      } catch (err: any) {
        console.warn('File validation error:', err);
        faultyFiles.push(file.name);
      }
    }

    if (faultyFiles.length > 0) {
      alert("File is too small or empty. Please upload a valid PDF.");
    }

    if (newItems.length > 0) {
      setFiles((prev) => [...prev, ...newItems]);
      setMergedResult(null);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    const updated = [...files];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setFiles(updated);
  };

  const removeItem = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateRange = (id: string, range: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, pageRange: range } : f))
    );
  };

  const handleMerge = async () => {
    if (files.length === 0) return;

    // Check all files before processing
    const hasSmall = files.some((f) => f.size < 5 * 1024);
    if (hasSmall) {
      alert("File is too small or empty. Please upload a valid PDF.");
      // Automatically clear faulty files under 5KB
      setFiles((prev) => prev.filter((f) => f.size >= 5 * 1024));
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const payload = files.map((f) => ({
        file: f.file,
        pageRange: f.pageRange,
      }));

      // Ensure proper awaiting of array buffer saving
      const res = await mergePdfs(payload, (p) => setProgress(p));
      const cleanName = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`;

      setMergedResult({
        bytes: res.bytes,
        pageCount: res.pageCount,
        filename: cleanName,
      });

      // Auto trigger clean download with sliced buffer
      downloadBytes(res.bytes, cleanName);
    } catch (err: unknown) {
      console.error('Merge failed:', err);
      const msg = (err as Error).message || 'Failed to merge documents.';
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalInputPages = files.reduce((acc, f) => acc + (f.pageCount || 1), 0);
  const totalInputSize = files.reduce((acc, f) => acc + f.size, 0);

  if (files.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Merge PDF Files in Seconds
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Combine multiple documents, contracts, or presentations into a single organized PDF.
          </p>
        </div>

        <Dropzone
          onFilesSelected={handleAddFiles}
          onLoadSamples={onLoadSamples}
          multiple={true}
          title="Drop multiple PDF files to combine"
          subtitle="Re-order pages, pick custom page ranges, and merge instantly."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              Documents to Merge
            </span>
            <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drag handles or arrows to arrange the order of appearance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <label className="cursor-pointer px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <Plus className="w-3.5 h-3.5" />
            <span>Add More Files</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) handleAddFiles(Array.from(e.target.files));
              }}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              setFiles([]);
              setMergedResult(null);
            }}
            className="px-3 py-2 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Files List */}
      <div id="filePreviewList" className="file-preview-list space-y-3">
        {files.map((item, index) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            {/* Left: Thumbnail & details */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex flex-col items-center justify-center shrink-0 w-7 text-xs font-bold font-mono text-slate-400">
                #{index + 1}
              </div>

              {/* Cover thumbnail */}
              <div className="w-12 h-16 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-slate-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {item.name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono tabular-nums">{formatBytes(item.size)}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
                  <span>·</span>
                  <button
                    onClick={() => onPreviewPdf(item.file, undefined, item.name)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Quick Preview</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Middle: Page Range selector */}
            <div className="w-full sm:w-48 shrink-0">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Include Pages (e.g. 1-2, 4)
              </label>
              <input
                type="text"
                placeholder="All pages"
                value={item.pageRange || ''}
                onChange={(e) => updateRange(item.id, e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Right: Reorder & Remove Controls */}
            <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
              <button
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-25 transition-colors"
                title="Move Up"
              >
                <MoveUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveItem(index, 'down')}
                disabled={index === files.length - 1}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-25 transition-colors"
                title="Move Down"
              >
                <MoveDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeItem(item.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors ml-1"
                title="Remove File"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Merge Action Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Summary metrics */}
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Merged Estimate
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {totalInputPages}
              </span>
              <span className="text-xs text-slate-500">pages total</span>
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              Combined size approx {formatBytes(totalInputSize)}
            </p>
          </div>

          {/* Filename input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Output Filename
            </label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action button */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleMerge}
              disabled={isProcessing}
              className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Merging ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Merge {files.length} Documents</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Confirmation Card */}
        {mergedResult && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Successfully merged {mergedResult.pageCount} pages!
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {mergedResult.filename} ({formatBytes(mergedResult.bytes.byteLength)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() =>
                  onPreviewPdf(undefined, mergedResult.bytes, mergedResult.filename)
                }
                className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => downloadBytes(mergedResult.bytes, mergedResult.filename)}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
