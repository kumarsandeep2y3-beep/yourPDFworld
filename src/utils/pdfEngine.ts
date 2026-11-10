import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { CompressionOptions, PageNumberOptions, PageNumberConfig, WatermarkOptions, AnnotationItem, SecurityOptions } from '../types/pdf';
import { encryptPDF, EncryptPDFOptions } from '@pdfsmaller/pdf-encrypt';
import { loadPdfSafely } from './justPdfSecurityProcessor';

export {
  getMaxFileSizeLimit,
  getValidatedPdfBytes,
  getValidatedPdfFile,
  getJustPDFFileName,
  secureValidateFile,
  loadPdfSafely,
  preprocessImageForOCR,
  runOptimizedOCR,
  applyJustPDFProcessors,
} from './justPdfSecurityProcessor';

/**
 * Helper: parse user page range string (e.g., "1-3, 5, 7-9") into 0-based page indices
 */
export function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const indices = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let i = start; i <= end; i++) {
        indices.add(i - 1);
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        indices.add(pageNum - 1);
      }
    }
  }

  const result = Array.from(indices).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i);
}

/**
 * Merge multiple PDF files into a single PDF
 */
export async function mergePdfs(
  files: { file: File; pageRange?: string }[],
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (files.length === 0) {
    throw new Error('Please select at least one PDF file to merge.');
  }

  const MIN_FILE_SIZE = 5 * 1024; // 5 KB
  for (const item of files) {
    if (item.file.size < MIN_FILE_SIZE) {
      throw new Error(`"${item.file.name}" is too small or empty (< 5 KB). Please upload a valid PDF.`);
    }
  }

  const mergedDoc = await PDFDocument.create();
  let totalProcessedPages = 0;

  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    const arrayBuffer = await item.file.arrayBuffer();
    const sourceDoc = await loadPdfSafely(arrayBuffer);
    const totalSourcePages = sourceDoc.getPageCount();

    if (totalSourcePages === 0) {
      throw new Error(`"${item.file.name}" contains no pages.`);
    }

    const selectedIndices = parsePageRanges(item.pageRange || '', totalSourcePages);
    if (selectedIndices.length === 0) {
      throw new Error(`No pages selected from "${item.file.name}". Please check the page range.`);
    }

    const copiedPages = await mergedDoc.copyPages(sourceDoc, selectedIndices);

    for (const page of copiedPages) {
      mergedDoc.addPage(page);
      totalProcessedPages++;
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / files.length) * 90));
    }
  }

  if (totalProcessedPages === 0) {
    throw new Error('No pages were merged. Please ensure your files have valid pages.');
  }

  // Ensure the saving of the array buffer is properly awaited
  const bytes = await mergedDoc.save({ useObjectStreams: true });
  if (!bytes || bytes.byteLength < 50) {
    throw new Error('Failed to generate merged PDF output. The resulting file was empty.');
  }

  if (onProgress) onProgress(100);

  return { bytes, pageCount: totalProcessedPages };
}

/**
 * Split a PDF according to mode
 */
export async function splitPdf(
  file: File,
  mode: 'all' | 'selected' | 'ranges' | 'chunk',
  config: {
    selectedPages?: number[]; // 0-based
    ranges?: string[]; // array of range strings e.g. ["1-2", "3-5"]
    chunkSize?: number; // e.g. 2
  } = {},
  onProgress?: (percent: number) => void
): Promise<{ filename: string; bytes: Uint8Array; pageCount: number }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await loadPdfSafely(arrayBuffer);
  const totalPages = sourceDoc.getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, '');
  const results: { filename: string; bytes: Uint8Array; pageCount: number }[] = [];

  if (mode === 'all') {
    // Split every single page into individual PDF
    for (let i = 0; i < totalPages; i++) {
      const doc = await PDFDocument.create();
      const [copied] = await doc.copyPages(sourceDoc, [i]);
      doc.addPage(copied);
      const bytes = await doc.save({ useObjectStreams: true });
      results.push({
        filename: `${baseName}_page_${i + 1}.pdf`,
        bytes,
        pageCount: 1,
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalPages) * 100));
      }
    }
  } else if (mode === 'selected') {
    // Extract only selected pages into one single extracted PDF
    const selected = config.selectedPages && config.selectedPages.length > 0
      ? config.selectedPages
      : [0];
    const doc = await PDFDocument.create();
    const copiedPages = await doc.copyPages(sourceDoc, selected);
    for (const page of copiedPages) {
      doc.addPage(page);
    }
    const bytes = await doc.save({ useObjectStreams: true });
    results.push({
      filename: `${baseName}_extracted.pdf`,
      bytes,
      pageCount: copiedPages.length,
    });
    if (onProgress) onProgress(100);
  } else if (mode === 'chunk') {
    // Split every N pages
    const chunkSize = Math.max(1, config.chunkSize || 2);
    let chunkIndex = 1;
    for (let i = 0; i < totalPages; i += chunkSize) {
      const doc = await PDFDocument.create();
      const pageSlice: number[] = [];
      for (let j = i; j < Math.min(i + chunkSize, totalPages); j++) {
        pageSlice.push(j);
      }
      const copiedPages = await doc.copyPages(sourceDoc, pageSlice);
      for (const page of copiedPages) {
        doc.addPage(page);
      }
      const bytes = await doc.save({ useObjectStreams: true });
      results.push({
        filename: `${baseName}_part_${chunkIndex}.pdf`,
        bytes,
        pageCount: copiedPages.length,
      });
      chunkIndex++;
      if (onProgress) {
        onProgress(Math.round((Math.min(i + chunkSize, totalPages) / totalPages) * 100));
      }
    }
  } else if (mode === 'ranges') {
    // Custom ranges array
    const ranges = config.ranges && config.ranges.length > 0 ? config.ranges : ['1'];
    let rangeIdx = 1;
    for (const rangeStr of ranges) {
      const indices = parsePageRanges(rangeStr, totalPages);
      if (indices.length > 0) {
        const doc = await PDFDocument.create();
        const copiedPages = await doc.copyPages(sourceDoc, indices);
        for (const page of copiedPages) {
          doc.addPage(page);
        }
        const bytes = await doc.save({ useObjectStreams: true });
        results.push({
          filename: `${baseName}_range_${rangeIdx}_(p${rangeStr.replace(/[^0-9-]/g, '')}).pdf`,
          bytes,
          pageCount: copiedPages.length,
        });
        rangeIdx++;
      }
    }
    if (onProgress) onProgress(100);
  }

  return results;
}

/**
 * Estimate output size heuristics when reliable
 */
export function estimateCompressedSize(
  fileSize: number,
  pageCount: number,
  options: CompressionOptions
): { min: number; max: number; isReliable: boolean; label: string } {
  if (fileSize <= 0) {
    return { min: 0, max: 0, isReliable: false, label: 'Select a document to calculate estimate' };
  }

  // Very small documents (< 60 KB) have heavy fixed PDF syntax overhead
  if (fileSize < 60 * 1024) {
    return {
      min: Math.round(fileSize * 0.85),
      max: fileSize,
      isReliable: false,
      label: 'Document is already very compact (< 60 KB). Minimal reduction expected.',
    };
  }

  if (options.level === 'low') {
    const min = Math.round(fileSize * 0.80);
    const max = Math.round(fileSize * 0.95);
    return {
      min,
      max,
      isReliable: true,
      label: `~${formatBytes(min)} – ${formatBytes(max)} (Lossless clean)`,
    };
  }

  if (options.level === 'recommended') {
    const min = Math.round(fileSize * (options.grayscale ? 0.32 : 0.40));
    const max = Math.round(fileSize * (options.grayscale ? 0.48 : 0.58));
    return {
      min,
      max,
      isReliable: true,
      label: `~${formatBytes(min)} – ${formatBytes(max)} (Balanced quality)`,
    };
  }

  if (options.level === 'extreme') {
    const min = Math.round(fileSize * (options.grayscale ? 0.14 : 0.20));
    const max = Math.round(fileSize * (options.grayscale ? 0.25 : 0.32));
    return {
      min,
      max,
      isReliable: true,
      label: `~${formatBytes(min)} – ${formatBytes(max)} (Maximum compression)`,
    };
  }

  if (options.level === 'target') {
    const target = options.targetSizeBytes || 500 * 1024;
    if (target >= fileSize) {
      return {
        min: Math.round(fileSize * 0.85),
        max: fileSize,
        isReliable: true,
        label: `Current size is already below target (${formatBytes(target)}). Light lossless optimization will be applied.`,
      };
    }
    const min = Math.round(target * 0.88);
    const max = Math.round(target * 1.15);
    return {
      min,
      max,
      isReliable: true,
      label: `Targeting ~${formatBytes(target)} (Resolution & quality auto-tuned)`,
    };
  }

  return { min: 0, max: 0, isReliable: false, label: 'Estimate calculated dynamically' };
}

/**
 * Genuine Browser PDF Compression:
 * 1. Lossless object stream compression & metadata clean
 * 2. Visual rendering downsampling & JPEG compression for heavy pages
 * 3. Dynamic target-size tuning per page
 * 4. Password-protected and corrupted PDF error handling
 */
export async function compressPdf(
  file: File,
  options: CompressionOptions,
  onProgress?: (percent: number) => void
): Promise<{
  bytes: Uint8Array;
  originalSize: number;
  newSize: number;
  savedPercent: number;
}> {
  const MIN_FILE_SIZE = 5 * 1024; // 5 KB
  if (!file || file.size < MIN_FILE_SIZE) {
    throw new Error("File is too small or empty. Please upload a valid PDF.");
  }

  const originalSize = file.size;
  let arrayBuffer: ArrayBuffer;

  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    throw new Error('Failed to read file from memory. Please try re-selecting the document.');
  }

  // Pre-check for encryption/password with pdf-lib
  try {
    const testDoc = await loadPdfSafely(arrayBuffer);
    if (testDoc.isEncrypted) {
      throw new Error('This PDF is password-protected or encrypted. Please remove password protection before compressing.');
    }
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() || '';
    if (msg.includes('password') || msg.includes('encrypt') || err?.name === 'PasswordException') {
      throw new Error('This PDF is password-protected or encrypted. Please remove password protection before compressing.');
    }
    if (msg.includes('corrupted') || msg.includes('invalid pdf') || err?.name === 'InvalidPDFException') {
      throw new Error('The file appears to be corrupted or is not a valid PDF document.');
    }
    // Continue if not fatal
  }

  if (options.level === 'low' || (options.level === 'target' && (options.targetSizeBytes || 0) >= originalSize)) {
    // Lossless structural compression
    if (onProgress) onProgress(30);
    try {
      const sourceDoc = await loadPdfSafely(arrayBuffer);
      if (onProgress) onProgress(70);
      const bytes = await sourceDoc.save({ useObjectStreams: true });
      const newSize = bytes.byteLength;
      const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));
      if (onProgress) onProgress(100);
      return { bytes, originalSize, newSize, savedPercent };
    } catch (err: any) {
      throw new Error(`Failed to process PDF structure: ${err?.message || 'Unsupported format'}`);
    }
  }

  // Recommended, Extreme, or Target: Re-encode pages through canvas with target DPI and JPEG quality
  if (onProgress) onProgress(15);

  let pdfJsDoc: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    pdfJsDoc = await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
      throw new Error('This PDF is password-protected. Please unlock the file before compressing.');
    }
    if (err?.name === 'InvalidPDFException' || err?.message?.toLowerCase().includes('invalid pdf')) {
      throw new Error('The file appears to be corrupted or is not a valid PDF document.');
    }
    throw new Error(`Unable to load PDF document: ${err?.message || 'Unsupported PDF format'}`);
  }

  const totalPages = pdfJsDoc.numPages;
  if (totalPages <= 0) {
    throw new Error('Document contains no pages or is empty.');
  }

  const compressedDoc = await PDFDocument.create();

  // Determine scale and JPEG quality based on mode or target size
  let scale = 1.8;
  let jpegQuality = 0.72;

  if (options.level === 'extreme') {
    scale = 1.33; // ~96 DPI
    jpegQuality = options.quality || 0.48;
  } else if (options.level === 'recommended') {
    scale = 1.8; // ~130 DPI
    jpegQuality = options.quality || 0.72;
  } else if (options.level === 'target') {
    const targetBytes = options.targetSizeBytes || 500 * 1024;
    const bytesPerPage = Math.max(1024, targetBytes / totalPages);

    if (bytesPerPage < 35000) {
      scale = 1.05; // ~75 DPI
      jpegQuality = 0.38;
    } else if (bytesPerPage < 65000) {
      scale = 1.25; // ~90 DPI
      jpegQuality = 0.50;
    } else if (bytesPerPage < 120000) {
      scale = 1.5; // ~108 DPI
      jpegQuality = 0.64;
    } else if (bytesPerPage < 250000) {
      scale = 1.75; // ~126 DPI
      jpegQuality = 0.74;
    } else {
      scale = 1.9; // ~136 DPI
      jpegQuality = 0.82;
    }
  }

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to acquire canvas context for compression');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    // Optional grayscale transformation
    if (options.grayscale) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let j = 0; j < data.length; j += 4) {
        const avg = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
        data[j] = avg;
        data[j + 1] = avg;
        data[j + 2] = avg;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Convert to compressed JPEG data
    const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
    const embeddedImage = await compressedDoc.embedJpg(jpegBytes);

    // Get original page dimension in standard PDF points (72 DPI)
    const originalViewport = page.getViewport({ scale: 1.0 });
    const newPage = compressedDoc.addPage([originalViewport.width, originalViewport.height]);

    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });

    // Release canvas from memory
    canvas.width = 0;
    canvas.height = 0;

    if (onProgress) {
      onProgress(Math.round(15 + (i / totalPages) * 75));
    }
  }

  const bytes = await compressedDoc.save({ useObjectStreams: true });
  let newSize = bytes.byteLength;

  // Safeguard: If re-encoding happens to be larger (e.g. on a tiny plain text file), fallback to lossless
  if (newSize > originalSize) {
    const fallbackDoc = await loadPdfSafely(arrayBuffer);
    const fallbackBytes = await fallbackDoc.save({ useObjectStreams: true });
    if (fallbackBytes.byteLength < newSize) {
      newSize = fallbackBytes.byteLength;
      const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));
      if (onProgress) onProgress(100);
      return { bytes: fallbackBytes, originalSize, newSize, savedPercent };
    }
  }

  const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));
  if (onProgress) onProgress(100);

  return { bytes, originalSize, newSize, savedPercent };
}

/**
 * Reorganize PDF: rotate, re-order, and delete pages
 */
export async function organizePdf(
  file: File,
  pages: { originalIndex: number; rotation: number; deleted: boolean }[],
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await loadPdfSafely(arrayBuffer);
  const newDoc = await PDFDocument.create();

  const activePages = pages.filter((p) => !p.deleted);
  if (activePages.length === 0) {
    throw new Error('At least one page must remain in the document.');
  }

  for (let i = 0; i < activePages.length; i++) {
    const pageItem = activePages[i];
    const [copiedPage] = await newDoc.copyPages(sourceDoc, [pageItem.originalIndex]);

    if (pageItem.rotation !== 0) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + pageItem.rotation) % 360));
    }

    newDoc.addPage(copiedPage);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / activePages.length) * 90));
    }
  }

  const bytes = await newDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);

  return { bytes, pageCount: activePages.length };
}

/**
 * Apply Watermark (Text or Image) and Page Numbers
 */
export async function applyWatermarkAndNumbers(
  file: File,
  watermark?: WatermarkOptions,
  pageNumbers?: PageNumberOptions,
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await loadPdfSafely(arrayBuffer);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  let embeddedImage: any = null;
  if (watermark && watermark.type === 'image' && (watermark.imageFile || watermark.imageDataUrl)) {
    try {
      let imgBytes: Uint8Array;
      let isPng = false;

      if (watermark.imageFile) {
        const buf = await watermark.imageFile.arrayBuffer();
        imgBytes = new Uint8Array(buf);
        isPng = watermark.imageFile.type.includes('png') || watermark.imageFile.name.toLowerCase().endsWith('.png');
      } else {
        const dataUrl = watermark.imageDataUrl!;
        imgBytes = dataUrlToUint8Array(dataUrl);
        isPng = dataUrl.startsWith('data:image/png');
      }

      if (isPng) {
        embeddedImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imgBytes);
      }
    } catch (e) {
      console.warn('Direct image embed failed, using canvas fallback', e);
      if (watermark.imageDataUrl) {
        const img = new Image();
        img.src = watermark.imageDataUrl;
        await new Promise((res) => { img.onload = res; });
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const pngUrl = c.toDataURL('image/png');
        embeddedImage = await pdfDoc.embedPng(dataUrlToUint8Array(pngUrl));
      }
    }
  }

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // 1. Watermark
    if (watermark) {
      if (watermark.type === 'text' && watermark.text.trim()) {
        const fontSize = watermark.fontSize || 42;
        const opacity = watermark.opacity ?? 0.35;
        const rot = watermark.rotation ?? -45;
        const textWidth = helveticaBold.widthOfTextAtSize(watermark.text, fontSize);
        const textHeight = helveticaBold.heightAtSize(fontSize);

        const colorObj = hexToRgb(watermark.color || '#dc2626');

        let x = (width - textWidth) / 2;
        let y = (height - textHeight) / 2;

        if (watermark.position === 'top-left') {
          x = 50;
          y = height - 80;
        } else if (watermark.position === 'top-right') {
          x = width - textWidth - 50;
          y = height - 80;
        } else if (watermark.position === 'bottom-left') {
          x = 50;
          y = 50;
        } else if (watermark.position === 'bottom-right') {
          x = width - textWidth - 50;
          y = 50;
        }

        page.drawText(watermark.text, {
          x,
          y,
          size: fontSize,
          font: helveticaBold,
          color: rgb(colorObj.r, colorObj.g, colorObj.b),
          opacity,
          rotate: degrees(rot),
        });
      } else if (watermark.type === 'image' && embeddedImage) {
        const scale = watermark.imageScale || 0.45;
        const imgW = embeddedImage.width * scale;
        const imgH = embeddedImage.height * scale;
        const opacity = watermark.opacity ?? 0.35;
        const rot = watermark.rotation ?? 0;

        let x = (width - imgW) / 2;
        let y = (height - imgH) / 2;

        if (watermark.position === 'top-left') {
          x = 40;
          y = height - imgH - 40;
        } else if (watermark.position === 'top-right') {
          x = width - imgW - 40;
          y = height - imgH - 40;
        } else if (watermark.position === 'bottom-left') {
          x = 40;
          y = 40;
        } else if (watermark.position === 'bottom-right') {
          x = width - imgW - 40;
          y = 40;
        }

        page.drawImage(embeddedImage, {
          x,
          y,
          width: imgW,
          height: imgH,
          opacity,
          rotate: degrees(rot),
        });
      }
    }

    // 2. Page numbers
    if (pageNumbers && pageNumbers.enabled) {
      const num = i + (pageNumbers.startFrom || 1);
      let pageText = `${num}`;
      if (pageNumbers.format === 'page-x') {
        pageText = `Page ${num}`;
      } else if (pageNumbers.format === 'page-x-of-y') {
        pageText = `Page ${num} of ${totalPages}`;
      }

      const numFontSize = pageNumbers.fontSize || 10;
      const numWidth = helvetica.widthOfTextAtSize(pageText, numFontSize);

      let px = (width - numWidth) / 2;
      let py = 25;

      if (pageNumbers.position === 'bottom-left') {
        px = 40;
        py = 25;
      } else if (pageNumbers.position === 'bottom-right') {
        px = width - numWidth - 40;
        py = 25;
      } else if (pageNumbers.position === 'top-center') {
        px = (width - numWidth) / 2;
        py = height - 30;
      } else if (pageNumbers.position === 'top-right') {
        px = width - numWidth - 40;
        py = height - 30;
      }

      page.drawText(pageText, {
        x: px,
        y: py,
        size: numFontSize,
        font: helvetica,
        color: rgb(0.2, 0.25, 0.3),
        opacity: 0.85,
      });
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalPages) * 90));
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  return bytes;
}

/**
 * Bake annotations (highlights, comments, freehand, shapes, underline, strikethrough) into PDF
 */
export async function exportAnnotatedPdf(
  file: File,
  annotationsByPage: { [pageIndex: number]: AnnotationItem[] },
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await loadPdfSafely(arrayBuffer);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const pageAnnotations = annotationsByPage[i];

    if (pageAnnotations && pageAnnotations.length > 0) {
      const { width, height } = page.getSize();

      const canvas = document.createElement('canvas');
      const pixelRatio = 2;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.scale(pixelRatio, pixelRatio);

        for (const item of pageAnnotations) {
          ctx.save();

          if (item.type === 'pen' || item.type === 'highlight') {
            const freehand = item as any;
            if (freehand.points && freehand.points.length > 1) {
              ctx.strokeStyle = item.color;
              ctx.globalAlpha = item.type === 'highlight' ? Math.min(item.opacity || 0.35, 0.5) : (item.opacity ?? 1);
              ctx.lineWidth = item.strokeWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';

              if (item.type === 'highlight') {
                ctx.globalCompositeOperation = 'multiply';
              }

              ctx.beginPath();
              ctx.moveTo(freehand.points[0].x, freehand.points[0].y);
              for (let p = 1; p < freehand.points.length; p++) {
                ctx.lineTo(freehand.points[p].x, freehand.points[p].y);
              }
              ctx.stroke();
            }
          } else if (item.type === 'rectangle') {
            const shape = item as any;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.strokeWidth;
            ctx.globalAlpha = item.opacity ?? 1;

            const rx = Math.min(shape.startX, shape.endX);
            const ry = Math.min(shape.startY, shape.endY);
            const rw = Math.abs(shape.endX - shape.startX);
            const rh = Math.abs(shape.endY - shape.startY);

            if (shape.fillColor) {
              ctx.fillStyle = shape.fillColor;
              ctx.globalAlpha = shape.fillOpacity || 0.2;
              ctx.fillRect(rx, ry, rw, rh);
              ctx.globalAlpha = item.opacity ?? 1;
            }
            ctx.strokeRect(rx, ry, rw, rh);
          } else if (item.type === 'circle') {
            const shape = item as any;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.strokeWidth;
            ctx.globalAlpha = item.opacity ?? 1;

            const cx = (shape.startX + shape.endX) / 2;
            const cy = (shape.startY + shape.endY) / 2;
            const rx = Math.abs(shape.endX - shape.startX) / 2;
            const ry = Math.abs(shape.endY - shape.startY) / 2;

            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
            if (shape.fillColor) {
              ctx.fillStyle = shape.fillColor;
              ctx.globalAlpha = shape.fillOpacity || 0.2;
              ctx.fill();
              ctx.globalAlpha = item.opacity ?? 1;
            }
            ctx.stroke();
          } else if (item.type === 'arrow' || item.type === 'line') {
            const shape = item as any;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.strokeWidth;
            ctx.globalAlpha = item.opacity ?? 1;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();

            if (item.type === 'arrow') {
              const headlen = Math.max(10, item.strokeWidth * 3);
              const dx = shape.endX - shape.startX;
              const dy = shape.endY - shape.startY;
              const angle = Math.atan2(dy, dx);

              ctx.fillStyle = item.color;
              ctx.beginPath();
              ctx.moveTo(shape.endX, shape.endY);
              ctx.lineTo(
                shape.endX - headlen * Math.cos(angle - Math.PI / 6),
                shape.endY - headlen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                shape.endX - headlen * Math.cos(angle + Math.PI / 6),
                shape.endY - headlen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
          } else if (item.type === 'underline' || item.type === 'strikethrough') {
            const shape = item as any;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = Math.max(2, item.strokeWidth);
            ctx.globalAlpha = item.opacity ?? 1;
            ctx.lineCap = 'round';

            const startX = Math.min(shape.startX, shape.endX);
            const endX = Math.max(shape.startX, shape.endX);
            const y = item.type === 'underline'
              ? Math.max(shape.startY, shape.endY)
              : (shape.startY + shape.endY) / 2;

            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
          } else if (item.type === 'text') {
            const textItem = item as any;
            ctx.font = `${textItem.fontSize || 14}px 'Plus Jakarta Sans', system-ui, sans-serif`;
            ctx.textBaseline = 'top';

            const padding = 6;
            const textMetrics = ctx.measureText(textItem.text || '');
            const boxW = textMetrics.width + padding * 2;
            const boxH = (textItem.fontSize || 14) + padding * 2;

            ctx.fillStyle = textItem.bgColor || 'rgba(254, 240, 138, 0.9)';
            ctx.beginPath();
            ctx.roundRect(textItem.x, textItem.y, boxW, boxH, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(202, 138, 4, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = item.color || '#1e293b';
            ctx.globalAlpha = item.opacity ?? 1;
            ctx.fillText(textItem.text, textItem.x + padding, textItem.y + padding);
          }

          ctx.restore();
        }

        const pngDataUrl = canvas.toDataURL('image/png');
        const pngBytes = dataUrlToUint8Array(pngDataUrl);
        const embeddedPng = await pdfDoc.embedPng(pngBytes);

        page.drawImage(embeddedPng, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalPages) * 90));
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  return bytes;
}

/**
 * Trigger client-side browser file download
 */
export function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string = 'application/pdf'): void {
  // Ensure array buffer slice is clean before creating Blob to prevent empty/partial downloads
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download multiple files packed into a ZIP archive
 */
export async function downloadZipBundle(
  files: { filename: string; bytes: Uint8Array }[],
  zipFilename: string = 'yourPDFworld_Split_PDFs.zip'
): Promise<void> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, f.bytes);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Internal helpers
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const intVal = parseInt(cleanHex, 16) || 0;
  return {
    r: ((intVal >> 16) & 255) / 255,
    g: ((intVal >> 8) & 255) / 255,
    b: (intVal & 255) / 255,
  };
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Encrypt and password-protect a PDF with AES-256 or RC4
 */
export async function encryptPdfDocument(
  file: File,
  options: SecurityOptions,
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; filename: string }> {
  if (onProgress) onProgress(20);
  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  if (onProgress) onProgress(50);

  const encryptOpts: EncryptPDFOptions = {
    ownerPassword: options.ownerPassword?.trim() || undefined,
    algorithm: options.algorithm || 'AES-256',
    allowPrinting: options.allowPrinting,
    allowHighQualityPrint: options.allowHighQualityPrint,
    allowCopying: options.allowCopying,
    allowModifying: options.allowModifying,
    allowAnnotating: options.allowAnnotating,
    allowFillingForms: options.allowFillingForms,
    allowAssembly: options.allowAssembly,
    allowExtraction: options.allowCopying,
  };

  const encryptedBytes = await encryptPDF(
    inputBytes,
    options.userPassword,
    encryptOpts
  );

  if (onProgress) onProgress(100);

  const cleanName = `${file.name.replace(/\.pdf$/i, '')}_protected.pdf`;
  return { bytes: encryptedBytes, filename: cleanName };
}

/**
 * Permanently rotate individual or all pages of a PDF by 90-degree increments
 */
export async function rotatePdfPages(
  file: File,
  pageRotations: { [pageIndex: number]: number },
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; filename: string }> {
  if (onProgress) onProgress(20);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await loadPdfSafely(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const delta = pageRotations[i] || 0;
    if (delta !== 0) {
      const page = pages[i];
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + delta + 360) % 360));
    }
    if (onProgress) {
      onProgress(Math.round(20 + ((i + 1) / pages.length) * 70));
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);

  const cleanName = `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`;
  return { bytes, filename: cleanName };
}

/**
 * Format page number string according to style and options
 */
export function formatPageNumberText(
  pageNumber: number,
  totalPages: number,
  format: PageNumberConfig['format'],
  customPrefix?: string,
  customSuffix?: string
): string {
  switch (format) {
    case 'numbers-only':
      return `${pageNumber}`;
    case 'page-x':
      return `Page ${pageNumber}`;
    case 'page-x-of-y':
      return `Page ${pageNumber} of ${totalPages}`;
    case 'x-of-y':
      return `${pageNumber} / ${totalPages}`;
    case 'hyphenated':
      return `- ${pageNumber} -`;
    case 'custom':
      return `${customPrefix || ''}${pageNumber}${customSuffix || ''}`;
    default:
      return `${pageNumber}`;
  }
}

/**
 * Permanently add page numbers to PDF pages with position, font, styling, and range options
 */
export async function applyPageNumbersToPdf(
  file: File,
  config: PageNumberConfig,
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; filename: string }> {
  if (onProgress) onProgress(15);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await loadPdfSafely(arrayBuffer);

  const fontMap: Record<string, StandardFonts> = {
    'Helvetica': StandardFonts.Helvetica,
    'Helvetica-Bold': StandardFonts.HelveticaBold,
    'Times-Roman': StandardFonts.TimesRoman,
    'Times-Bold': StandardFonts.TimesRomanBold,
    'Courier': StandardFonts.Courier,
    'Courier-Bold': StandardFonts.CourierBold,
  };

  const selectedStandardFont = fontMap[config.font] || StandardFonts.Helvetica;
  const embeddedFont = await pdfDoc.embedFont(selectedStandardFont);

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const { r, g, b } = hexToRgb(config.color || '#334155');
  const opacity = typeof config.opacity === 'number' ? Math.max(0.1, Math.min(1, config.opacity)) : 0.9;
  const fontSize = config.fontSize || 10;
  const marginX = config.marginHorizontal ?? 36;
  const marginY = config.marginVertical ?? 28;

  const firstPage = Math.max(1, config.firstPageToNumber || 1);
  const lastPage = config.lastPageToNumber && config.lastPageToNumber > 0
    ? Math.min(totalPages, config.lastPageToNumber)
    : totalPages;
  const startNum = config.startNumber ?? 1;

  for (let i = 0; i < totalPages; i++) {
    const page1Based = i + 1;

    // Check if within numbered range
    if (page1Based >= firstPage && page1Based <= lastPage) {
      const page = pages[i];
      const { width, height } = page.getSize();

      const calculatedNumber = (page1Based - firstPage) + startNum;
      const text = formatPageNumberText(
        calculatedNumber,
        totalPages,
        config.format,
        config.customPrefix,
        config.customSuffix
      );

      const textWidth = embeddedFont.widthOfTextAtSize(text, fontSize);

      let x = (width - textWidth) / 2;
      let y = marginY;

      switch (config.position) {
        case 'bottom-left':
          x = marginX;
          y = marginY;
          break;
        case 'bottom-center':
          x = (width - textWidth) / 2;
          y = marginY;
          break;
        case 'bottom-right':
          x = width - textWidth - marginX;
          y = marginY;
          break;
        case 'top-left':
          x = marginX;
          y = height - marginY - fontSize;
          break;
        case 'top-center':
          x = (width - textWidth) / 2;
          y = height - marginY - fontSize;
          break;
        case 'top-right':
          x = width - textWidth - marginX;
          y = height - marginY - fontSize;
          break;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: embeddedFont,
        color: rgb(r, g, b),
        opacity,
      });
    }

    if (onProgress) {
      onProgress(Math.round(20 + ((i + 1) / totalPages) * 70));
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);

  const cleanName = `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf`;
  return { bytes, pageCount: totalPages, filename: cleanName };
}
