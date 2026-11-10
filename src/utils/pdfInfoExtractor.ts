// Polyfill Promise.try for cross-browser and Node compatibility with modern pdfjs-dist
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function (fn: any, ...args: any[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { PageGeometryInfo, PdfDocumentInfo } from '../types/pdf';
import { loadPdfSafely } from './justPdfSecurityProcessor';

// Ensure PDF.js worker is configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  } catch {
    // Ignore worker initialization error
  }
}

/**
 * Standard Paper formats in Points (1 pt = 1/72 inch)
 */
const STANDARD_PAPERS: { name: string; widthPt: number; heightPt: number }[] = [
  { name: 'A4', widthPt: 595.28, heightPt: 841.89 },
  { name: 'US Letter', widthPt: 612.0, heightPt: 792.0 },
  { name: 'US Legal', widthPt: 612.0, heightPt: 1008.0 },
  { name: 'A3', widthPt: 841.89, heightPt: 1190.55 },
  { name: 'A5', widthPt: 419.53, heightPt: 595.28 },
  { name: 'A6', widthPt: 297.64, heightPt: 419.53 },
  { name: 'Tabloid / Ledger', widthPt: 792.0, heightPt: 1224.0 },
  { name: 'Executive', widthPt: 522.0, heightPt: 756.0 },
  { name: 'Statement / Half Letter', widthPt: 396.0, heightPt: 612.0 },
  { name: 'B5 (JIS)', widthPt: 516.0, heightPt: 729.0 },
  { name: 'B5 (ISO)', widthPt: 498.9, heightPt: 708.7 },
  { name: 'B4 (ISO)', widthPt: 708.7, heightPt: 1000.6 },
];

/**
 * Format bytes into human-friendly string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Match point dimensions to standard paper size (with tolerance)
 */
export function identifyPaperFormat(widthPt: number, heightPt: number): {
  standardPaper: string;
  orientation: 'Portrait' | 'Landscape' | 'Square';
  widthMm: number;
  heightMm: number;
  widthIn: number;
  heightIn: number;
} {
  const widthMm = Math.round((widthPt * 25.4) / 72 * 10) / 10;
  const heightMm = Math.round((heightPt * 25.4) / 72 * 10) / 10;
  const widthIn = Math.round((widthPt / 72) * 100) / 100;
  const heightIn = Math.round((heightPt / 72) * 100) / 100;

  const minDim = Math.min(widthPt, heightPt);
  const maxDim = Math.max(widthPt, heightPt);

  let orientation: 'Portrait' | 'Landscape' | 'Square' = 'Portrait';
  if (Math.abs(widthPt - heightPt) < 2) {
    orientation = 'Square';
  } else if (widthPt > heightPt) {
    orientation = 'Landscape';
  } else {
    orientation = 'Portrait';
  }

  // Tolerance of 4 points (~1.4 mm)
  const TOLERANCE = 4.5;
  for (const paper of STANDARD_PAPERS) {
    const pMin = Math.min(paper.widthPt, paper.heightPt);
    const pMax = Math.max(paper.widthPt, paper.heightPt);
    if (Math.abs(minDim - pMin) <= TOLERANCE && Math.abs(maxDim - pMax) <= TOLERANCE) {
      return {
        standardPaper: paper.name,
        orientation,
        widthMm,
        heightMm,
        widthIn,
        heightIn,
      };
    }
  }

  return {
    standardPaper: `Custom (${widthMm} × ${heightMm} mm)`,
    orientation,
    widthMm,
    heightMm,
    widthIn,
    heightIn,
  };
}

/**
 * Parse PDF date strings (e.g. D:20240315143000Z or D:20240315143000+02'00')
 */
export function parsePdfDate(rawDate: any): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;

  const str = String(rawDate).trim();
  if (!str) return null;

  // Standard PDF format: D:YYYYMMDDHHmmSS[OHH'mm']
  const pdfRegex = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(\d{2})?'?(\d{2})?'?/;
  const match = str.match(pdfRegex);

  if (match) {
    const year = parseInt(match[1], 10);
    const month = match[2] ? parseInt(match[2], 10) - 1 : 0;
    const day = match[3] ? parseInt(match[3], 10) : 1;
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;

    const tzSign = match[7];
    const tzHour = match[8] ? parseInt(match[8], 10) : 0;
    const tzMin = match[9] ? parseInt(match[9], 10) : 0;

    const date = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (tzSign && tzSign !== 'Z') {
      const offsetMs = (tzHour * 60 + tzMin) * 60 * 1000;
      if (tzSign === '+') {
        date.setTime(date.getTime() - offsetMs);
      } else if (tzSign === '-') {
        date.setTime(date.getTime() + offsetMs);
      }
    }
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback to standard Date parse
  const parsed = new Date(str);
  return !isNaN(parsed.getTime()) ? parsed : null;
}

/**
 * Format a Date object with relative time description
 */
export function formatFriendlyDate(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return 'Not specified in metadata';

  const dateStr = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = '';
  if (diffDays < 0) {
    relative = 'in the future';
  } else if (diffDays === 0) {
    if (diffHours === 0) {
      relative = diffMin <= 1 ? 'just now' : `${diffMin}m ago`;
    } else {
      relative = `${diffHours}h ago`;
    }
  } else if (diffDays === 1) {
    relative = 'yesterday';
  } else if (diffDays < 30) {
    relative = `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relative = months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    relative = years === 1 ? '1 year ago' : `${years} years ago`;
  }

  return `${dateStr} at ${timeStr} (${relative})`;
}

/**
 * Extract PDF header version (e.g. %PDF-1.7, %PDF-2.0)
 */
function extractPdfVersion(bytes: Uint8Array): string {
  try {
    const headerSlice = bytes.subarray(0, 32);
    const headerStr = new TextDecoder('latin1').decode(headerSlice);
    const match = headerStr.match(/%PDF-(\d+\.\d+)/);
    if (match) {
      return `PDF ${match[1]}`;
    }
  } catch {
    // ignore
  }
  return 'PDF 1.7';
}

/**
 * Detect Linearization / Fast Web View
 */
function detectLinearization(bytes: Uint8Array): boolean {
  try {
    const slice = bytes.subarray(0, 2048);
    const str = new TextDecoder('latin1').decode(slice);
    return str.includes('/Linearized');
  } catch {
    return false;
  }
}

/**
 * Parse raw encryption dictionary details from PDF bytes
 */
function parseEncryptionDetails(bytes: Uint8Array): {
  isEncrypted: boolean;
  algorithm: string;
  permissionsValue?: number;
} {
  try {
    // Scan last 64KB for trailer and /Encrypt
    const scanLen = Math.min(bytes.length, 65536);
    const tailSlice = bytes.subarray(bytes.length - scanLen);
    const tailStr = new TextDecoder('latin1').decode(tailSlice);

    if (!tailStr.includes('/Encrypt')) {
      return { isEncrypted: false, algorithm: 'None (Unprotected)' };
    }

    // Inspect encryption parameters
    let algorithm = 'Standard Encrypted';
    let permissionsValue: number | undefined;

    // Search for revision /R and version /V
    const rMatch = tailStr.match(/\/R\s+(\d+)/);
    const vMatch = tailStr.match(/\/V\s+(\d+)/);
    const pMatch = tailStr.match(/\/P\s+(-?\d+)/);

    if (pMatch) {
      permissionsValue = parseInt(pMatch[1], 10);
    }

    const rev = rMatch ? parseInt(rMatch[1], 10) : 0;
    const ver = vMatch ? parseInt(vMatch[1], 10) : 0;

    if (rev >= 5 || ver === 5) {
      algorithm = 'AES-256 (Revision 5/6, ISO 32000-2)';
    } else if (rev === 4 || ver === 4) {
      algorithm = 'AES-128 (Revision 4)';
    } else if (rev === 3 || ver === 2) {
      algorithm = 'RC4-128 (Revision 3)';
    } else if (rev === 2 || ver === 1) {
      algorithm = 'RC4-40 (Revision 2)';
    }

    return { isEncrypted: true, algorithm, permissionsValue };
  } catch {
    return { isEncrypted: false, algorithm: 'None (Unprotected)' };
  }
}

/**
 * Primary Extraction Function: pulls all properties, metadata, geometry, and permissions
 */
export async function extractPdfInfo(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  customFileName?: string
): Promise<PdfDocumentInfo> {
  let arrayBuffer: ArrayBuffer;
  let fileName = customFileName || 'document.pdf';
  let fileSize = 0;

  if (fileOrBuffer instanceof File) {
    fileName = fileOrBuffer.name;
    fileSize = fileOrBuffer.size;
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    fileSize = fileOrBuffer.byteLength;
    arrayBuffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    fileSize = fileOrBuffer.byteLength;
    arrayBuffer = fileOrBuffer;
  }

  const bytes = new Uint8Array(arrayBuffer);
  const pdfVersion = extractPdfVersion(bytes);
  const isLinearized = detectLinearization(bytes);
  const encryptionInfo = parseEncryptionDetails(bytes);

  // Load via pdf-lib for structural extraction
  let pdfLibDoc: PDFDocument | null = null;
  try {
    pdfLibDoc = await loadPdfSafely(arrayBuffer);
  } catch (err) {
    console.warn('pdf-lib failed to parse, fallback to PDF.js:', err);
  }

  // Load via pdfjs-dist for advanced metadata, permissions, and outlines
  let pdfJsDoc: any = null;
  let pdfJsMetadata: any = null;
  let pdfJsPermissions: number[] | null = null;
  let outlineCount = 0;
  let attachmentsCount = 0;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: bytes.slice(0),
      useSystemFonts: true,
    });
    pdfJsDoc = await loadingTask.promise;
    pdfJsMetadata = await pdfJsDoc.getMetadata().catch(() => null);
    pdfJsPermissions = await pdfJsDoc.getPermissions().catch(() => null);

    const outline = await pdfJsDoc.getOutline().catch(() => null);
    if (Array.isArray(outline)) {
      outlineCount = outline.length;
    }

    const attachments = await pdfJsDoc.getAttachments().catch(() => null);
    if (attachments && typeof attachments === 'object') {
      attachmentsCount = Object.keys(attachments).length;
    }
  } catch (err) {
    console.warn('PDF.js loading task warning:', err);
  }

  // Page Count
  const pageCount = pdfJsDoc?.numPages || pdfLibDoc?.getPageCount() || 1;

  // Document metadata fields
  const infoObj = pdfJsMetadata?.info || {};

  const title = (
    infoObj.Title ||
    pdfLibDoc?.getTitle() ||
    ''
  ).trim() || null;

  const author = (
    infoObj.Author ||
    pdfLibDoc?.getAuthor() ||
    ''
  ).trim() || null;

  const subject = (
    infoObj.Subject ||
    pdfLibDoc?.getSubject() ||
    ''
  ).trim() || null;

  const rawKeywords = infoObj.Keywords || pdfLibDoc?.getKeywords() || '';
  const keywords = (Array.isArray(rawKeywords) ? rawKeywords : String(rawKeywords).split(/[,;]+/))
    .map((k: string) => k.trim())
    .filter(Boolean);

  const creator = (
    infoObj.Creator ||
    pdfLibDoc?.getCreator() ||
    ''
  ).trim() || null;

  const producer = (
    infoObj.Producer ||
    pdfLibDoc?.getProducer() ||
    ''
  ).trim() || null;

  const creationDate = parsePdfDate(infoObj.CreationDate || pdfLibDoc?.getCreationDate());
  const modificationDate = parsePdfDate(infoObj.ModDate || pdfLibDoc?.getModificationDate());

  const trappedRaw = infoObj.Trapped || '';
  const trapped = trappedRaw ? String(trappedRaw) : null;

  // AcroForm fields count
  let hasForms = Boolean(infoObj.IsAcroFormPresent);
  let formFieldsCount = 0;
  if (pdfLibDoc) {
    try {
      const form = pdfLibDoc.getForm();
      const fields = form.getFields();
      formFieldsCount = fields.length;
      if (formFieldsCount > 0) hasForms = true;
    } catch {
      // no form in document
    }
  }

  // Page Geometry extraction
  const pages: PageGeometryInfo[] = [];
  const paperOccurrences: Record<string, number> = {};

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    let widthPt = 595.28;
    let heightPt = 841.89;
    let rotation = 0;
    let mediaBox = { x: 0, y: 0, width: 595.28, height: 841.89 };
    let cropBox: { x: number; y: number; width: number; height: number } | undefined;

    if (pdfLibDoc && i < pdfLibDoc.getPageCount()) {
      const p = pdfLibDoc.getPage(i);
      const size = p.getSize();
      widthPt = size.width;
      heightPt = size.height;
      rotation = p.getRotation()?.angle || 0;
      const mb = p.getMediaBox();
      mediaBox = { x: mb.x, y: mb.y, width: mb.width, height: mb.height };
      try {
        const cb = p.getCropBox();
        cropBox = { x: cb.x, y: cb.y, width: cb.width, height: cb.height };
      } catch {
        // crop box not distinct
      }
    } else if (pdfJsDoc) {
      try {
        const p = await pdfJsDoc.getPage(pageNum);
        const view = p.view; // [x1, y1, x2, y2]
        widthPt = Math.abs(view[2] - view[0]);
        heightPt = Math.abs(view[3] - view[1]);
        rotation = p.rotate || 0;
        mediaBox = { x: view[0], y: view[1], width: widthPt, height: heightPt };
      } catch {
        // fallback to standard A4
      }
    }

    const { standardPaper, orientation, widthMm, heightMm, widthIn, heightIn } =
      identifyPaperFormat(widthPt, heightPt);

    paperOccurrences[standardPaper] = (paperOccurrences[standardPaper] || 0) + 1;

    pages.push({
      pageNumber: pageNum,
      widthPt: Math.round(widthPt * 100) / 100,
      heightPt: Math.round(heightPt * 100) / 100,
      widthMm,
      heightMm,
      widthIn,
      heightIn,
      orientation,
      standardPaper,
      rotation,
      mediaBox,
      cropBox,
    });
  }

  // Determine if all pages are uniform in size
  const uniquePaperNames = Object.keys(paperOccurrences);
  const isUniformSize = uniquePaperNames.length === 1;
  const primaryPaper = uniquePaperNames[0] || 'A4';

  let pageSummary = '';
  if (isUniformSize) {
    const first = pages[0];
    pageSummary = `All ${pageCount} page${pageCount > 1 ? 's' : ''}: ${first.standardPaper} (${first.widthMm} × ${first.heightMm} mm, ${first.orientation})`;
  } else {
    pageSummary = `Mixed sizes: ${uniquePaperNames
      .map((name) => `${paperOccurrences[name]} ${name}`)
      .join(', ')}`;
  }

  // Security Permissions
  // In PDF specification:
  // Bit 3 (4): Print
  // Bit 4 (8): Modify contents
  // Bit 5 (16): Copy
  // Bit 6 (32): Modify annotations
  // Bit 9 (256): Fill forms
  // Bit 10 (512): Accessibility / Screen readers
  // Bit 11 (1024): Assemble
  // Bit 12 (2048): High quality print
  const isEncrypted = encryptionInfo.isEncrypted || Boolean(pdfJsMetadata?.info?.IsEncrypted);

  let permissions = {
    printing: 'Full High Resolution' as 'Full High Resolution' | 'Low Resolution (150 DPI)' | 'Disallowed',
    copying: true,
    modifying: true,
    annotating: true,
    formFilling: true,
    accessibility: true,
    assembly: true,
  };

  if (isEncrypted) {
    if (Array.isArray(pdfJsPermissions)) {
      // PDF.js provides an array of active permission flag codes
      const has = (flag: number) => pdfJsPermissions!.includes(flag);
      const canPrintHigh = has(2048);
      const canPrint = has(4);

      permissions = {
        printing: canPrintHigh
          ? 'Full High Resolution'
          : canPrint
          ? 'Low Resolution (150 DPI)'
          : 'Disallowed',
        copying: has(16),
        modifying: has(8),
        annotating: has(32),
        formFilling: has(256),
        accessibility: has(512),
        assembly: has(1024),
      };
    } else if (encryptionInfo.permissionsValue !== undefined) {
      const p = encryptionInfo.permissionsValue;
      const canPrint = (p & 4) !== 0;
      const canPrintHigh = (p & 2048) !== 0;

      permissions = {
        printing: canPrintHigh
          ? 'Full High Resolution'
          : canPrint
          ? 'Low Resolution (150 DPI)'
          : 'Disallowed',
        copying: (p & 16) !== 0,
        modifying: (p & 8) !== 0,
        annotating: (p & 32) !== 0,
        formFilling: (p & 256) !== 0,
        accessibility: (p & 512) !== 0,
        assembly: (p & 1024) !== 0,
      };
    } else {
      // Default protected restrictions
      permissions = {
        printing: 'Full High Resolution',
        copying: true,
        modifying: false,
        annotating: true,
        formFilling: true,
        accessibility: true,
        assembly: false,
      };
    }
  }

  // Raw XMP Metadata string
  let xmpRaw: string | null = null;
  if (pdfJsMetadata?.metadata) {
    try {
      xmpRaw = pdfJsMetadata.metadata.getRaw ? pdfJsMetadata.metadata.getRaw() : null;
    } catch {
      // ignore
    }
  }

  return {
    fileName,
    fileSize,
    fileSizeFormatted: `${formatBytes(fileSize)} (${fileSize.toLocaleString()} bytes)`,
    mimeType: 'application/pdf',
    pdfVersion,
    pageCount,
    isLinearized,
    isEncrypted,
    encryptionAlgorithm: encryptionInfo.algorithm,
    hasForms,
    formFieldsCount,
    hasOutline: outlineCount > 0,
    outlineCount,
    attachmentsCount,
    title,
    author,
    subject,
    keywords,
    creator,
    producer,
    creationDate,
    creationDateFormatted: formatFriendlyDate(creationDate),
    modificationDate,
    modificationDateFormatted: formatFriendlyDate(modificationDate),
    trapped,
    pages,
    pageSummary,
    isUniformSize,
    primaryPaper,
    permissions,
    rawMetadata: infoObj,
    xmpRaw,
  };
}

/**
 * Export document info to formatted JSON
 */
export function exportPdfInfoToJson(info: PdfDocumentInfo): void {
  const jsonStr = JSON.stringify(info, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${info.fileName.replace(/\.pdf$/i, '')}_properties.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format document info as a clean text / markdown report
 */
export function formatPdfInfoReport(info: PdfDocumentInfo): string {
  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(`JUSTPDF.ONLINE - DOCUMENT PROPERTIES REPORT`);
  lines.push(`=======================================================`);
  lines.push(``);
  lines.push(`[FILE OVERVIEW]`);
  lines.push(`File Name:       ${info.fileName}`);
  lines.push(`File Size:       ${info.fileSizeFormatted}`);
  lines.push(`PDF Specification: ${info.pdfVersion}`);
  lines.push(`Total Pages:     ${info.pageCount}`);
  lines.push(`Fast Web View:   ${info.isLinearized ? 'Yes (Linearized / Streamable)' : 'No (Standard)'}`);
  lines.push(`Interactive Forms: ${info.hasForms ? `Yes (${info.formFieldsCount} fields)` : 'None'}`);
  lines.push(`Bookmarks / TOC: ${info.hasOutline ? `Yes (${info.outlineCount} sections)` : 'None'}`);
  lines.push(`Embedded Files:  ${info.attachmentsCount > 0 ? `Yes (${info.attachmentsCount} attachments)` : 'None'}`);
  lines.push(``);
  lines.push(`[DOCUMENT METADATA]`);
  lines.push(`Title:           ${info.title || '(Not defined)'}`);
  lines.push(`Author:          ${info.author || '(Not defined)'}`);
  lines.push(`Subject:         ${info.subject || '(Not defined)'}`);
  lines.push(`Keywords:        ${info.keywords.length > 0 ? info.keywords.join(', ') : '(Not defined)'}`);
  lines.push(`Creator Tool:    ${info.creator || '(Not defined)'}`);
  lines.push(`PDF Producer:    ${info.producer || '(Not defined)'}`);
  lines.push(`Creation Date:   ${info.creationDateFormatted}`);
  lines.push(`Modified Date:   ${info.modificationDateFormatted}`);
  lines.push(`Trapped Status:  ${info.trapped || '(Unknown)'}`);
  lines.push(``);
  lines.push(`[PAGE GEOMETRY]`);
  lines.push(`Summary:         ${info.pageSummary}`);
  info.pages.forEach((p) => {
    lines.push(
      `Page ${p.pageNumber}: ${p.standardPaper} (${p.widthMm} × ${p.heightMm} mm / ${p.widthPt} × ${p.heightPt} pt) - ${p.orientation}, Rotation: ${p.rotation}°`
    );
  });
  lines.push(``);
  lines.push(`[SECURITY & PERMISSIONS]`);
  lines.push(`Encrypted:       ${info.isEncrypted ? 'Yes' : 'No'}`);
  lines.push(`Algorithm:       ${info.encryptionAlgorithm}`);
  lines.push(`Printing:        ${info.permissions.printing}`);
  lines.push(`Content Copying: ${info.permissions.copying ? 'Allowed' : 'Prohibited'}`);
  lines.push(`Modifications:   ${info.permissions.modifying ? 'Allowed' : 'Prohibited'}`);
  lines.push(`Annotations:     ${info.permissions.annotating ? 'Allowed' : 'Prohibited'}`);
  lines.push(`Form Filling:    ${info.permissions.formFilling ? 'Allowed' : 'Prohibited'}`);
  lines.push(`Screen Readers:  ${info.permissions.accessibility ? 'Allowed' : 'Prohibited'}`);
  lines.push(`Document Assembly: ${info.permissions.assembly ? 'Allowed' : 'Prohibited'}`);
  lines.push(``);
  lines.push(`Generated locally with yourPDFworld.com (100% Client-Side Privacy)`);

  return lines.join('\n');
}
