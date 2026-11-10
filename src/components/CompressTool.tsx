import React, { useState, useEffect, useRef } from 'react';
import {
  Minimize2,
  Download,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Layers,
  Sliders,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  HelpCircle,
  HardDrive,
  Target,
  Maximize2,
  Columns,
  SplitSquareVertical,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import {
  compressPdf,
  downloadBytes,
  formatBytes,
  estimateCompressedSize,
  loadPdfSafely,
} from '../utils/pdfEngine';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { CompressionLevel, CompressionOptions } from '../types/pdf';

interface CompressToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

type TargetPreset = '100kb' | '200kb' | '500kb' | '1mb' | 'custom';

export const CompressTool: React.FC<CompressToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [originalThumbnail, setOriginalThumbnail] = useState<string | null>(null);

  // Compression Configuration
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [grayscale, setGrayscale] = useState(false);
  const [targetPreset, setTargetPreset] = useState<TargetPreset>('500kb');
  const [customTargetVal, setCustomTargetVal] = useState<number>(300);
  const [customTargetUnit, setCustomTargetUnit] = useState<'kb' | 'mb'>('kb');

  // Execution & Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result State
  const [result, setResult] = useState<{
    bytes: Uint8Array;
    originalSize: number;
    newSize: number;
    savedPercent: number;
    filename: string;
  } | null>(null);

  // Before & After Preview State
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [compressedPreviewUrl, setCompressedPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<'side-by-side' | 'tabbed'>('side-by-side');
  const [activeTabPreview, setActiveTabPreview] = useState<'after' | 'before'>('after');
  const [previewZoom, setPreviewZoom] = useState<number>(1);

  // Compute active target size in bytes when level === 'target'
  const getTargetSizeBytes = (): number => {
    switch (targetPreset) {
      case '100kb':
        return 100 * 1024;
      case '200kb':
        return 200 * 1024;
      case '500kb':
        return 500 * 1024;
      case '1mb':
        return 1024 * 1024;
      case 'custom':
        return customTargetUnit === 'mb'
          ? Math.max(50 * 1024, customTargetVal * 1024 * 1024)
          : Math.max(50 * 1024, customTargetVal * 1024);
      default:
        return 500 * 1024;
    }
  };

  // Build active options object
  const currentOptions: CompressionOptions = {
    level,
    quality:
      level === 'extreme'
        ? 0.45
        : level === 'recommended'
        ? 0.72
        : level === 'target'
        ? 0.65
        : 0.9,
    targetDpi: level === 'extreme' ? 96 : level === 'recommended' ? 135 : 150,
    grayscale,
    targetSizeBytes: level === 'target' ? getTargetSizeBytes() : undefined,
  };

  // Estimated output size
  const estimate = file ? estimateCompressedSize(file.size, totalPages, currentOptions) : null;

  // Load document metadata & initial thumbnail upon file selection
  useEffect(() => {
    if (!file) {
      setOriginalThumbnail(null);
      setTotalPages(1);
      setResult(null);
      setErrorMessage(null);
      setOriginalPreviewUrl(null);
      setCompressedPreviewUrl(null);
      return;
    }

    let isMounted = true;
    setErrorMessage(null);

    const init = async () => {
      // 1. Strict Size Check: If under 5 KB, alert and abort processing
      if (file.size < 5 * 1024) {
        if (isMounted) {
          alert("File is too small or empty. Please upload a valid PDF.");
          handleClearFile();
        }
        return;
      }

      try {
        // Pre-validate that PDF metadata can be safely loaded
        const arrayBuffer = await file.arrayBuffer();
        await loadPdfSafely(arrayBuffer);

        const count = await getPdfPageCount(file);
        const thumb = await renderPdfPageToDataUrl(file, 1, 0.45);
        if (isMounted) {
          setTotalPages(count);
          setOriginalThumbnail(thumb);
          setPreviewPage(1);
        }
      } catch (err: any) {
        console.error('Failed to load document info:', err);
        if (isMounted) {
          const msg = err?.message || '';
          if (msg.includes('too small') || msg.includes('empty')) {
            alert("File is too small or empty. Please upload a valid PDF.");
          } else if (msg.toLowerCase().includes('password') || err?.name === 'PasswordException') {
            alert("This PDF is password-protected. Please unlock or decrypt it first.");
          } else {
            alert("Could not read PDF metadata. The file may be damaged or unsupported.");
          }
          // 2. Graceful Fallback: Clear the faulty file from preview list automatically
          handleClearFile();
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [file]);

  // Load high-res before & after renders for the selected preview page
  useEffect(() => {
    if (!result || !file) return;

    let isMounted = true;
    setLoadingPreview(true);

    const loadComparison = async () => {
      try {
        const [origUrl, compUrl] = await Promise.all([
          renderPdfPageToDataUrl(file, previewPage, 1.0),
          renderPdfPageToDataUrl(result.bytes, previewPage, 1.0),
        ]);
        if (isMounted) {
          setOriginalPreviewUrl(origUrl);
          setCompressedPreviewUrl(compUrl);
          setLoadingPreview(false);
        }
      } catch (err) {
        console.error('Failed to render comparison pages:', err);
        if (isMounted) setLoadingPreview(false);
      }
    };

    loadComparison();
    return () => {
      isMounted = false;
    };
  }, [result, file, previewPage]);

  // Clean memory when clearing document
  const handleClearFile = () => {
    setFile(null);
    setResult(null);
    setOriginalThumbnail(null);
    setOriginalPreviewUrl(null);
    setCompressedPreviewUrl(null);
    setErrorMessage(null);
    setProgress(0);
    setIsProcessing(false);
  };

  const handleCompress = async () => {
    if (!file) return;

    if (file.size < 5 * 1024) {
      alert("File is too small or empty. Please upload a valid PDF.");
      handleClearFile();
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setProgressStage('Analyzing document structure & pages...');
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await compressPdf(file, currentOptions, (p) => {
        setProgress(p);
        if (p < 25) {
          setProgressStage('Analyzing document pages & metadata...');
        } else if (p < 85) {
          setProgressStage('Downsampling & compressing visual layers...');
        } else {
          setProgressStage('Compacting object streams & saving PDF...');
        }
      });

      const cleanName = `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`;

      setResult({
        bytes: res.bytes,
        originalSize: res.originalSize,
        newSize: res.newSize,
        savedPercent: res.savedPercent,
        filename: cleanName,
      });

      // Auto download
      downloadBytes(res.bytes, cleanName);
    } catch (err: unknown) {
      console.error('Compression failed:', err);
      const msg = (err as Error).message || 'Failed to compress document.';
      alert(msg);
      // Graceful fallback: clear the faulty file from the preview list automatically and let the user try again
      handleClearFile();
    } finally {
      setIsProcessing(false);
    }
  };

  // When no file is loaded, show clean dropzone
  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Compress PDF Online Without Losing Quality
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Dramatically shrink document file sizes for emails, job applications, and portal upload limits.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => {
            const selected = files[0];
            if (!selected) return;
            if (selected.size < 5 * 1024) {
              alert("File is too small or empty. Please upload a valid PDF.");
              handleClearFile();
              return;
            }
            handleClearFile();
            setFile(selected);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to compress"
          subtitle="Choose between Recommended, Extreme, Lossless structure, or Target file size."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. File Info Card with Mobile-Safe Filename & Thumbnail Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
          {/* Document Thumbnail or Icon */}
          <div className="w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
            {originalThumbnail ? (
              <img
                src={originalThumbnail}
                alt={file.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Minimize2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>

          {/* Filename with Mobile-Safe Truncation */}
          <div className="min-w-0 flex-1">
            <h3
              title={file.name}
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate max-w-[210px] xs:max-w-[260px] sm:max-w-xs md:max-w-md lg:max-w-lg cursor-default"
            >
              {file.name}
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                {formatBytes(file.size)}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {totalPages} {totalPages === 1 ? 'page' : 'pages'}
              </span>
              <span>·</span>
              <button
                type="button"
                onClick={() => onPreviewPdf(file, undefined, file.name)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Document</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick File Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleClearFile}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Remove file and release memory"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear File</span>
          </button>
        </div>
      </div>

      {/* Error Callout if any */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-xs animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold">Compression Notice</p>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 dark:text-rose-400 hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Compression Mode & Target Size Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Compression Mode
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select standard optimization or define a specific target file size.
            </p>
          </div>

          {/* Heuristic Output Estimate Badge */}
          {estimate && (
            <div className="self-start sm:self-center">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                  estimate.isReliable
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title={estimate.label}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[260px]">{estimate.label}</span>
              </span>
            </div>
          )}
        </div>

        {/* 4 Cards Grid: Recommended, Extreme, Lossless, Target Size */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Recommended */}
          <div
            onClick={() => setLevel('recommended')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              level === 'recommended'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/60 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Recommended</span>
                </span>
                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  ~50% - 70% Less
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Balanced optimization (135 DPI) for email sending and document portals with high visual clarity.
              </p>
            </div>
          </div>

          {/* Extreme Compression */}
          <div
            onClick={() => setLevel('extreme')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              level === 'extreme'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/60 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Minimize2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Extreme</span>
                </span>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                  ~75% - 85% Less
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Maximum file reduction (96 DPI). Best when you face rigid file size caps (e.g. 500 KB limits).
              </p>
            </div>
          </div>

          {/* Lossless Structure */}
          <div
            onClick={() => setLevel('low')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              level === 'low'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/60 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Lossless</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  100% Quality
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Strips unreferenced object streams and cleans metadata without re-encoding page images.
              </p>
            </div>
          </div>

          {/* Target File Size */}
          <div
            onClick={() => setLevel('target')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              level === 'target'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/60 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Target Size</span>
                </span>
                <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                  Custom Cap
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Aim for a specific size cap (e.g. 200 KB, 500 KB, or 1 MB) with adaptive downsampling.
              </p>
            </div>
          </div>
        </div>

        {/* Target Size Options Panel (Displayed when Target Size mode selected) */}
        {level === 'target' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Choose Target File Size:</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Resolution and quality auto-scale to approach target
              </span>
            </div>

            {/* Presets: 100 KB, 200 KB, 500 KB, 1 MB, Custom */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { id: '100kb', label: '100 KB', bytes: 100 * 1024 },
                  { id: '200kb', label: '200 KB', bytes: 200 * 1024 },
                  { id: '500kb', label: '500 KB', bytes: 500 * 1024 },
                  { id: '1mb', label: '1 MB', bytes: 1024 * 1024 },
                  { id: 'custom', label: 'Custom', bytes: 0 },
                ] as const
              ).map((preset) => {
                const isSelected = targetPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setTargetPreset(preset.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom target input when Custom selected */}
            {targetPreset === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Custom Size Cap:
                </span>
                <input
                  type="number"
                  min="20"
                  max="50000"
                  value={customTargetVal}
                  onChange={(e) => setCustomTargetVal(Math.max(10, parseInt(e.target.value, 10) || 50))}
                  className="w-24 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono text-slate-900 dark:text-white"
                />
                <select
                  value={customTargetUnit}
                  onChange={(e) => setCustomTargetUnit(e.target.value as 'kb' | 'mb')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="kb">KB</option>
                  <option value="mb">MB</option>
                </select>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({formatBytes(getTargetSizeBytes())})
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. Grayscale Option with Clear Educational Explanation */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={grayscale}
              onChange={(e) => setGrayscale(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Convert Document to Grayscale (Black & White)
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Strips RGB color channels and converts images to monochromatic tones. Saves an extra ~15%–25% in file size. Ideal for black-and-white documents, forms, receipts, contracts, and office printouts.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Action & Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          <span className="text-sm font-semibold text-slate-900 dark:text-white block">
            Ready to Optimize Document
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selected: <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">{level === 'target' ? `Target (${formatBytes(getTargetSizeBytes())})` : level}</span> mode
            {grayscale ? ' with grayscale conversion' : ''}.
          </p>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCompress}
            disabled={isProcessing}
            className="w-full sm:w-auto px-6 py-3.5 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 disabled:opacity-50 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Optimizing ({progress}%)...</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4" />
                <span>Compress PDF Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Processing Multi-Stage Progress Indicator */}
      {isProcessing && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{progressStage}</span>
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 5. Result Card with Actual Stats, Prominent Download & Quick Actions */}
      {result && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 space-y-6 animate-in fade-in-50 duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Compression Finished Successfully!</span>
              </div>

              {/* Stats Grid: Before, After, Saved % */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Original Size
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-500 dark:text-slate-400 line-through tabular-nums">
                    {formatBytes(result.originalSize)}
                  </span>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block" />

                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Compressed Size
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatBytes(result.newSize)}
                  </span>
                </div>

                <div className="bg-emerald-100 dark:bg-emerald-900/60 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    {result.savedPercent}% Smaller!
                  </span>
                  <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">
                    Saved {formatBytes(Math.max(0, result.originalSize - result.newSize))}
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent Download Button & Compress Another Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <button
                onClick={() => downloadBytes(result.bytes, result.filename)}
                className="px-6 py-3.5 text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Compressed PDF</span>
              </button>

              <button
                onClick={handleClearFile}
                className="px-4 py-3.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Compress Another PDF</span>
              </button>
            </div>
          </div>

          {/* 6. Before & After Interactive PDF Preview */}
          <div className="pt-6 border-t border-emerald-200/60 dark:border-emerald-800/40 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Before & After Visual Comparison
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify visual clarity, fonts, and images between original and compressed files.
                </p>
              </div>

              {/* Controls: Layout toggle, Zoom, Page Stepper */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mobile / Desktop View Mode */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewLayout('side-by-side')}
                    className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                      previewLayout === 'side-by-side'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Side by Side Comparison"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Side-by-Side</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLayout('tabbed')}
                    className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                      previewLayout === 'tabbed'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Tabbed Split View"
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tabs</span>
                  </button>
                </div>

                {/* Page Stepper */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    disabled={previewPage <= 1 || loadingPreview}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {previewPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={previewPage >= totalPages || loadingPreview}
                    onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom Stepper */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.max(0.75, z - 0.25))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.min(2.0, z + 0.25))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabbed view selector if in tabbed mode */}
            {previewLayout === 'tabbed' && (
              <div className="flex items-center gap-2 border-b border-emerald-200/40 dark:border-emerald-800/30 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTabPreview('after')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTabPreview === 'after'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Compressed (After) · {formatBytes(result.newSize)}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabPreview('before')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTabPreview === 'before'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Original (Before) · {formatBytes(result.originalSize)}
                </button>
              </div>
            )}

            {/* Comparison Canvas Grid */}
            <div className="overflow-x-auto pb-2 scrollbar-none">
              {loadingPreview ? (
                <div className="h-64 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : previewLayout === 'side-by-side' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before / Original */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-700 dark:text-slate-300">Original (Before)</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {formatBytes(result.originalSize)}
                      </span>
                    </div>
                    <div className="aspect-[3/4] w-full rounded bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {originalPreviewUrl && (
                        <img
                          src={originalPreviewUrl}
                          alt="Original page preview"
                          style={{ transform: `scale(${previewZoom})` }}
                          className="max-h-full max-w-full object-contain transition-transform"
                        />
                      )}
                    </div>
                  </div>

                  {/* After / Compressed */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-300 dark:border-emerald-800/80 p-3 shadow-2xs space-y-2 ring-1 ring-emerald-500/20">
                    <div className="flex items-center justify-between text-xs font-semibold pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        Compressed (After)
                      </span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 tabular-nums font-bold">
                        {formatBytes(result.newSize)} ({result.savedPercent}% less)
                      </span>
                    </div>
                    <div className="aspect-[3/4] w-full rounded bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {compressedPreviewUrl && (
                        <img
                          src={compressedPreviewUrl}
                          alt="Compressed page preview"
                          style={{ transform: `scale(${previewZoom})` }}
                          className="max-h-full max-w-full object-contain transition-transform"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Tabbed View */
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
                  <div className="aspect-[3/4] max-h-[500px] w-full mx-auto rounded bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                    {activeTabPreview === 'after' && compressedPreviewUrl && (
                      <img
                        src={compressedPreviewUrl}
                        alt="Compressed page preview"
                        style={{ transform: `scale(${previewZoom})` }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                    )}
                    {activeTabPreview === 'before' && originalPreviewUrl && (
                      <img
                        src={originalPreviewUrl}
                        alt="Original page preview"
                        style={{ transform: `scale(${previewZoom})` }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
