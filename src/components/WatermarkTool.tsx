import React, { useState, useEffect, useRef } from 'react';
import {
  Stamp,
  Download,
  Eye,
  CheckCircle2,
  Sliders,
  Type,
  ImageIcon,
  Hash,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { applyWatermarkAndNumbers, downloadBytes, formatBytes } from '../utils/pdfEngine';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderer';
import { WatermarkOptions, PageNumberOptions } from '../types/pdf';

interface WatermarkToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string | null>(null);

  // Watermark state
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(48);
  const [watermarkRotation, setWatermarkRotation] = useState(-45);
  const [watermarkColor, setWatermarkColor] = useState('#dc2626');
  const [watermarkPosition, setWatermarkPosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('center');

  // Image watermark state
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  const [watermarkImageDataUrl, setWatermarkImageDataUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(0.5);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Page numbering state
  const [numbersEnabled, setNumbersEnabled] = useState(true);
  const [numberPosition, setNumberPosition] = useState<
    'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-center'
  >('bottom-center');
  const [numberFormat, setNumberFormat] = useState<'page-x-of-y' | 'page-x' | 'numbers-only'>('page-x-of-y');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!file) {
      setPagePreviewUrl(null);
      setResultBytes(null);
      return;
    }

    let isMounted = true;
    const loadPreview = async () => {
      try {
        const thumb = await renderPdfPageToDataUrl(file, 1, 0.7);
        if (isMounted) setPagePreviewUrl(thumb);
      } catch (err) {
        console.error('Failed to render page preview:', err);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgFile = e.target.files[0];
      setWatermarkImageFile(imgFile);
      const reader = new FileReader();
      reader.onload = () => {
        setWatermarkImageDataUrl(reader.result as string);
      };
      reader.readAsDataURL(imgFile);
    }
  };

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(15);

    try {
      const wmConfig: WatermarkOptions | undefined = watermarkEnabled
        ? {
            type: watermarkType,
            text: watermarkText,
            imageFile: watermarkImageFile || undefined,
            imageDataUrl: watermarkImageDataUrl || undefined,
            imageScale,
            opacity: watermarkOpacity,
            fontSize: watermarkFontSize,
            rotation: watermarkRotation,
            color: watermarkColor,
            position: watermarkPosition,
          }
        : undefined;

      const numConfig: PageNumberOptions | undefined = numbersEnabled
        ? {
            enabled: true,
            position: numberPosition,
            format: numberFormat,
            startFrom: 1,
            fontSize: 10,
          }
        : undefined;

      const bytes = await applyWatermarkAndNumbers(file, wmConfig, numConfig, (p) => setProgress(p));
      const cleanName = `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`;

      setResultBytes(bytes);
      downloadBytes(bytes, cleanName);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || 'Failed to apply watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Watermark PDF with Text or Image Logo
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Brand your documents with company logos or stamp &quot;CONFIDENTIAL&quot; across every page with full rotation, opacity, and position controls.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => setFile(files[0])}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to watermark"
          subtitle="Upload an image logo or enter text watermark with custom opacity, angles, and page numbering."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Info Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Stamp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {formatBytes(file.size)}
            </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Watermark Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Add Watermark
                </span>
              </label>

              {watermarkEnabled && (
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setWatermarkType('text')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      watermarkType === 'text'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Text Stamp
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatermarkType('image')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      watermarkType === 'image'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Image / Logo
                  </button>
                </div>
              )}
            </div>

            {watermarkEnabled && (
              <div className="space-y-4 pt-1">
                {/* Text Watermark Controls */}
                {watermarkType === 'text' ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Watermark Text
                        </label>
                        <div className="flex items-center gap-1">
                          {['CONFIDENTIAL', 'DRAFT', 'SAMPLE', 'COPY'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setWatermarkText(preset)}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 transition-colors"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={watermarkColor}
                            onChange={(e) => setWatermarkColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 p-0.5"
                          />
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {watermarkColor}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          min={12}
                          max={120}
                          value={watermarkFontSize}
                          onChange={(e) => setWatermarkFontSize(parseInt(e.target.value, 10) || 40)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* Image / Logo Watermark Controls */
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Upload Logo or Stamp Image (PNG, JPG)
                    </label>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{watermarkImageFile ? 'Replace Image' : 'Choose Logo Image'}</span>
                      </button>

                      {watermarkImageFile && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 truncate">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {watermarkImageFile.name}
                          </span>
                          <span className="font-mono">({formatBytes(watermarkImageFile.size)})</span>
                        </div>
                      )}
                    </div>

                    {watermarkImageDataUrl && (
                      <div className="pt-2">
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                          <span>Image Scale / Size</span>
                          <span className="font-mono tabular-nums">{Math.round(imageScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.5"
                          step="0.05"
                          value={imageScale}
                          onChange={(e) => setImageScale(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Shared Geometry: Position, Opacity, Rotation */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Placement
                    </label>
                    <select
                      value={watermarkPosition}
                      onChange={(e) => setWatermarkPosition(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <option value="center">Center</option>
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Opacity</span>
                      <span className="font-mono tabular-nums">{Math.round(watermarkOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.9"
                      step="0.05"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Rotation</span>
                      <span className="font-mono tabular-nums">{watermarkRotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="5"
                      value={watermarkRotation}
                      onChange={(e) => setWatermarkRotation(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Page Numbering Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={numbersEnabled}
                  onChange={(e) => setNumbersEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Add Page Numbers
                </span>
              </label>
            </div>

            {numbersEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number Format
                  </label>
                  <select
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="page-x-of-y">Page X of Y (e.g. Page 1 of 4)</option>
                    <option value="page-x">Page X (e.g. Page 1)</option>
                    <option value="numbers-only">Numbers Only (e.g. 1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Placement
                  </label>
                  <select
                    value={numberPosition}
                    onChange={(e) => setNumberPosition(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-center">Top Center</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            onClick={handleApply}
            disabled={isProcessing || (!watermarkEnabled && !numbersEnabled)}
            className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Applying Watermark ({progress}%)...</span>
              </>
            ) : (
              <>
                <Stamp className="w-4 h-4" />
                <span>Apply Watermark to All Pages</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Live Visual Simulation Column */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Live Page 1 Simulation
            </span>
            <span className="text-[11px] text-slate-400">Updates live</span>
          </div>

          <div className="relative aspect-[3/4] w-full rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
            {pagePreviewUrl ? (
              <img
                src={pagePreviewUrl}
                alt="Document base"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-slate-400">Loading page...</div>
            )}

            {/* Overlaid Simulated Watermark */}
            {watermarkEnabled && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none"
                style={{
                  alignItems:
                    watermarkPosition.startsWith('top')
                      ? 'flex-start'
                      : watermarkPosition.startsWith('bottom')
                      ? 'flex-end'
                      : 'center',
                  justifyContent:
                    watermarkPosition.endsWith('left')
                      ? 'flex-start'
                      : watermarkPosition.endsWith('right')
                      ? 'flex-end'
                      : 'center',
                  padding: '24px',
                }}
              >
                {watermarkType === 'text' && watermarkText ? (
                  <span
                    style={{
                      color: watermarkColor,
                      opacity: watermarkOpacity,
                      fontSize: `${watermarkFontSize * 0.42}px`,
                      transform: `rotate(${watermarkRotation}deg)`,
                    }}
                    className="font-bold tracking-wider font-mono whitespace-nowrap"
                  >
                    {watermarkText}
                  </span>
                ) : watermarkType === 'image' && watermarkImageDataUrl ? (
                  <img
                    src={watermarkImageDataUrl}
                    alt="Watermark Preview"
                    style={{
                      opacity: watermarkOpacity,
                      transform: `rotate(${watermarkRotation}deg)`,
                      maxWidth: `${Math.round(imageScale * 60)}%`,
                      maxHeight: `${Math.round(imageScale * 60)}%`,
                    }}
                    className="object-contain"
                  />
                ) : null}
              </div>
            )}

            {/* Overlaid Simulated Page Number */}
            {numbersEnabled && (
              <div
                className="absolute inset-0 p-3 flex pointer-events-none select-none text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400"
                style={{
                  alignItems: numberPosition.startsWith('top') ? 'flex-start' : 'flex-end',
                  justifyContent: numberPosition.endsWith('left')
                    ? 'flex-start'
                    : numberPosition.endsWith('right')
                    ? 'flex-end'
                    : 'center',
                }}
              >
                <span>
                  {numberFormat === 'page-x-of-y'
                    ? 'Page 1 of 4'
                    : numberFormat === 'page-x'
                    ? 'Page 1'
                    : '1'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {resultBytes && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Watermarks applied and document downloaded successfully!</span>
          </div>

          <button
            onClick={() =>
              onPreviewPdf(
                undefined,
                resultBytes,
                `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`
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
