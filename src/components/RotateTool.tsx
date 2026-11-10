import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  RotateCcw,
  RefreshCw,
  Eye,
  Download,
  ArrowRight,
  CheckCircle2,
  FileText,
  Undo2,
  Compass,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { rotatePdfPages, downloadBytes, formatBytes } from '../utils/pdfEngine';
import { renderAllPdfPagesToThumbnails, getPdfPageCount } from '../utils/pdfRenderer';

interface RotateToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

interface PageRotationItem {
  pageIndex: number;
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl?: string;
}

export const RotateTool: React.FC<RotateToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageRotationItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);

  useEffect(() => {
    if (!file) {
      setPages([]);
      setResult(null);
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        const thumbs = await renderAllPdfPagesToThumbnails(file, 60, 0.4);

        if (!isMounted) return;

        const initialList: PageRotationItem[] = Array.from({ length: count }, (_, i) => ({
          pageIndex: i,
          rotation: 0,
          thumbnailUrl: thumbs[i] || '',
        }));

        setPages(initialList);
      } catch (err) {
        console.error('Failed to load PDF for rotation:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const rotatePage = (pageIndex: number, delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageIndex === pageIndex
          ? { ...p, rotation: (p.rotation + delta + 360) % 360 }
          : p
      )
    );
  };

  const rotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  const rotateOddOnly = (delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        (p.pageIndex + 1) % 2 !== 0
          ? { ...p, rotation: (p.rotation + delta + 360) % 360 }
          : p
      )
    );
  };

  const rotateEvenOnly = (delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        (p.pageIndex + 1) % 2 === 0
          ? { ...p, rotation: (p.rotation + delta + 360) % 360 }
          : p
      )
    );
  };

  const resetAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: 0 })));
  };

  const rotatedPagesCount = pages.filter((p) => p.rotation !== 0).length;

  const handleSaveAndDownload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(15);

    try {
      const rotationMap: { [pageIndex: number]: number } = {};
      pages.forEach((p) => {
        if (p.rotation !== 0) {
          rotationMap[p.pageIndex] = p.rotation;
        }
      });

      const res = await rotatePdfPages(file, rotationMap, (p) => setProgress(p));
      setResult(res);

      // Trigger browser download
      downloadBytes(res.bytes, res.filename);
    } catch (err: unknown) {
      console.error('Failed to rotate document:', err);
      alert((err as Error).message || 'Failed to rotate PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Rotate PDF Pages Permanently
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Fix upside-down scans and misaligned pages. Rotate individual pages or all pages by 90° or 180°.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => {
            setFile(files[0]);
            setResult(null);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to rotate pages"
          subtitle="Rotate specific sheets or all pages by 90°, 180°, or 270° with instant visual preview."
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
            <RotateCw className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{pages.length} pages</span>
              <span>·</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                {rotatedPagesCount} {rotatedPagesCount === 1 ? 'page modified' : 'pages modified'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setFile(null);
            setResult(null);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Change File
        </button>
      </div>

      {/* Global Quick Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Batch Rotation Controls
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Apply orientation transforms across all or alternating pages at once.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => rotateAll(90)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
            title="Rotate All +90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-500" />
            <span>All +90° Right</span>
          </button>

          <button
            onClick={() => rotateAll(-90)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
            title="Rotate All -90° Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
            <span>All -90° Left</span>
          </button>

          <button
            onClick={() => rotateAll(180)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
            title="Flip All 180°"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
            <span>Flip 180°</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={() => rotateOddOnly(90)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Rotate Odd Pages +90°"
          >
            Odd Pages +90°
          </button>

          <button
            onClick={() => rotateEvenOnly(90)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Rotate Even Pages +90°"
          >
            Even Pages +90°
          </button>

          <button
            onClick={resetAll}
            disabled={rotatedPagesCount === 0}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {pages.map((p) => {
            const isRotated = p.rotation !== 0;

            return (
              <div
                key={p.pageIndex}
                className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                  isRotated
                    ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Page Number & Angle Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                    Page {p.pageIndex + 1}
                  </span>

                  {isRotated ? (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {p.rotation}°
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      0°
                    </span>
                  )}
                </div>

                {/* Thumbnail with CSS Transform */}
                <div className="aspect-[3/4] w-full rounded-md bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200/80 dark:border-slate-700 relative shadow-2xs my-1">
                  {p.thumbnailUrl ? (
                    <img
                      src={p.thumbnailUrl}
                      alt={`Page ${p.pageIndex + 1}`}
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                      className="w-full h-full object-contain transition-transform duration-200"
                    />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                {/* Per-Page Rotation Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 mt-2 text-slate-600 dark:text-slate-400">
                  <button
                    onClick={() => rotatePage(p.pageIndex, -90)}
                    className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Rotate -90° Left"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => rotatePage(p.pageIndex, 180)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Flip 180°"
                  >
                    180°
                  </button>

                  <button
                    onClick={() => rotatePage(p.pageIndex, 90)}
                    className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Rotate +90° Right"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save & Download Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Apply Permanent Rotations
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {rotatedPagesCount === 0
              ? 'No pages modified yet. Adjust orientation above.'
              : `${rotatedPagesCount} of ${pages.length} pages will have new orientations saved permanently.`}
          </p>
        </div>

        <button
          onClick={handleSaveAndDownload}
          disabled={isProcessing}
          className="w-full sm:w-auto px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving ({progress}%)...</span>
            </>
          ) : (
            <>
              <RotateCw className="w-4 h-4" />
              <span>Download Rotated PDF</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Result Confirmation */}
      {result && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Rotations Successfully Applied & Saved!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {result.filename} ({formatBytes(result.bytes.byteLength)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onPreviewPdf(undefined, result.bytes, result.filename)}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Result</span>
            </button>

            <button
              onClick={() => downloadBytes(result.bytes, result.filename)}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
