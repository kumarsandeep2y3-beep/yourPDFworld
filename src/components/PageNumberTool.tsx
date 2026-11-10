import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Download,
  Eye,
  CheckCircle2,
  Sliders,
  Type,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import {
  applyPageNumbersToPdf,
  downloadBytes,
  formatBytes,
  formatPageNumberText,
} from '../utils/pdfEngine';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import {
  PageNumberConfig,
  PageNumberFont,
  PageNumberFormat,
  PageNumberPosition,
} from '../types/pdf';

interface PageNumberToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const PageNumberTool: React.FC<PageNumberToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Configuration State
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [font, setFont] = useState<PageNumberFont>('Helvetica');
  const [fontSize, setFontSize] = useState<number>(11);
  const [color, setColor] = useState<string>('#334155');
  const [opacity, setOpacity] = useState<number>(0.9);
  const [format, setFormat] = useState<PageNumberFormat>('page-x-of-y');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [firstPageToNumber, setFirstPageToNumber] = useState<number>(1);
  const [lastPageToNumber, setLastPageToNumber] = useState<number | undefined>(undefined);
  const [marginHorizontal, setMarginHorizontal] = useState<number>(36);
  const [marginVertical, setMarginVertical] = useState<number>(28);
  const [customPrefix, setCustomPrefix] = useState<string>('P. ');
  const [customSuffix, setCustomSuffix] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultFilename, setResultFilename] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load document stats on file change
  useEffect(() => {
    if (!file) {
      setPagePreviewUrl(null);
      setResultBytes(null);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        if (isMounted) {
          setTotalPages(count);
          setCurrentPage(1);
          setLastPageToNumber(count);
        }
      } catch (err) {
        console.error('Failed to get page count:', err);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [file]);

  // Load preview image when current page changes
  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    setLoadingPreview(true);

    const loadPage = async () => {
      try {
        const url = await renderPdfPageToDataUrl(file, currentPage, 1.2);
        if (isMounted) {
          setPagePreviewUrl(url);
          setLoadingPreview(false);
        }
      } catch (err) {
        console.error('Failed to render preview page:', err);
        if (isMounted) setLoadingPreview(false);
      }
    };

    loadPage();
    return () => {
      isMounted = false;
    };
  }, [file, currentPage]);

  // Redraw canvas with accurate live page number overlay
  useEffect(() => {
    if (!pagePreviewUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = pagePreviewUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw background PDF page
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Check if current page is within numbered range
      const endPage = lastPageToNumber && lastPageToNumber > 0 ? lastPageToNumber : totalPages;
      const isNumbered = currentPage >= firstPageToNumber && currentPage <= endPage;

      if (!isNumbered) {
        // Draw a light badge indicating page is skipped
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Page ${currentPage} skipped (numbering starts on Page ${firstPageToNumber})`,
          canvas.width / 2,
          40
        );
        ctx.restore();
        return;
      }

      // Compute page number text
      const calculatedNumber = (currentPage - firstPageToNumber) + startNumber;
      const text = formatPageNumberText(
        calculatedNumber,
        totalPages,
        format,
        customPrefix,
        customSuffix
      );

      // Map font to canvas font family
      let fontFamily = 'sans-serif';
      let isBold = font.includes('Bold');
      if (font.includes('Times')) fontFamily = 'serif';
      if (font.includes('Courier')) fontFamily = 'monospace';

      // Scale factor from PDF points (72dpi) to canvas pixels (typically 1.2 * 72 ~ 86.4dpi)
      const scale = canvas.width / 595.28; // standard A4 pt width reference
      const scaledFontSize = Math.max(12, Math.round(fontSize * scale));

      ctx.save();
      ctx.font = `${isBold ? 'bold ' : ''}${scaledFontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      const textWidth = ctx.measureText(text).width;
      const scaledMarginX = marginHorizontal * scale;
      const scaledMarginY = marginVertical * scale;

      let x = (canvas.width - textWidth) / 2;
      let y = canvas.height - scaledMarginY;

      switch (position) {
        case 'bottom-left':
          x = scaledMarginX;
          y = canvas.height - scaledMarginY;
          break;
        case 'bottom-center':
          x = (canvas.width - textWidth) / 2;
          y = canvas.height - scaledMarginY;
          break;
        case 'bottom-right':
          x = canvas.width - textWidth - scaledMarginX;
          y = canvas.height - scaledMarginY;
          break;
        case 'top-left':
          x = scaledMarginX;
          y = scaledMarginY + scaledFontSize;
          break;
        case 'top-center':
          x = (canvas.width - textWidth) / 2;
          y = scaledMarginY + scaledFontSize;
          break;
        case 'top-right':
          x = canvas.width - textWidth - scaledMarginX;
          y = scaledMarginY + scaledFontSize;
          break;
      }

      // Highlight bounding box around active page number
      ctx.save();
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      const pad = 4 * scale;
      ctx.fillRect(x - pad, y - scaledFontSize - pad / 2, textWidth + pad * 2, scaledFontSize + pad * 1.5);
      ctx.strokeRect(x - pad, y - scaledFontSize - pad / 2, textWidth + pad * 2, scaledFontSize + pad * 1.5);
      ctx.restore();

      ctx.fillText(text, x, y);
      ctx.restore();
    };
  }, [
    pagePreviewUrl,
    position,
    font,
    fontSize,
    color,
    opacity,
    format,
    startNumber,
    firstPageToNumber,
    lastPageToNumber,
    marginHorizontal,
    marginVertical,
    customPrefix,
    customSuffix,
    currentPage,
    totalPages,
  ]);

  const handleApplyNumbers = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);
    setResultBytes(null);

    try {
      const config: PageNumberConfig = {
        position,
        font,
        fontSize,
        color,
        opacity,
        format,
        startNumber,
        firstPageToNumber,
        lastPageToNumber: lastPageToNumber && lastPageToNumber > 0 ? lastPageToNumber : totalPages,
        marginHorizontal,
        marginVertical,
        customPrefix,
        customSuffix,
      };

      const result = await applyPageNumbersToPdf(file, config, (p) => setProgress(p));
      setResultBytes(result.bytes);
      setResultFilename(result.filename);
      downloadBytes(result.bytes, result.filename);
    } catch (err: unknown) {
      console.error('Failed to apply page numbers:', err);
      alert((err as Error).message || 'Failed to apply page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  const colorPresets = [
    { label: 'Charcoal', value: '#1e293b' },
    { label: 'Slate Gray', value: '#64748b' },
    { label: 'Deep Navy', value: '#1e3a8a' },
    { label: 'Indigo', value: '#4f46e5' },
    { label: 'Crimson', value: '#b91c1c' },
    { label: 'Pure Black', value: '#000000' },
  ];

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Add Page Numbers to PDF
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Insert customizable headers and footers with page numbers, fonts, custom starting indices, and positions.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => {
            setFile(files[0]);
            setResultBytes(null);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to add page numbers"
          subtitle="Customize numbering position, font family, style, starting number, and skip cover pages."
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
            <Hash className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
              <span>·</span>
              <button
                onClick={() => onPreviewPdf(file, undefined, file.name)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Eye className="w-3 h-3" />
                <span>Original Document</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setFile(null);
            setResultBytes(null);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Change File
        </button>
      </div>

      {/* Main Two-Column Layout: Controls & Live Canvas Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Settings */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Position Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                1. Page Number Position
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Choose header or footer placement
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-center', label: 'Top Center' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                  { id: 'bottom-center', label: 'Bottom Center' },
                  { id: 'bottom-right', label: 'Bottom Right' },
                ] as const
              ).map((pos) => {
                const isSelected = position === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setPosition(pos.id)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-6 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative flex items-center justify-center">
                      <span
                        className={`w-2 h-1 rounded-xs bg-indigo-600 absolute ${
                          pos.id === 'top-left'
                            ? 'top-0.5 left-1'
                            : pos.id === 'top-center'
                            ? 'top-0.5 left-3'
                            : pos.id === 'top-right'
                            ? 'top-0.5 right-1'
                            : pos.id === 'bottom-left'
                            ? 'bottom-0.5 left-1'
                            : pos.id === 'bottom-center'
                            ? 'bottom-0.5 left-3'
                            : 'bottom-0.5 right-1'
                        }`}
                      />
                    </div>
                    <span>{pos.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Format & Numbering Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                2. Format & Starting Index
              </span>
            </div>

            {/* Format Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Numbering Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'page-x-of-y', label: 'Page 1 of 10', desc: 'Standard format' },
                    { id: 'page-x', label: 'Page 1', desc: 'Simple page' },
                    { id: 'x-of-y', label: '1 / 10', desc: 'Compact ratio' },
                    { id: 'numbers-only', label: '1, 2, 3', desc: 'Digits only' },
                    { id: 'hyphenated', label: '- 1 -', desc: 'Booklet style' },
                    { id: 'custom', label: 'Custom', desc: 'Prefix & suffix' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      format === fmt.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {fmt.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {fmt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prefix / Suffix if Custom chosen */}
            {format === 'custom' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Text Prefix
                  </label>
                  <input
                    type="text"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value)}
                    placeholder="e.g. Doc Page "
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Text Suffix
                  </label>
                  <input
                    type="text"
                    value={customSuffix}
                    onChange={(e) => setCustomSuffix(e.target.value)}
                    placeholder="e.g.  (Draft)"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Starting Index & Range Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Numbering On
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={firstPageToNumber}
                    onChange={(e) => setFirstPageToNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Set to 2 to skip title/cover page
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  First Printed Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Value on the first numbered page
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Numbering At
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={lastPageToNumber ?? totalPages}
                    onChange={(e) => setLastPageToNumber(Math.min(totalPages, parseInt(e.target.value, 10) || totalPages))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Total document pages: {totalPages}
                </p>
              </div>
            </div>

            {/* Quick Helper Button: Skip Cover Page */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFirstPageToNumber(firstPageToNumber === 2 ? 1 : 2);
                  if (firstPageToNumber !== 2) {
                    setCurrentPage(2);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                  firstPageToNumber === 2
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{firstPageToNumber === 2 ? 'Cover Page Skipped (Enabled)' : 'Skip Cover Page (Start on Page 2)'}</span>
              </button>
            </div>
          </div>

          {/* 3. Font & Typography Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                3. Font & Visual Styling
              </span>
            </div>

            {/* Font Family */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Font Family
                </label>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value as PageNumberFont)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="Helvetica">Helvetica (Modern Sans-Serif)</option>
                  <option value="Helvetica-Bold">Helvetica Bold (Strong Sans)</option>
                  <option value="Times-Roman">Times New Roman (Classic Serif)</option>
                  <option value="Times-Bold">Times Bold (Classic Serif Bold)</option>
                  <option value="Courier">Courier (Monospace Code)</option>
                  <option value="Courier-Bold">Courier Bold (Monospace Bold)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono tabular-nums">{fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="22"
                  step="1"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 mt-1"
                />
              </div>
            </div>

            {/* Color Palette & Custom Hex */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Font Color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setColor(preset.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      color === preset.value
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-600 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: preset.value }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}

                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                    title="Custom color picker"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-20 px-2 py-1 text-xs rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Opacity & Margins */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Opacity</span>
                  <span className="font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>H-Margin</span>
                  <span className="font-mono tabular-nums">{marginHorizontal} pt</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="72"
                  step="2"
                  value={marginHorizontal}
                  onChange={(e) => setMarginHorizontal(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>V-Margin</span>
                  <span className="font-mono tabular-nums">{marginVertical} pt</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="72"
                  step="2"
                  value={marginVertical}
                  onChange={(e) => setMarginVertical(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview Canvas */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            {/* Header & Page Navigation Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Live Page Preview
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time visual alignment
                </span>
              </div>

              {/* Page Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loadingPreview}
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loadingPreview}
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="relative aspect-[3/4] w-full rounded-xl bg-slate-100 dark:bg-slate-950/60 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-inner">
              {loadingPreview && (
                <div className="absolute inset-0 z-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-h-full max-w-full object-contain shadow-md"
              />
            </div>

            {/* Preview Status Footer */}
            <div className="text-center text-xs text-slate-500 dark:text-slate-400">
              {currentPage < firstPageToNumber ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Cover Page: No number printed on this page
                </span>
              ) : (
                <span>
                  Printing{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {formatPageNumberText(
                      (currentPage - firstPageToNumber) + startNumber,
                      totalPages,
                      format,
                      customPrefix,
                      customSuffix
                    )}
                  </strong>{' '}
                  at {position.replace('-', ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Action Card: Apply & Download */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <button
              onClick={handleApplyNumbers}
              disabled={isProcessing}
              className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Numbering Pages ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Hash className="w-4 h-4" />
                  <span>Number Pages & Download</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* In-app Preview of Result */}
            {resultBytes && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Numbered PDF Generated Successfully!</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadBytes(resultBytes, resultFilename)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Again</span>
                  </button>
                  <button
                    onClick={() => onPreviewPdf(undefined, resultBytes, resultFilename)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open In Viewer</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
