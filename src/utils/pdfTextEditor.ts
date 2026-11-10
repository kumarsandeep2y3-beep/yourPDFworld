import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { TextReplacementItem } from '../types/pdf';
import { loadPdfSafely } from './justPdfSecurityProcessor';

export interface PageTextItem {
  id: string;
  pageIndex: number; // 0-based
  str: string;
  x: number; // PDF points from left
  y: number; // PDF points from bottom
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

/**
 * Convert Hex Color to pdf-lib RGB (0..1)
 */
function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

/**
 * Extract text items with exact PDF bounding boxes using PDF.js
 */
export async function extractDocumentTextItems(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  targetPage?: number // 1-based, optional
): Promise<PageTextItem[]> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const results: PageTextItem[] = [];

  const startPage = targetPage ? Math.max(1, targetPage) : 1;
  const endPage = targetPage ? Math.min(pdfDoc.numPages, targetPage) : pdfDoc.numPages;

  for (let p = startPage; p <= endPage; p++) {
    const pageIndex = p - 1;
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    let idx = 0;
    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;

      // Transform matrix: [scaleX, skewY, skewX, scaleY, transX, transY]
      const tx = item.transform;
      const x = tx[4];
      const y = tx[5]; // in PDF point coordinates from bottom
      const width = item.width || Math.max(10, item.str.length * (item.height * 0.55));
      const height = item.height || 12;

      results.push({
        id: `p${pageIndex}_item_${idx++}`,
        pageIndex,
        str: item.str,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        fontSize: Math.round((Math.abs(tx[0]) || height) * 10) / 10,
        fontName: item.fontName || 'Helvetica',
      });
    }
  }

  return results;
}

/**
 * Search PDF for occurrences of a search string
 */
export async function searchPdfMatches(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  searchTerm: string,
  caseSensitive: boolean = false
): Promise<PageTextItem[]> {
  if (!searchTerm || !searchTerm.trim()) return [];

  const allItems = await extractDocumentTextItems(fileOrBuffer);
  const term = caseSensitive ? searchTerm.trim() : searchTerm.trim().toLowerCase();

  return allItems.filter((item) => {
    const text = caseSensitive ? item.str : item.str.toLowerCase();
    return text.includes(term);
  });
}

/**
 * Apply Text Redaction & Replacement Edits to PDF using PDF-lib
 */
export async function applyTextReplacements(
  file: File,
  replacements: TextReplacementItem[],
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; filename: string }> {
  if (replacements.length === 0) {
    throw new Error('Please specify at least one text edit to apply.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await loadPdfSafely(arrayBuffer);

  // Embed standard fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontCourierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const getFont = (family: string) => {
    switch (family) {
      case 'Helvetica-Bold':
        return fontHelveticaBold;
      case 'Times-Roman':
        return fontTimes;
      case 'Times-Bold':
        return fontTimesBold;
      case 'Courier':
        return fontCourier;
      case 'Courier-Bold':
        return fontCourierBold;
      default:
        return fontHelvetica;
    }
  };

  const total = replacements.length;

  for (let i = 0; i < total; i++) {
    const item = replacements[i];
    if (item.pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(item.pageIndex);
    const selectedFont = getFont(item.fontFamily);

    // 1. Redact / Whiteout original text region with slight padding
    const padding = 2;
    const coverColor = item.fillColor ? hexToRgb(item.fillColor) : rgb(1, 1, 1);

    page.drawRectangle({
      x: Math.max(0, item.x - padding),
      y: Math.max(0, item.y - padding),
      width: item.width + padding * 2,
      height: item.height + padding * 2,
      color: coverColor,
      borderColor: coverColor,
    });

    // 2. Draw replacement text
    if (item.replaceText && item.replaceText.trim()) {
      const textColor = hexToRgb(item.textColor || '#0f172a');
      page.drawText(item.replaceText, {
        x: item.x,
        y: item.y,
        size: Math.max(6, item.fontSize || 12),
        font: selectedFont,
        color: textColor,
      });
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 90));
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);

  const baseName = file.name.replace(/\.pdf$/i, '');
  return {
    bytes,
    filename: `${baseName}_edited.pdf`,
  };
}
