import React, { useState } from 'react';
import {
  Layers,
  Minimize2,
  RotateCw,
  Stamp,
  Hash,
  Play,
  Download,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Archive,
  Tag,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  BatchQueueItem,
  BatchActionConfig,
  BatchRenameConfig,
} from '../types/pdf';
import {
  compressPdf,
  rotatePdfPages,
  applyWatermarkAndNumbers,
  applyPageNumbersToPdf,
  downloadBytes,
  formatBytes,
} from '../utils/pdfEngine';
import {
  getValidatedPdfFile,
  getMaxFileSizeLimit,
} from '../utils/justPdfSecurityProcessor';
import { getPdfPageCount } from '../utils/pdfRenderer';
import { performanceMonitor } from '../utils/performanceMonitor';

interface BatchToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

/**
 * Generate formatted filename according to user's auto-rename configuration
 */
export function generateBatchFilename(
  originalName: string,
  index: number,
  renameConfig: BatchRenameConfig,
  actionDefaultSuffix: string
): string {
  let baseName = originalName.replace(/\.pdf$/i, '');

  if (!renameConfig.enabled) {
    return `${baseName}${actionDefaultSuffix}.pdf`;
  }

  if (renameConfig.replaceSpacesWithUnderscore) {
    baseName = baseName.replace(/\s+/g, '_');
  }

  if (renameConfig.lowercase) {
    baseName = baseName.toLowerCase();
  }

  const prefix = renameConfig.prefix || '';
  const suffix = renameConfig.suffix !== undefined ? renameConfig.suffix : actionDefaultSuffix;

  // Numbering
  let numberPart = '';
  if (renameConfig.numbering === '1') {
    numberPart = `_${index + 1}`;
  } else if (renameConfig.numbering === '01') {
    numberPart = `_${String(index + 1).padStart(2, '0')}`;
  } else if (renameConfig.numbering === '001') {
    numberPart = `_${String(index + 1).padStart(3, '0')}`;
  }

  // Date
  let datePart = '';
  if (renameConfig.includeDate) {
    const today = new Date().toISOString().slice(0, 10);
    datePart = `_${today}`;
  }

  // Assemble and sanitize invalid filesystem characters
  let finalName = `${prefix}${baseName}${suffix}${numberPart}${datePart}`;
  finalName = finalName.replace(/[\\/:*?"<>|]/g, '_').trim();

  if (!finalName) {
    finalName = `processed_${index + 1}`;
  }

  return `${finalName}.pdf`;
}

export const BatchTool: React.FC<BatchToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [queue, setQueue] = useState<BatchQueueItem[]>([]);
  const [config, setConfig] = useState<BatchActionConfig>({
    action: 'compress',
    compressionLevel: 'recommended',
    rotationAngle: 90,
    watermarkText: 'CONFIDENTIAL',
    watermarkOpacity: 0.35,
    pageNumberPosition: 'bottom-center',
    rename: {
      enabled: true,
      prefix: 'yourPDFworld_',
      suffix: '',
      numbering: 'none',
      includeDate: false,
      replaceSpacesWithUnderscore: true,
      lowercase: false,
    },
  });

  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const getActionDefaultSuffix = (action: string) => {
    switch (action) {
      case 'compress':
        return '_compressed';
      case 'rotate':
        return '_rotated';
      case 'watermark':
        return '_watermarked';
      case 'pagenumber':
        return '_numbered';
      default:
        return '_processed';
    }
  };

  const handleFilesAdded = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsValidating(true);
    setValidationError(null);

    try {
      const processedFiles: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        if (file.size < 5 * 1024) {
          alert("File is too small or empty. Please upload a valid PDF.");
          errors.push(`${file.name}: File is too small or empty (< 5 KB).`);
          continue;
        }

        try {
          const validatedFile = await getValidatedPdfFile(file);
          if (validatedFile.size < 5 * 1024) {
            alert("File is too small or empty. Please upload a valid PDF.");
            errors.push(`${file.name}: File is too small or empty.`);
            continue;
          }
          processedFiles.push(validatedFile);
        } catch (err: any) {
          console.error(`Validation failed for ${file.name}:`, err);
          errors.push(`${file.name}: ${err.message || 'Validation error'}`);
        }
      }

      if (errors.length > 0) {
        setValidationError(errors.join('; '));
      }

      if (processedFiles.length > 0) {
        const newItems: BatchQueueItem[] = processedFiles.map((f) => ({
          id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: f,
          name: f.name,
          originalSize: f.size,
          status: 'waiting',
          progress: 0,
        }));
        setQueue((prev) => [...prev, ...newItems]);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueue([]);
    setBatchProgress(0);
  };

  const runSingleItem = async (item: BatchQueueItem, index: number): Promise<BatchQueueItem> => {
    const startTime = performance.now();
    try {
      let resultBytes: Uint8Array;

      if (config.action === 'compress') {
        const quality = config.compressionLevel === 'extreme' ? 0.35 : config.compressionLevel === 'low' ? 0.85 : 0.65;
        const targetDpi = config.compressionLevel === 'extreme' ? 96 : config.compressionLevel === 'low' ? 200 : 130;
        const res = await compressPdf(
          item.file,
          {
            level: config.compressionLevel,
            quality,
            targetDpi,
            grayscale: false,
          },
          (p: number) => {
            setQueue((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
            );
          }
        );
        resultBytes = res.bytes;
      } else if (config.action === 'rotate') {
        const pageCount = await getPdfPageCount(item.file);
        const pageRotations: { [pageIndex: number]: number } = {};
        for (let i = 0; i < pageCount; i++) {
          pageRotations[i] = config.rotationAngle;
        }
        const res = await rotatePdfPages(
          item.file,
          pageRotations,
          (p: number) => {
            setQueue((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
            );
          }
        );
        resultBytes = res.bytes;
      } else if (config.action === 'watermark') {
        const res = await applyWatermarkAndNumbers(
          item.file,
          {
            type: 'text',
            text: config.watermarkText || 'CONFIDENTIAL',
            opacity: config.watermarkOpacity,
            fontSize: 48,
            rotation: 45,
            color: '#dc2626',
            position: 'center',
          },
          undefined,
          (p: number) => {
            setQueue((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
            );
          }
        );
        resultBytes = res;
      } else {
        // Page numbers
        const res = await applyPageNumbersToPdf(
          item.file,
          {
            position: config.pageNumberPosition,
            font: 'Helvetica',
            fontSize: 10,
            color: '#000000',
            opacity: 0.85,
            format: 'page-x-of-y',
            startNumber: 1,
            firstPageToNumber: 1,
            marginHorizontal: 40,
            marginVertical: 30,
          },
          (p: number) => {
            setQueue((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
            );
          }
        );
        resultBytes = res.bytes;
      }

      const defaultSuffix = getActionDefaultSuffix(config.action);
      const resultFilename = generateBatchFilename(item.name, index, config.rename, defaultSuffix);

      const durationMs = Math.round(performance.now() - startTime);
      const compressedSize = resultBytes.byteLength;
      const reductionPercent = Math.max(
        0,
        Math.round(((item.originalSize - compressedSize) / item.originalSize) * 100)
      );

      return {
        ...item,
        status: 'done',
        progress: 100,
        resultBytes,
        resultFilename,
        compressedSize,
        reductionPercent,
        durationMs,
      };
    } catch (err: any) {
      console.error(`Error processing ${item.name}:`, err);
      return {
        ...item,
        status: 'error',
        progress: 0,
        errorMessage: err?.message || 'Processing failed',
      };
    }
  };

  const handleStartBatch = async () => {
    if (queue.length === 0 || isProcessingAll) return;

    setIsProcessingAll(true);
    setBatchProgress(0);

    const taskLabel = `Batch ${config.action.toUpperCase()} (${queue.length} files)`;
    performanceMonitor.startTask(taskLabel, queue.length);

    let completedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current.status === 'done') {
        completedCount++;
        continue;
      }

      setQueue((prev) =>
        prev.map((it) => (it.id === current.id ? { ...it, status: 'processing', progress: 10 } : it))
      );

      performanceMonitor.updateTask(
        completedCount,
        `Processing ${i + 1}/${queue.length}: ${current.name}`
      );

      const updated = await runSingleItem(current, i);

      setQueue((prev) =>
        prev.map((it) => (it.id === current.id ? updated : it))
      );

      completedCount++;
      const overallPercent = Math.round((completedCount / queue.length) * 100);
      setBatchProgress(overallPercent);
      performanceMonitor.updateTask(completedCount, `Completed ${completedCount}/${queue.length} files`);
    }

    performanceMonitor.finishTask(`Batch finished! Processed ${queue.length} documents.`);
    setIsProcessingAll(false);
  };

  const handleDownloadZip = async () => {
    const doneItems = queue.filter((it) => it.status === 'done' && it.resultBytes);
    if (doneItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const defaultSuffix = getActionDefaultSuffix(config.action);
      const usedFilenames = new Set<string>();

      doneItems.forEach((item, idx) => {
        const baseFilename = generateBatchFilename(item.name, idx, config.rename, defaultSuffix);
        let finalFilename = baseFilename;
        let dupCounter = 1;

        while (usedFilenames.has(finalFilename)) {
          finalFilename = baseFilename.replace(/\.pdf$/i, `_${dupCounter}.pdf`);
          dupCounter++;
        }
        usedFilenames.add(finalFilename);

        zip.file(finalFilename, item.resultBytes!);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;

      const zipPrefix = config.rename.enabled && config.rename.prefix ? config.rename.prefix.replace(/_$/, '') : 'yourPDFworld';
      const dateTag = new Date().toISOString().slice(0, 10);
      link.download = `${zipPrefix}_Batch_${config.action}_${dateTag}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const applyRenamePreset = (preset: 'branded' | 'action' | 'numbered' | 'dated') => {
    const actionSuffix = getActionDefaultSuffix(config.action);

    if (preset === 'branded') {
      setConfig((prev) => ({
        ...prev,
        rename: {
          ...prev.rename,
          enabled: true,
          prefix: 'yourPDFworld_',
          suffix: actionSuffix,
          numbering: 'none',
          includeDate: false,
          replaceSpacesWithUnderscore: true,
          lowercase: false,
        },
      }));
    } else if (preset === 'action') {
      setConfig((prev) => ({
        ...prev,
        rename: {
          ...prev.rename,
          enabled: true,
          prefix: '',
          suffix: actionSuffix,
          numbering: 'none',
          includeDate: false,
          replaceSpacesWithUnderscore: false,
          lowercase: false,
        },
      }));
    } else if (preset === 'numbered') {
      setConfig((prev) => ({
        ...prev,
        rename: {
          ...prev.rename,
          enabled: true,
          prefix: 'doc_',
          suffix: actionSuffix,
          numbering: '01',
          includeDate: false,
          replaceSpacesWithUnderscore: true,
          lowercase: true,
        },
      }));
    } else if (preset === 'dated') {
      setConfig((prev) => ({
        ...prev,
        rename: {
          ...prev.rename,
          enabled: true,
          prefix: '',
          suffix: actionSuffix,
          numbering: '01',
          includeDate: true,
          replaceSpacesWithUnderscore: true,
          lowercase: false,
        },
      }));
    }
  };

  const doneCount = queue.filter((i) => i.status === 'done').length;
  const sampleOriginalName = queue.length > 0 ? queue[0].name : 'Quarterly_Report_2026.pdf';
  const defaultSuffix = getActionDefaultSuffix(config.action);
  const sampleRenamedPreview = generateBatchFilename(sampleOriginalName, 0, config.rename, defaultSuffix);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Batch PDF Processing Queue
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Upload multiple PDF files, apply actions in bulk (compress, rotate, watermark, page numbers), and configure auto-rename patterns for individual or ZIP archive downloads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {doneCount > 0 && (
              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isZipping ? 'Archiving...' : `Download All (${doneCount}) as ZIP`}</span>
              </button>
            )}

            {queue.length > 0 && (
              <button
                onClick={handleClearQueue}
                disabled={isProcessingAll}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Queue</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: 1. Action Settings & 2. Auto-Rename Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Batch Action & Options */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              1. Select Batch Action
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Applied to all files</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(
              [
                { id: 'compress', label: 'Compress', icon: Minimize2 },
                { id: 'rotate', label: 'Rotate', icon: RotateCw },
                { id: 'watermark', label: 'Watermark', icon: Stamp },
                { id: 'pagenumber', label: 'Page Numbers', icon: Hash },
              ] as const
            ).map((act) => {
              const IconComp = act.icon;
              const isActive = config.action === act.id;
              return (
                <button
                  key={act.id}
                  onClick={() => setConfig({ ...config, action: act.id })}
                  disabled={isProcessingAll}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action-Specific Parameters */}
          <div className="pt-1 text-xs">
            {config.action === 'compress' && (
              <div className="space-y-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium block">Compression Preset:</span>
                <div className="space-y-1.5">
                  {(['recommended', 'extreme', 'low'] as const).map((level) => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="radio"
                        name="batchCompLevel"
                        checked={config.compressionLevel === level}
                        onChange={() => setConfig({ ...config, compressionLevel: level })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                        {level === 'recommended'
                          ? 'Recommended (~65% reduction, balanced clarity)'
                          : level === 'extreme'
                          ? 'Extreme (~85% reduction, maximum size drop)'
                          : 'Low / Lossless structure preservation'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {config.action === 'rotate' && (
              <div className="space-y-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium block">Rotation Angle:</span>
                <div className="flex flex-wrap items-center gap-4">
                  {([90, 180, 270] as const).map((deg) => (
                    <label key={deg} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="batchRotAngle"
                        checked={config.rotationAngle === deg}
                        onChange={() => setConfig({ ...config, rotationAngle: deg })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {deg === 90 ? '90° Clockwise' : deg === 180 ? '180° Half Turn' : '90° Counter-Clockwise'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {config.action === 'watermark' && (
              <div className="space-y-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium block">Watermark Text:</span>
                <input
                  type="text"
                  value={config.watermarkText}
                  onChange={(e) => setConfig({ ...config, watermarkText: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  placeholder="e.g. CONFIDENTIAL, DRAFT, REVIEW ONLY"
                />
              </div>
            )}

            {config.action === 'pagenumber' && (
              <div className="space-y-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium block">Page Number Placement:</span>
                <div className="flex flex-wrap items-center gap-4">
                  {(['bottom-center', 'bottom-right', 'top-right'] as const).map((pos) => (
                    <label key={pos} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="batchPnPos"
                        checked={config.pageNumberPosition === pos}
                        onChange={() => setConfig({ ...config, pageNumberPosition: pos })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                        {pos.replace('-', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Auto-Rename Pattern Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                2. Auto-Rename Output Files
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.rename.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rename: { ...config.rename, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enable Renaming
              </span>
            </label>
          </div>

          {config.rename.enabled ? (
            <div className="space-y-3.5 text-xs">
              {/* Prefix & Suffix Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Prefix (Prepend)
                  </label>
                  <input
                    type="text"
                    value={config.rename.prefix}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rename: { ...config.rename, prefix: e.target.value },
                      })
                    }
                    placeholder="e.g. yourPDFworld_ or ClientA_"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Suffix (Append)
                  </label>
                  <input
                    type="text"
                    value={config.rename.suffix}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rename: { ...config.rename, suffix: e.target.value },
                      })
                    }
                    placeholder={`e.g. ${defaultSuffix} or _v2`}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Numbering and Formatting Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Sequential Numbering
                  </label>
                  <select
                    value={config.rename.numbering}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rename: {
                          ...config.rename,
                          numbering: e.target.value as any,
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="none">None (Keep base name only)</option>
                    <option value="1">_1, _2, _3 (1-digit)</option>
                    <option value="01">_01, _02, _03 (2-digit)</option>
                    <option value="001">_001, _002, _003 (3-digit)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.rename.includeDate}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rename: {
                            ...config.rename,
                            includeDate: e.target.checked,
                          },
                        })
                      }
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Append Date tag (_{new Date().toISOString().slice(0, 10)})
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.rename.replaceSpacesWithUnderscore}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rename: {
                            ...config.rename,
                            replaceSpacesWithUnderscore: e.target.checked,
                          },
                        })
                      }
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Replace spaces with underscore (_)
                    </span>
                  </label>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                  Quick Naming Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyRenamePreset('branded')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    yourPDFworld_ Prefix
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRenamePreset('action')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    Action Suffix Only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRenamePreset('numbered')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    doc_01 Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRenamePreset('dated')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    Dated Archive
                  </button>
                </div>
              </div>

              {/* Live Filename Preview Box */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[11px] font-medium text-blue-900 dark:text-blue-300 block">
                  Live Output Sample (ZIP & Downloads):
                </span>
                <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 truncate block mt-0.5">
                  {sampleRenamedPreview}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
              Auto-rename is currently disabled. Files will keep original names with standard action suffix (e.g. <span className="font-mono font-semibold">{sampleOriginalName.replace(/\.pdf$/i, '')}{defaultSuffix}.pdf</span>).
            </div>
          )}
        </div>
      </div>

      {/* Queue Area */}
      {isValidating && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 flex items-center justify-center gap-3 text-sm text-blue-700 dark:text-blue-300">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Validating & Converting Documents (auto-wrapping images into PDFs)...</span>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-4 flex items-start gap-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">File Validation Issue:</span>
            <span className="text-xs">{validationError}</span>
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesAdded(Array.from(e.dataTransfer.files));
              }
            }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-8 sm:p-12 text-center bg-white dark:bg-slate-900 transition-colors"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              id="batchFileInput"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesAdded(Array.from(e.target.files));
                }
              }}
            />
            <label htmlFor="batchFileInput" className="cursor-pointer block space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 dark:text-white block">
                  Select Multiple PDF Documents or Images for Batch Queue
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  Drag & drop multiple files, or click to browse. Images (PNG/JPG/WebP) are automatically wrapped into clean PDFs.
                </span>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-1 block">
                  Smart Device Limit: Up to {Math.round(getMaxFileSizeLimit() / (1024 * 1024))}MB (Mobile: 50MB · Desktop: 150MB) · 100% Client-Side
                </span>
              </div>
              <div className="pt-2">
                <span className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-2xs hover:bg-blue-700 inline-block">
                  Browse Files
                </span>
              </div>
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
          {/* Queue Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Queue: {queue.length} document{queue.length > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-500">
                ({doneCount} of {queue.length} completed)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesAdded(Array.from(e.target.files));
                  }}
                />
              </label>

              <button
                onClick={handleStartBatch}
                disabled={isProcessingAll}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isProcessingAll ? `Processing (${batchProgress}%)...` : `Run Batch ${config.action.toUpperCase()}`}</span>
              </button>
            </div>
          </div>

          {/* Overall Batch Progress */}
          {isProcessingAll && (
            <div className="space-y-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 p-3 rounded-lg text-xs">
              <div className="flex items-center justify-between font-semibold text-blue-900 dark:text-blue-200">
                <span>Overall Batch Progress</span>
                <span className="font-mono">{batchProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${batchProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue Item Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {queue.map((item, index) => {
              const currentRenamedName = generateBatchFilename(
                item.name,
                index,
                config.rename,
                defaultSuffix
              );

              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* File Name & Rename Preview */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate block">
                          {item.name}
                        </span>
                        {config.rename.enabled && (
                          <span className="hidden md:inline text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                            → {currentRenamedName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span>{formatBytes(item.originalSize)}</span>
                        {item.compressedSize && (
                          <>
                            <span>→</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {formatBytes(item.compressedSize)} (-{item.reductionPercent}%)
                            </span>
                          </>
                        )}
                        {item.durationMs && (
                          <>
                            <span>·</span>
                            <span>{item.durationMs}ms</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Status */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="w-32 hidden sm:block">
                      {item.status === 'processing' && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {item.status === 'done' && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready</span>
                      </span>
                    )}

                    {item.status === 'processing' && (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                        Processing...
                      </span>
                    )}

                    {item.status === 'waiting' && (
                      <span className="text-slate-400">Waiting in queue</span>
                    )}

                    {item.status === 'error' && (
                      <span className="text-rose-500 flex items-center gap-1" title={item.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </span>
                    )}

                    {item.resultBytes && (
                      <button
                        onClick={() => downloadBytes(item.resultBytes!, currentRenamedName)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title={`Download as ${currentRenamedName}`}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      disabled={isProcessingAll}
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors disabled:opacity-30 cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
