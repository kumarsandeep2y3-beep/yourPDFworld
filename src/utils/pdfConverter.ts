import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { parsePageRanges } from './pdfEngine';

export interface ConvertedImageResult {
  filename: string;
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  pageNumber: number;
}

export interface ConvertedTextResult {
  fullText: string;
  markdownText: string;
  pageTexts: { pageNumber: number; text: string }[];
}

/**
 * Convert PDF pages to high-resolution PNG or JPG images
 */
export async function convertPdfToImages(
  file: File,
  format: 'png' | 'jpg',
  options: {
    dpi?: number; // e.g. 100, 150, 200, 300
    quality?: number; // 0.1 to 1.0 (for JPG)
    pageRange?: string;
  } = {},
  onProgress?: (percent: number) => void
): Promise<ConvertedImageResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const targetIndices = parsePageRanges(options.pageRange || '', totalPages);
  const results: ConvertedImageResult[] = [];

  const dpi = options.dpi || 150;
  const scale = dpi / 72; // Standard PDF point is 72 DPI
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = options.quality ?? 0.88;
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let idx = 0; idx < targetIndices.length; idx++) {
    const pageIndex = targetIndices[idx];
    const pageNumber = pageIndex + 1;
    const page = await pdfDoc.getPage(pageNumber);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    // Always fill white background (prevents black background on JPG and transparent PNG readability)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const bytes = dataUrlToUint8Array(dataUrl);
    const filename = `${baseName}_page_${pageNumber}.${format}`;

    results.push({
      filename,
      dataUrl,
      bytes,
      width: canvas.width,
      height: canvas.height,
      pageNumber,
    });

    if (onProgress) {
      onProgress(Math.round(((idx + 1) / targetIndices.length) * 100));
    }
  }

  return results;
}

/**
 * Extract clean, structured text content and markdown from PDF pages
 */
export async function convertPdfToText(
  file: File,
  options: {
    pageRange?: string;
    includePageHeaders?: boolean;
  } = {},
  onProgress?: (percent: number) => void
): Promise<ConvertedTextResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const targetIndices = parsePageRanges(options.pageRange || '', totalPages);

  const pageTexts: { pageNumber: number; text: string }[] = [];
  const fullTextParts: string[] = [];
  const markdownParts: string[] = [];

  for (let idx = 0; idx < targetIndices.length; idx++) {
    const pageIndex = targetIndices[idx];
    const pageNumber = pageIndex + 1;
    const page = await pdfDoc.getPage(pageNumber);

    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Sort items by Y descending (top-to-bottom) then X ascending (left-to-right)
    const linesMap = new Map<number, string[]>();
    for (const item of items) {
      if (!('str' in item) || !item.str) continue;
      // Group items with similar vertical Y position (tolerance of ~4pt)
      const y = Math.round(item.transform[5] / 4) * 4;
      if (!linesMap.has(y)) {
        linesMap.set(y, []);
      }
      linesMap.get(y)!.push(item.str);
    }

    // Sort Y lines descending (PDF coordinate origin is bottom-left)
    const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];

    for (const y of sortedYs) {
      const lineStr = linesMap.get(y)!.join(' ').trim();
      if (lineStr) {
        pageLines.push(lineStr);
      }
    }

    const pageContent = pageLines.join('\n');
    pageTexts.push({ pageNumber, text: pageContent });

    const header = `--- Page ${pageNumber} of ${totalPages} ---`;
    fullTextParts.push(`${header}\n\n${pageContent}`);
    markdownParts.push(`## Page ${pageNumber}\n\n${pageContent}`);

    if (onProgress) {
      onProgress(Math.round(((idx + 1) / targetIndices.length) * 100));
    }
  }

  return {
    fullText: fullTextParts.join('\n\n\n'),
    markdownText: markdownParts.join('\n\n\n'),
    pageTexts,
  };
}

/**
 * Trigger download of plain text or markdown file
 */
export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
 * Bundle all converted images into a downloadable ZIP archive
 */
export async function downloadImagesZip(
  images: ConvertedImageResult[],
  zipFilename: string = 'Converted_Images.zip'
): Promise<void> {
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.filename, img.bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
