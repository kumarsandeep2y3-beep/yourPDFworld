import React, { useState, useEffect } from 'react';
import {
  Info,
  FileText,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Calendar,
  User,
  Printer,
  Copy,
  Check,
  Download,
  Eye,
  Maximize2,
  Sparkles,
  RefreshCw,
  FileCode,
  Tag,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
  Compass,
  FileCheck,
  Search,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { PdfDocumentInfo } from '../types/pdf';
import {
  extractPdfInfo,
  exportPdfInfoToJson,
  formatPdfInfoReport,
} from '../utils/pdfInfoExtractor';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderer';

interface PdfInfoToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const PdfInfoTool: React.FC<PdfInfoToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState<boolean>(false);
  const [pageSearchQuery, setPageSearchQuery] = useState<string>('');

  // Active tab preference from localStorage
  const [activeTab, setActiveTab] = useState<'overview' | 'metadata' | 'geometry' | 'security' | 'raw'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paperplane_info_tab');
      if (saved && ['overview', 'metadata', 'geometry', 'security', 'raw'].includes(saved)) {
        return saved as any;
      }
    }
    return 'overview';
  });

  const handleTabChange = (tab: 'overview' | 'metadata' | 'geometry' | 'security' | 'raw') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paperplane_info_tab', tab);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleCopyFullReport = () => {
    if (!docInfo) return;
    const report = formatPdfInfoReport(docInfo);
    navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    if (!docInfo) return;
    exportPdfInfoToJson(docInfo);
  };

  // Process file when selected
  useEffect(() => {
    if (!file) {
      setDocInfo(null);
      setThumbnailUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const runExtraction = async () => {
      try {
        const info = await extractPdfInfo(file);
        let thumb: string | null = null;
        try {
          thumb = await renderPdfPageToDataUrl(file, 1, 0.45);
        } catch {
          // ignore thumbnail failure
        }

        if (isMounted) {
          setDocInfo(info);
          setThumbnailUrl(thumb);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to extract PDF properties:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to read PDF document properties. The file might be corrupted or password-protected.');
          setIsLoading(false);
        }
      }
    };

    runExtraction();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const filteredPages = docInfo?.pages.filter((p) => {
    if (!pageSearchQuery.trim()) return true;
    const q = pageSearchQuery.toLowerCase();
    return (
      p.pageNumber.toString().includes(q) ||
      p.standardPaper.toLowerCase().includes(q) ||
      p.orientation.toLowerCase().includes(q) ||
      `${p.widthMm}x${p.heightMm}`.includes(q) ||
      `${p.widthPt}x${p.heightPt}`.includes(q)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                PDF Document Properties & Info
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Inspect detailed PDF metadata, author, producer, creation timestamps, page dimensions in mm/pt/inches, and security permissions with 100% client-side privacy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {docInfo && (
              <>
                <button
                  onClick={handleCopyFullReport}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copy formatted summary to clipboard"
                >
                  {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{reportCopied ? 'Report Copied!' : 'Copy Summary'}</span>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Export properties as structured JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      {!file ? (
        <div className="space-y-4">
          <Dropzone
            onFilesSelected={(files) => {
              if (files.length > 0) setFile(files[0]);
            }}
            onLoadSamples={onLoadSamples}
            multiple={false}
            title="Drag & drop any PDF to inspect its properties"
            subtitle="View page sizes, author, producer, creation dates, encryption & security permissions instantly."
          />

          {/* Quick Explainer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                <Maximize2 className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Page Geometry & Formats</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Identifies standard ISO & US paper sizes (A4, Letter, Legal, A3) in points, millimeters, and inches with orientation and MediaBox coordinates.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                <Calendar className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Author & Timestamps</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Extracts document title, author, subject, keywords, creation software (Creator/Producer), and exact modification history.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Security & Permissions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Checks AES/RC4 encryption ciphers and verifies printing, text copying, document modifying, form filling, and accessibility rights.
              </p>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Extracting Document Properties...</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analyzing PDF header, cross-reference trailer, page boxes, metadata dictionaries, and security ciphers in memory.
          </p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-rose-900 dark:text-rose-200">Unable to Read PDF Properties</h2>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={() => setFile(null)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Try Another Document
          </button>
        </div>
      ) : docInfo ? (
        <div className="space-y-6">
          {/* File Card Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {thumbnailUrl ? (
                <div
                  onClick={() => onPreviewPdf(file, undefined, docInfo.fileName)}
                  className="w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 cursor-pointer group relative shadow-2xs"
                  title="Click to preview PDF"
                >
                  <img
                    src={thumbnailUrl}
                    alt="PDF Cover Thumbnail"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="w-12 h-14 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {docInfo.fileName}
                  </h2>
                  <button
                    onClick={() => handleCopyText(docInfo.fileName, 'filename')}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                    title="Copy filename"
                  >
                    {copiedKey === 'filename' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono tabular-nums">{docInfo.fileSizeFormatted}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{docInfo.pageCount} page{docInfo.pageCount > 1 ? 's' : ''}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{docInfo.pdfVersion}</span>
                  <span aria-hidden="true">·</span>
                  <span>{docInfo.primaryPaper}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <button
                onClick={() => onPreviewPdf(file, undefined, docInfo.fileName)}
                className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => setFile(null)}
                className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Inspect Another</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Pages</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block font-mono tabular-nums">
                {docInfo.pageCount}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">{docInfo.isUniformSize ? 'Uniform size' : 'Mixed sizes'}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">File Size</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block font-mono tabular-nums">
                {docInfo.fileSizeFormatted.split(' ')[0]} {docInfo.fileSizeFormatted.split(' ')[1]}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">{docInfo.fileSize.toLocaleString()} bytes</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">PDF Spec</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block font-mono">
                {docInfo.pdfVersion}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">ISO 32000 standard</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Primary Paper</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {docInfo.primaryPaper}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {docInfo.pages[0]?.widthMm} × {docInfo.pages[0]?.heightMm} mm
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Security Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {docInfo.isEncrypted ? (
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {docInfo.isEncrypted ? 'Encrypted' : 'Unprotected'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {docInfo.isEncrypted ? docInfo.encryptionAlgorithm.split(' ')[0] : 'Full rights'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Fast Web View</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                {docInfo.isLinearized ? 'Yes' : 'No'}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {docInfo.isLinearized ? 'Linearized streaming' : 'Standard structure'}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Overview & Summary</span>
            </button>

            <button
              onClick={() => handleTabChange('metadata')}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'metadata'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Metadata & Author</span>
            </button>

            <button
              onClick={() => handleTabChange('geometry')}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'geometry'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              <span>Page Geometry ({docInfo.pages.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('security')}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Security & Permissions</span>
            </button>

            <button
              onClick={() => handleTabChange('raw')}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Raw Metadata</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Structured Document Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Document Summary</span>
                  </h3>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                    {docInfo.title ? (
                      <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{docInfo.title}</p>
                    ) : null}
                    <p>{docInfo.pageSummary}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Created with {docInfo.creator || docInfo.producer || 'Standard PDF Engine'} · {docInfo.creationDateFormatted}
                    </p>
                  </div>

                  {/* Properties Table */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Document Title</span>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white text-right">
                        <span>{docInfo.title || 'Not specified'}</span>
                        {docInfo.title && (
                          <button
                            onClick={() => handleCopyText(docInfo.title!, 'title')}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Copy title"
                          >
                            {copiedKey === 'title' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Author / Originator</span>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white text-right">
                        <span>{docInfo.author || 'Not specified'}</span>
                        {docInfo.author && (
                          <button
                            onClick={() => handleCopyText(docInfo.author!, 'author')}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Copy author"
                          >
                            {copiedKey === 'author' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Created On</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right font-mono tabular-nums">
                        {docInfo.creationDateFormatted}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Last Modified</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right font-mono tabular-nums">
                        {docInfo.modificationDateFormatted}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Application (Creator)</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right truncate max-w-xs">
                        {docInfo.creator || 'Not specified'}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">PDF Producer</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right truncate max-w-xs">
                        {docInfo.producer || 'Not specified'}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Page Dimensions</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right font-mono tabular-nums">
                        {docInfo.pages[0]?.widthMm} × {docInfo.pages[0]?.heightMm} mm ({docInfo.pages[0]?.widthIn} × {docInfo.pages[0]?.heightIn} in)
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Interactive Elements</span>
                      <span className="text-slate-900 dark:text-white font-medium text-right">
                        {docInfo.hasForms ? `${docInfo.formFieldsCount} form fields` : 'No interactive forms'} · {docInfo.outlineCount > 0 ? `${docInfo.outlineCount} bookmarks` : 'No bookmarks'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Cover Preview & Security Highlights */}
              <div className="space-y-6">
                {/* Visual Cover Preview */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Page 1 Preview</h3>
                    <button
                      onClick={() => onPreviewPdf(file, undefined, docInfo.fileName)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Full View</span>
                    </button>
                  </div>

                  {thumbnailUrl ? (
                    <div
                      onClick={() => onPreviewPdf(file, undefined, docInfo.fileName)}
                      className="w-full aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden relative group cursor-pointer shadow-inner"
                    >
                      <img
                        src={thumbnailUrl}
                        alt="Document Cover"
                        className="w-full h-full object-contain p-2 group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                        <Maximize2 className="w-6 h-6" />
                        <span className="text-xs font-semibold">Open Reader Modal</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <FileText className="w-8 h-8 mb-2" />
                      <span>Preview not available</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-mono">
                    Page 1 of {docInfo.pageCount} · {docInfo.pages[0]?.standardPaper}
                  </div>
                </div>

                {/* Security Badge */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Security Summary</span>
                  </h3>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Encryption:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{docInfo.encryptionAlgorithm}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Printing:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{docInfo.permissions.printing}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Text Copying:</span>
                      <span className={`font-semibold ${docInfo.permissions.copying ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {docInfo.permissions.copying ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTabChange('security')}
                    className="w-full py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-center block cursor-pointer"
                  >
                    View All 7 Security Permissions →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: METADATA & AUTHOR */}
          {activeTab === 'metadata' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Document Information Dictionary</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Standard metadata tags defined inside the PDF /Info trailer dictionary according to ISO 32000.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Field 1: Title */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Title (/Title)</span>
                    {docInfo.title && (
                      <button
                        onClick={() => handleCopyText(docInfo.title!, 'title')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                        title="Copy"
                      >
                        {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                    {docInfo.title || <span className="text-slate-400 italic font-normal">None specified</span>}
                  </p>
                </div>

                {/* Field 2: Author */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Author (/Author)</span>
                    {docInfo.author && (
                      <button
                        onClick={() => handleCopyText(docInfo.author!, 'author')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                        title="Copy"
                      >
                        {copiedKey === 'author' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                    {docInfo.author || <span className="text-slate-400 italic font-normal">None specified</span>}
                  </p>
                </div>

                {/* Field 3: Subject */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Subject (/Subject)</span>
                    {docInfo.subject && (
                      <button
                        onClick={() => handleCopyText(docInfo.subject!, 'subject')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                        title="Copy"
                      >
                        {copiedKey === 'subject' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                    {docInfo.subject || <span className="text-slate-400 italic font-normal">None specified</span>}
                  </p>
                </div>

                {/* Field 4: Keywords */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Keywords (/Keywords)</span>
                    {docInfo.keywords.length > 0 && (
                      <button
                        onClick={() => handleCopyText(docInfo.keywords.join(', '), 'keywords')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                        title="Copy"
                      >
                        {copiedKey === 'keywords' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {docInfo.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {docInfo.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic font-normal">None specified</p>
                  )}
                </div>

                {/* Field 5: Creator */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Original Application (/Creator)</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                    {docInfo.creator || <span className="text-slate-400 italic font-normal">None specified</span>}
                  </p>
                  <span className="text-[10px] text-slate-400 block">The authoring program that generated original document</span>
                </div>

                {/* Field 6: Producer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">PDF Generator Engine (/Producer)</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                    {docInfo.producer || <span className="text-slate-400 italic font-normal">None specified</span>}
                  </p>
                  <span className="text-[10px] text-slate-400 block">The software library that converted file into PDF format</span>
                </div>

                {/* Field 7: Creation Date */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Creation Timestamp (/CreationDate)</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                    {docInfo.creationDateFormatted}
                  </p>
                  {docInfo.creationDate && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      ISO: {docInfo.creationDate.toISOString()}
                    </span>
                  )}
                </div>

                {/* Field 8: Modification Date */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Modification Timestamp (/ModDate)</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                    {docInfo.modificationDateFormatted}
                  </p>
                  {docInfo.modificationDate && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      ISO: {docInfo.modificationDate.toISOString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAGE GEOMETRY */}
          {activeTab === 'geometry' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Page Dimensions & Geometry</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {docInfo.pageSummary}
                  </p>
                </div>

                {docInfo.pages.length > 5 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter pages or size..."
                      value={pageSearchQuery}
                      onChange={(e) => setPageSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Geometry Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Page #</th>
                      <th className="py-3 px-4">Standard Paper</th>
                      <th className="py-3 px-4 text-right">Millimeters (mm)</th>
                      <th className="py-3 px-4 text-right">Inches (in)</th>
                      <th className="py-3 px-4 text-right">Points (pt)</th>
                      <th className="py-3 px-4">Orientation</th>
                      <th className="py-3 px-4 text-center">Rotation</th>
                      <th className="py-3 px-4">MediaBox Box</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                    {filteredPages.map((page) => (
                      <tr
                        key={page.pageNumber}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          Page {page.pageNumber}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                          {page.standardPaper}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          {page.widthMm} × {page.heightMm} mm
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          {page.widthIn} × {page.heightIn} in
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                          {page.widthPt} × {page.heightPt} pt
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              page.orientation === 'Portrait'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : page.orientation === 'Landscape'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {page.orientation}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                          {page.rotation}°
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                          [{page.mediaBox.x}, {page.mediaBox.y}, {page.mediaBox.width}, {page.mediaBox.height}]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredPages.length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400">No pages matched your search filter.</p>
              )}
            </div>
          )}

          {/* TAB 4: SECURITY & PERMISSIONS */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Security & Permission Matrix</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permissions enforced by PDF readers based on the document encryption dictionary and user access flags.
                </p>
              </div>

              {/* Encryption Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  docInfo.isEncrypted
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                {docInfo.isEncrypted ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm">
                    {docInfo.isEncrypted ? 'Password-Protected / Encrypted PDF' : 'Unencrypted PDF Document'}
                  </p>
                  <p className="leading-relaxed opacity-90">
                    {docInfo.isEncrypted
                      ? `This document is secured using ${docInfo.encryptionAlgorithm}. Some viewing or editing actions may be restricted depending on reader enforcement.`
                      : 'This document has no encryption password or permission locks applied. All printing, copying, and modification operations are fully permitted.'}
                  </p>
                </div>
              </div>

              {/* Detailed Permissions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Printing */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.printing !== 'Disallowed'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Document Printing</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.printing !== 'Disallowed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.printing}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Controls whether the user can print the document to physical or virtual printers.
                    </p>
                  </div>
                </div>

                {/* 2. Content Copying */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.copying
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Copy className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Content Copying & Extraction</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.copying
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.copying ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Authorizes users to select, copy text, extract images, or export elements to the clipboard.
                    </p>
                  </div>
                </div>

                {/* 3. Document Modification */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.modifying
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Content Editing & Changes</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.modifying
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.modifying ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Allows editing document text, inserting objects, altering paragraphs, or re-structuring pages.
                    </p>
                  </div>
                </div>

                {/* 4. Annotations & Signatures */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.annotating
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Commenting & Annotations</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.annotating
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.annotating ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Allows adding sticky notes, freehand drawings, stamps, highlights, and digital signatures.
                    </p>
                  </div>
                </div>

                {/* 5. Form Filling */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.formFilling
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Interactive Form Filling</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.formFilling
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.formFilling ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Authorizes entering text into AcroForm fields, checking boxes, and saving form responses.
                    </p>
                  </div>
                </div>

                {/* 6. Accessibility & Screen Readers */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.accessibility
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Accessibility & Screen Readers</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.accessibility
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.accessibility ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Allows assistive software (screen readers for visually impaired users) to extract page text.
                    </p>
                  </div>
                </div>

                {/* 7. Page Assembly */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      docInfo.permissions.assembly
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Page Assembly & Reordering</span>
                      <span
                        className={`font-semibold ${
                          docInfo.permissions.assembly
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        · {docInfo.permissions.assembly ? 'Allowed' : 'Prohibited'}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Authorizes inserting, rotating, deleting, extracting pages, and creating bookmarks/thumbnails.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RAW METADATA & XMP */}
          {activeTab === 'raw' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Raw PDF Metadata Object</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Raw JSON dictionary parsed directly from PDF trailer and XMP metadata stream.
                  </p>
                </div>
                <button
                  onClick={() => handleCopyText(JSON.stringify(docInfo, null, 2), 'raw_json')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'raw_json' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'raw_json' ? 'Copied JSON!' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96 scrollbar-thin">
                <pre>{JSON.stringify(docInfo, null, 2)}</pre>
              </div>

              {docInfo.xmpRaw && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Adobe XMP XML Stream
                    </h4>
                    <button
                      onClick={() => handleCopyText(docInfo.xmpRaw!, 'xmp_raw')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'xmp_raw' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy XML</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 text-slate-300 rounded-xl p-4 font-mono text-[11px] overflow-x-auto max-h-60 scrollbar-thin">
                    <pre>{docInfo.xmpRaw}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
