import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  RotateCcw,
  Trash2,
  RefreshCw,
  Eye,
  Download,
  ArrowRight,
  MoveLeft,
  MoveRight,
  Layers,
  Undo2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { organizePdf, downloadBytes, formatBytes } from '../utils/pdfEngine';
import { renderAllPdfPagesToThumbnails, getPdfPageCount } from '../utils/pdfRenderer';
import { PageItem } from '../types/pdf';

interface OrganizeToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const OrganizeTool: React.FC<OrganizeToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!file) {
      setPages([]);
      setResultBytes(null);
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        const thumbs = await renderAllPdfPagesToThumbnails(file, 50, 0.4);

        if (!isMounted) return;

        const initialPages: PageItem[] = Array.from({ length: count }, (_, i) => ({
          id: `p-${i}`,
          originalIndex: i,
          rotation: 0,
          deleted: false,
          thumbnailUrl: thumbs[i] || '',
        }));

        setPages(initialPages);
      } catch (err) {
        console.error('Error loading pages for organize:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const rotatePage = (id: string, delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
      )
    );
  };

  const rotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + delta + 360) % 360 }))
    );
  };

  const toggleDelete = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deleted: !p.deleted } : p))
    );
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;
    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    setPages(updated);
  };

  const resetAll = () => {
    if (!file) return;
    setPages((prev) =>
      prev
        .sort((a, b) => a.originalIndex - b.originalIndex)
        .map((p) => ({ ...p, rotation: 0, deleted: false }))
    );
  };

  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(15);

    try {
      const active = pages.filter((p) => !p.deleted);
      if (active.length === 0) {
        alert('You must keep at least one page in the document.');
        setIsProcessing(false);
        return;
      }

      const res = await organizePdf(file, pages, (p) => setProgress(p));
      const cleanName = `${file.name.replace(/\.pdf$/i, '')}_organized.pdf`;

      setResultBytes(res.bytes);
      downloadBytes(res.bytes, cleanName);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || 'Failed to organize document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const activePagesCount = pages.filter((p) => !p.deleted).length;

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Organize, Rotate & Delete Pages
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Sort pages, fix upside-down scans, and delete unwanted sheets visually.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => setFile(files[0])}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to organize"
          subtitle="Rotate pages by 90°, rearrange their order, or remove pages before exporting."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {activePagesCount} active pages ({pages.length - activePagesCount} deleted) · {formatBytes(file.size)}
            </p>
          </div>
        </div>

        {/* Global batch actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => rotateAll(90)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            title="Rotate All Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate All</span>
          </button>

          <button
            onClick={resetAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setFile(null)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Change File
          </button>
        </div>
      </div>

      {/* Page Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pages.map((p, idx) => (
            <div
              key={p.id}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all relative ${
                p.deleted
                  ? 'border-dashed border-rose-300 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20 opacity-40'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Top controls: Page number & delete */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                  Page {idx + 1}
                  {p.rotation !== 0 && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal ml-1">
                      ({p.rotation}°)
                    </span>
                  )}
                </span>

                <button
                  onClick={() => toggleDelete(p.id)}
                  className={`p-1 rounded text-xs transition-colors ${
                    p.deleted
                      ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  }`}
                  title={p.deleted ? 'Restore Page' : 'Delete Page'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Thumbnail Container */}
              <div className="aspect-[3/4] w-full rounded-md bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 relative shadow-2xs my-1">
                {p.thumbnailUrl ? (
                  <img
                    src={p.thumbnailUrl}
                    alt={`Page ${idx + 1}`}
                    style={{ transform: `rotate(${p.rotation}deg)` }}
                    className="w-full h-full object-contain transition-transform duration-200"
                  />
                ) : (
                  <FileText className="w-8 h-8 text-slate-300" />
                )}

                {p.deleted && (
                  <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs">
                      Deleted
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Actions: Rotate & Move */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-slate-500">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => rotatePage(p.id, -90)}
                    disabled={p.deleted}
                    className="p-1 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                    title="Rotate -90°"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => rotatePage(p.id, 90)}
                    disabled={p.deleted}
                    className="p-1 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                    title="Rotate +90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => movePage(idx, 'left')}
                    disabled={idx === 0 || p.deleted}
                    className="p-1 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-20"
                    title="Move Left"
                  >
                    <MoveLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => movePage(idx, 'right')}
                    disabled={idx === pages.length - 1 || p.deleted}
                    className="p-1 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-20"
                    title="Move Right"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Export Organized PDF
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activePagesCount} pages will be rendered with custom orientation and sequence.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isProcessing || activePagesCount === 0}
          className="w-full sm:w-auto px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Exporting ({progress}%)...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download Organized PDF</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {resultBytes && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Document organized and downloaded successfully!</span>
          </div>

          <button
            onClick={() =>
              onPreviewPdf(
                undefined,
                resultBytes,
                `${file.name.replace(/\.pdf$/i, '')}_organized.pdf`
              )
            }
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Result</span>
          </button>
        </div>
      )}
    </div>
  );
};
