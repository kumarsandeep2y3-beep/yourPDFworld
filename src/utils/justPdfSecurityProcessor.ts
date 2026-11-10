/**
 * JustPDF.online - Master Unified File Handler & Security Processor
 * Combines Device-Based Smart Limits (Mobile: 50MB, Desktop: 150MB) 
 * with Global Image-to-PDF Converter and Robust PDF Metadata Recovery.
 */
import {
  PDFDocument,
  ParseSpeeds,
  StandardFonts,
  rgb,
  degrees,
} from 'pdf-lib';
import { createWorker, PSM } from 'tesseract.js';

// ==========================================
// 1. SMART DEVICE-BASED FILE SIZE LIMIT DETECTOR
// ==========================================
export function getMaxFileSizeLimit(): number {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 150 * 1024 * 1024;
  }
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  
  // 50MB limit for mobile to protect low-RAM devices, 150MB for desktops/laptops
  return isMobile ? (50 * 1024 * 1024) : (150 * 1024 * 1024);
}

// Helper: Convert any image file to a PNG Data URL using an offscreen canvas
async function convertImageToPngDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for PDF conversion'));
    };
    img.src = url;
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ==========================================
// 2. GLOBAL SECURE VALIDATION & AUTO IMAGE-TO-PDF WRAPPER
// ==========================================
export async function getValidatedPdfBytes(file: File | Blob): Promise<Uint8Array> {
  const maxLimit = getMaxFileSizeLimit();
  const MIN_FILE_SIZE = 5 * 1024; // 5 KB
  
  if (!file) {
    throw new Error("No file provided for processing.");
  }

  // Strict check: if the file is under 5 KB, reject before attempting to parse
  if (file.size < MIN_FILE_SIZE) {
    throw new Error("File is too small or empty. Please upload a valid PDF.");
  }

  if (file.size > maxLimit) {
    const limitMB = Math.round(maxLimit / (1024 * 1024));
    throw new Error(`File size exceeds the limit of ${limitMB}MB for your device.`);
  }

  const arrayBuffer = await file.arrayBuffer();

  // If the uploaded file is an Image (PNG/JPG/JPEG/WebP), automatically wrap it into a clean A4 PDF container
  if (file.type.startsWith('image/')) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    
    let embeddedImage;
    if (file.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(arrayBuffer);
    } else {
      try {
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
      } catch {
        // Fallback for WebP or non-standard JPEG formats via canvas conversion
        const pngUrl = await convertImageToPngDataUrl(file);
        const pngBytes = dataUrlToUint8Array(pngUrl);
        embeddedImage = await pdfDoc.embedPng(pngBytes);
      }
    }
    
    // Scale image cleanly to standard A4 size page dimensions (595 x 842)
    const { width, height } = embeddedImage.scaleToFit(595, 842);
    page.setSize(595, 842);
    page.drawImage(embeddedImage, {
      x: (595 - width) / 2,
      y: (842 - height) / 2,
      width,
      height,
    });
    
    return await pdfDoc.save({ useObjectStreams: true });
  }

  // If it's a regular PDF, load securely with robust streaming fallback for damaged metadata
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return await pdfDoc.save({ useObjectStreams: true });
  } catch (primaryError) {
    console.warn("Standard loading failed, attempting streaming recovery...", primaryError);
    try {
      const pdfDoc = await PDFDocument.load(arrayBuffer, { 
        ignoreEncryption: true, 
        parseSpeed: ParseSpeeds.Fast 
      });
      return await pdfDoc.save({ useObjectStreams: true });
    } catch (fallbackError) {
      throw new Error("Could not read PDF metadata. The file may be damaged or unsupported.");
    }
  }
}

/**
 * Return a validated File object with PDF MIME type, converting images if needed
 */
export async function getValidatedPdfFile(file: File): Promise<File> {
  const bytes = await getValidatedPdfBytes(file);
  const cleanBase = file.name.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '');
  const finalFilename = `${cleanBase}.pdf`;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], finalFilename, { type: 'application/pdf' });
}

// ==========================================
// 3. BRANDING & NAMING UTILITY
// ==========================================
export function getJustPDFFileName(actionType = "Processed"): string {
  const timestamp = Date.now();
  return `yourPDFworld_${actionType}_${timestamp}.pdf`;
}
export const getYourPDFWorldFileName = getJustPDFFileName;

// ==========================================
// 4. SECURITY & FILE VALIDATION
// ==========================================
export function secureValidateFile(file: File | Blob): boolean {
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const maxLimit = getMaxFileSizeLimit();
  const MIN_FILE_SIZE = 5 * 1024; // 5 KB

  if (!file) {
    throw new Error("No file provided for processing.");
  }

  // Strict check: If the file is under 5 KB, throw user-friendly error immediately
  if (file.size < MIN_FILE_SIZE) {
    throw new Error("File is too small or empty. Please upload a valid PDF.");
  }

  const isNamedAllowed =
    'name' in file &&
    typeof file.name === 'string' &&
    /\.(pdf|png|jpg|jpeg|webp)$/i.test(file.name);

  const isAllowedType =
    file.type.startsWith('image/') ||
    allowedTypes.includes(file.type) ||
    (file.type === '' && isNamedAllowed);

  if (!isAllowedType) {
    throw new Error("Security Error: Only PDF, PNG, JPEG, and WebP files are permitted.");
  }

  if (file.size > maxLimit) {
    const limitMB = Math.round(maxLimit / (1024 * 1024));
    throw new Error(`File exceeds the ${limitMB}MB safety size limit for your device.`);
  }

  return true;
}

// ==========================================
// 5. ROBUST PDF LOADER (Fixes Metadata Errors)
// ==========================================
export async function loadPdfSafely(arrayBuffer: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const byteLength = arrayBuffer instanceof Uint8Array ? arrayBuffer.byteLength : arrayBuffer.byteLength;
  const MIN_FILE_SIZE = 5 * 1024; // 5 KB

  // Strict check: Never attempt parsing with pdf-lib if under 5 KB
  if (byteLength < MIN_FILE_SIZE) {
    throw new Error("File is too small or empty. Please upload a valid PDF.");
  }

  try {
    // Attempt standard loading with encryption bypass
    return await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (primaryError) {
    console.warn("Standard PDF parsing encountered an issue, attempting streaming recovery...", primaryError);
    try {
      // Fallback mode for corrupted metadata or cross-reference table issues
      return await PDFDocument.load(arrayBuffer, { 
        ignoreEncryption: true, 
        parseSpeed: ParseSpeeds.Fast 
      });
    } catch (fallbackError) {
      throw new Error("Could not read PDF metadata. The file may be damaged or unsupported.");
    }
  }
}

// ==========================================
// 6. ADVANCED OCR PRE-PROCESSING & WORKER
// ==========================================
export async function preprocessImageForOCR(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processCanvas = (sourceCanvas: HTMLCanvasElement | HTMLImageElement) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof imageSource === 'string' ? imageSource : '');
          return;
        }

        const width = 'naturalWidth' in sourceCanvas ? sourceCanvas.naturalWidth || sourceCanvas.width : sourceCanvas.width;
        const height = 'naturalHeight' in sourceCanvas ? sourceCanvas.naturalHeight || sourceCanvas.height : sourceCanvas.height;

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // High-contrast binarization and grayscale for superior OCR accuracy
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
          const threshold = 150; // Dynamic contrast threshold
          const val = avg < threshold ? 0 : 255;

          data[i] = val;     // Red
          data[i + 1] = val; // Green
          data[i + 2] = val; // Blue
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processCanvas(img);
      img.onerror = () => reject(new Error('Failed to load image for OCR pre-processing'));
      img.src = imageSource;
    } else {
      processCanvas(imageSource);
    }
  });
}

export async function runOptimizedOCR(
  imageElement: HTMLImageElement | HTMLCanvasElement | string
): Promise<string> {
  const processedUrl = await preprocessImageForOCR(imageElement);
  const worker = await createWorker('eng');

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });

  const result = await worker.recognize(processedUrl);
  await worker.terminate();
  return result.data.text;
}

// ==========================================
// 7. SECURE WATERMARK, DRAWING & ANNOTATION PROCESSOR
// ==========================================
export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: DrawingPoint[];
  thickness?: number;
  color?: { r?: number; g?: number; b?: number };
}

export interface JustPDFProcessorOptions {
  watermarkText?: string;
  drawings?: DrawingPath[];
}

export async function applyJustPDFProcessors(
  pdfArrayBuffer: ArrayBuffer | Uint8Array,
  options: JustPDFProcessorOptions = {}
): Promise<Uint8Array> {
  const rawText = options.watermarkText || "yourPDFworld SECURE";
  const watermarkText = rawText.replace(/[<>]/g, ""); 
  const drawings = options.drawings || [];

  const pdfDoc = await loadPdfSafely(pdfArrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Apply Watermark
    if (watermarkText) {
      const fontSize = 42;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      
      page.drawText(watermarkText, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font: font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.25,
        rotate: degrees(45),
      });
    }

    // Apply Freehand Drawings / Annotations
    if (Array.isArray(drawings)) {
      drawings.forEach(path => {
        if (!path.points || path.points.length < 2) return;
        
        for (let j = 0; j < path.points.length - 1; j++) {
          const p1 = path.points[j];
          const p2 = path.points[j + 1];
          
          page.drawLine({
            start: { x: p1.x, y: height - p1.y },
            end: { x: p2.x, y: height - p2.y },
            thickness: Number(path.thickness) || 2,
            color: rgb(
              Number(path.color?.r) || 0, 
              Number(path.color?.g) || 0, 
              Number(path.color?.b) || 0
            ),
          });
        }
      });
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}
