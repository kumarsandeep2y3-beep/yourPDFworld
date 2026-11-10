import React, { useRef, useState } from 'react';
import { UploadCloud, Sparkles, Plus, AlertCircle, FileText, Loader2 } from 'lucide-react';
import {
  secureValidateFile,
  getValidatedPdfFile,
  getMaxFileSizeLimit,
} from '../utils/justPdfSecurityProcessor';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onLoadSamples: () => void;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  onLoadSamples,
  multiple = true,
  title = 'Drag & drop your PDF documents here',
  subtitle = 'Or browse from your computer. 100% private, client-side, and memory-safe.',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxLimitMB = Math.round(getMaxFileSizeLimit() / (1024 * 1024));

  const processAndValidateFiles = async (fileList: File[]) => {
    setValidationError(null);
    setIsConverting(true);

    try {
      const validFiles: File[] = [];

      for (const file of fileList) {
        if (file.size < 5 * 1024) {
          alert("File is too small or empty. Please upload a valid PDF.");
          throw new Error("File is too small or empty. Please upload a valid PDF.");
        }
        secureValidateFile(file);
        // Automatically convert images (PNG/JPG/WebP) to standard A4 PDF container or validate PDF
        const readyPdf = await getValidatedPdfFile(file);
        if (readyPdf.size < 5 * 1024) {
          alert("File is too small or empty. Please upload a valid PDF.");
          throw new Error("File is too small or empty. Please upload a valid PDF.");
        }
        validFiles.push(readyPdf);
      }

      if (validFiles.length > 0) {
        onFilesSelected(multiple ? validFiles : [validFiles[0]]);
      }
    } catch (err: any) {
      const msg = err?.message || 'File is too small or empty. Please upload a valid PDF.';
      setValidationError(msg);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.files);
    if (items.length > 0) {
      await processAndValidateFiles(items);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const items = Array.from(e.target.files);
      await processAndValidateFiles(items);
      e.target.value = '';
    }
  };

  return (
    <div
      id="dropZone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`upload-drop-zone relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
        isDragOver
          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 scale-[1.005]'
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-blue-400 dark:hover:border-blue-600'
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        id="fileInput"
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto pointer-events-none">
        <div className="upload-icon w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-xs">
          {isConverting ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8" />
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          {isConverting ? 'Optimizing & Converting Document...' : title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 mb-6">
          {isConverting
            ? 'Scaling image to A4 container & recovering metadata in memory...'
            : subtitle}
        </p>

        {validationError && (
          <div className="mb-4 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 max-w-sm pointer-events-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
          <button
            type="button"
            disabled={isConverting}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="browse-btn-primary px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Browse {multiple ? 'Files' : 'File'}</span>
          </button>

          <button
            type="button"
            disabled={isConverting}
            onClick={(e) => {
              e.stopPropagation();
              onLoadSamples();
            }}
            className="px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Try Sample Docs</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-6">
          <span>PDF, PNG, JPG, WebP</span>
          <span>·</span>
          <span>Smart Device Limit: Up to {maxLimitMB}MB</span>
          <span>·</span>
          <span>100% in-browser memory</span>
        </div>
      </div>
    </div>
  );
};
