import React, { useState, useEffect } from 'react';
import {
  FileImage,
  FileText,
  Download,
  Copy,
  Check,
  Eye,
  Sliders,
  Archive,
  ArrowRight,
  Layers,
  Sparkles,
  FileType,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import {
  convertPdfToImages,
  convertPdfToText,
  downloadText,
  downloadImagesZip,
  ConvertedImageResult,
  ConvertedTextResult,
} from '../utils/pdfConverter';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { formatBytes } from '../utils/pdfEngine';

interface ConverterToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

type ConvertTarget = 'png' | 'jpg' | 'txt' | 'md';

export const ConverterTool: React.FC<ConverterToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Conversion settings
  const [targetFormat, setTargetFormat] = useState<ConvertTarget>('png');
  const [dpi, setDpi] = useState<number>(150);
  const [jpgQuality, setJpgQuality] = useState<number>(85);
  const [pageRange, setPageRange] = useState<string>('');

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Results
  const [imageResults, setImageResults] = useState<ConvertedImageResult[] | null>(null);
  const [textResult, setTextResult] = useState<ConvertedTextResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file) {
      setThumbnailUrl(null);
      setImageResults(null);
      setTextResult(null);
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        const thumb = await renderPdfPageToDataUrl(file, 1, 0.4);
        if (isMounted) {
          setTotalPages(count);
          setThumbnailUrl(thumb);
        }
      } catch (err) {
        console.error('Failed to load PDF for converter:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);
    setImageResults(null);
    setTextResult(null);

    try {
      if (targetFormat === 'png' || targetFormat === 'jpg') {
        const results = await convertPdfToImages(
          file,
          targetFormat,
          {
            dpi,
            quality: jpgQuality / 100,
            pageRange,
          },
          (p) => setProgress(p)
        );

        setImageResults(results);

        // Auto download: If single image, download directly; if multiple, download zip
        if (results.length === 1) {
          downloadSingleImage(results[0]);
        } else if (results.length > 1) {
          await downloadImagesZip(
            results,
            `${file.name.replace(/\.pdf$/i, '')}_${targetFormat.toUpperCase()}_images.zip`
          );
        }
      } else {
        const res = await convertPdfToText(
          file,
          { pageRange },
          (p) => setProgress(p)
        );

        setTextResult(res);

        const filename = `${file.name.replace(/\.pdf$/i, '')}.${targetFormat}`;
        const content = targetFormat === 'md' ? res.markdownText : res.fullText;
        downloadText(content, filename);
      }
    } catch (err: unknown) {
      console.error('Conversion failed:', err);
      alert((err as Error).message || 'Conversion failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSingleImage = (img: ConvertedImageResult) => {
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = img.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = () => {
    if (!textResult) return;
    const content = targetFormat === 'md' ? textResult.markdownText : textResult.fullText;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Convert PDF to Images & Text
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Transform PDF documents into high-resolution PNG or JPG images, or extract clean text and markdown.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => {
            setFile(files[0]);
            setImageResults(null);
            setTextResult(null);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to convert"
          subtitle="Convert all or specific pages to PNG, JPG, or editable TXT/Markdown."
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
            <FileType className="w-5 h-5" />
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
                <span>Preview Document</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setFile(null);
            setImageResults(null);
            setTextResult(null);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Change File
        </button>
      </div>

      {/* Target Format Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Choose Target Format
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select image rasterization or text extraction.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* PNG */}
          <div
            onClick={() => setTargetFormat('png')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              targetFormat === 'png'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>PNG Images</span>
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                Lossless
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High resolution with crisp text and graphic clarity. Ideal for presentations.
            </p>
          </div>

          {/* JPG */}
          <div
            onClick={() => setTargetFormat('jpg')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              targetFormat === 'jpg'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileImage className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>JPG Images</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Compact
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optimized file size with adjustable compression quality for web sharing.
            </p>
          </div>

          {/* TXT */}
          <div
            onClick={() => setTargetFormat('txt')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              targetFormat === 'txt'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Plain Text</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                .TXT
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extract raw text content stripped of graphics and layout constraints.
            </p>
          </div>

          {/* Markdown */}
          <div
            onClick={() => setTargetFormat('md')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              targetFormat === 'md'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileType className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Markdown</span>
              </span>
              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 rounded">
                .MD
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Structured text with page markers, headers, and section breaks.
            </p>
          </div>
        </div>

        {/* Options Row */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Resolution DPI (for image formats) */}
          {(targetFormat === 'png' || targetFormat === 'jpg') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Resolution / DPI
              </label>
              <select
                value={dpi}
                onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value={100}>Web Standard (100 DPI)</option>
                <option value={150}>Medium Quality (150 DPI)</option>
                <option value={200}>High Sharpness (200 DPI)</option>
                <option value={300}>Ultra Print (300 DPI)</option>
              </select>
            </div>
          )}

          {/* JPG Quality (for JPG format) */}
          {targetFormat === 'jpg' && (
            <div>
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                <span>JPEG Quality</span>
                <span className="font-mono tabular-nums">{jpgQuality}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={jpgQuality}
                onChange={(e) => setJpgQuality(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 mt-1"
              />
            </div>
          )}

          {/* Page Range selector */}
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Page Range (Optional)
            </label>
            <input
              type="text"
              placeholder={`All pages (1-${totalPages})`}
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Ready to Convert Document
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Converting to <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">{targetFormat}</span> {targetFormat === 'png' || targetFormat === 'jpg' ? `@ ${dpi} DPI` : ''}.
          </p>
        </div>

        <button
          onClick={handleConvert}
          disabled={isProcessing}
          className="w-full sm:w-auto px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Converting ({progress}%)...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Convert & Download</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Image Conversion Results Grid */}
      {imageResults && imageResults.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Generated {imageResults.length} {imageResults.length === 1 ? 'Image' : 'Images'}!</span>
            </div>

            {imageResults.length > 1 && (
              <button
                onClick={() =>
                  downloadImagesZip(
                    imageResults,
                    `${file.name.replace(/\.pdf$/i, '')}_${targetFormat.toUpperCase()}_bundle.zip`
                  )
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Archive className="w-4 h-4" />
                <span>Download All as ZIP</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {imageResults.map((img) => (
              <div
                key={img.pageNumber}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-2.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Page {img.pageNumber}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {img.width}x{img.height}
                  </span>
                </div>

                <div className="aspect-[3/4] w-full rounded-md bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-2xs my-1">
                  <img
                    src={img.dataUrl}
                    alt={img.filename}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[80px]">
                    {formatBytes(img.bytes.byteLength)}
                  </span>
                  <button
                    onClick={() => downloadSingleImage(img)}
                    className="p-1 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800"
                    title="Download this image"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text Extraction Results */}
      {textResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Text Successfully Extracted!</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy All'}</span>
              </button>

              <button
                onClick={() => {
                  const filename = `${file.name.replace(/\.pdf$/i, '')}.${targetFormat}`;
                  const content = targetFormat === 'md' ? textResult.markdownText : textResult.fullText;
                  downloadText(content, filename);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .{targetFormat}</span>
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={12}
            value={targetFormat === 'md' ? textResult.markdownText : textResult.fullText}
            className="w-full p-4 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
};
