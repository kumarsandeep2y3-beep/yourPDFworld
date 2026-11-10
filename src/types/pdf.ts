export type ToolMode =
  | 'dashboard'
  | 'merge'
  | 'split'
  | 'compress'
  | 'edit'
  | 'batch'
  | 'convert'
  | 'rotate'
  | 'organize'
  | 'annotate'
  | 'watermark'
  | 'ocr'
  | 'security'
  | 'pagenumber'
  | 'info'
  | 'view';

export interface SecurityOptions {
  userPassword: string;
  ownerPassword?: string;
  algorithm: 'AES-256' | 'RC4';
  allowPrinting: boolean;
  allowHighQualityPrint: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
  allowAnnotating: boolean;
  allowFillingForms: boolean;
  allowAssembly: boolean;
}

export type AnnotationToolType =
  | 'select'
  | 'highlight'
  | 'text'
  | 'pen'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'underline'
  | 'strikethrough'
  | 'eraser';

export interface BaseAnnotation {
  id: string;
  pageIndex: number;
  type: AnnotationToolType;
  color: string;
  opacity: number;
  strokeWidth: number;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlight';
  points: { x: number; y: number }[];
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'circle' | 'arrow' | 'line' | 'underline' | 'strikethrough';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  fillColor?: string;
  fillOpacity?: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bgColor?: string;
}

export type AnnotationItem = FreehandAnnotation | ShapeAnnotation | TextAnnotation;

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  thumbnailUrl?: string;
  pageThumbnails?: string[];
  pageRange?: string;
}

export interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  deleted: boolean;
  thumbnailUrl?: string;
}

export type CompressionLevel = 'recommended' | 'extreme' | 'low' | 'target';

export interface CompressionOptions {
  level: CompressionLevel;
  quality: number; // 0.1 to 1.0
  targetDpi: number; // e.g. 96, 130, 200
  grayscale: boolean;
  targetSizeBytes?: number;
}

export interface WatermarkOptions {
  type: 'text' | 'image';
  text: string;
  imageFile?: File;
  imageDataUrl?: string;
  imageScale?: number; // 0.1 to 2.0
  opacity: number; // 0.1 to 1.0
  fontSize: number;
  rotation: number; // -90 to 90
  color: string; // hex #rrggbb
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left';

export type PageNumberFont =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Times-Roman'
  | 'Times-Bold'
  | 'Courier'
  | 'Courier-Bold';

export type PageNumberFormat =
  | 'numbers-only'
  | 'page-x'
  | 'page-x-of-y'
  | 'x-of-y'
  | 'hyphenated'
  | 'custom';

export interface PageNumberConfig {
  position: PageNumberPosition;
  font: PageNumberFont;
  fontSize: number;
  color: string; // hex
  opacity: number;
  format: PageNumberFormat;
  startNumber: number; // number printed on first numbered page, e.g. 1
  firstPageToNumber: number; // 1-based index of document page to begin on (e.g. 2 to skip cover)
  lastPageToNumber?: number; // 1-based index of document page to end on
  marginHorizontal: number; // in pt
  marginVertical: number; // in pt
  customPrefix?: string;
  customSuffix?: string;
}

export interface PageNumberOptions {
  enabled: boolean;
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-center' | 'top-left';
  format: 'page-x' | 'page-x-of-y' | 'numbers-only' | 'x-of-y' | 'hyphenated' | 'custom';
  startFrom: number;
  fontSize: number;
}

export interface PageGeometryInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  widthIn: number;
  heightIn: number;
  orientation: 'Portrait' | 'Landscape' | 'Square';
  standardPaper: string;
  rotation: number;
  mediaBox: { x: number; y: number; width: number; height: number };
  cropBox?: { x: number; y: number; width: number; height: number };
}

export interface PdfDocumentInfo {
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  mimeType: string;
  pdfVersion: string;
  pageCount: number;
  isLinearized: boolean;
  isEncrypted: boolean;
  encryptionAlgorithm: string;
  hasForms: boolean;
  formFieldsCount: number;
  hasOutline: boolean;
  outlineCount: number;
  attachmentsCount: number;
  // Metadata properties
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string[];
  creator: string | null;
  producer: string | null;
  creationDate: Date | null;
  creationDateFormatted: string;
  modificationDate: Date | null;
  modificationDateFormatted: string;
  trapped: string | null;
  // Page Geometry
  pages: PageGeometryInfo[];
  pageSummary: string;
  isUniformSize: boolean;
  primaryPaper: string;
  // Security & Permissions
  permissions: {
    printing: 'Full High Resolution' | 'Low Resolution (150 DPI)' | 'Disallowed';
    copying: boolean;
    modifying: boolean;
    annotating: boolean;
    formFilling: boolean;
    accessibility: boolean;
    assembly: boolean;
  };
  rawMetadata?: Record<string, any>;
  xmpRaw?: string | null;
}

// Batch Processing Types
export type BatchActionType = 'compress' | 'rotate' | 'watermark' | 'pagenumber';
export type BatchItemStatus = 'waiting' | 'processing' | 'done' | 'error';

export interface BatchQueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  status: BatchItemStatus;
  progress: number;
  resultBytes?: Uint8Array;
  resultFilename?: string;
  compressedSize?: number;
  reductionPercent?: number;
  durationMs?: number;
  errorMessage?: string;
}

export interface BatchRenameConfig {
  enabled: boolean;
  prefix: string;
  suffix: string;
  numbering: 'none' | '1' | '01' | '001';
  includeDate: boolean;
  replaceSpacesWithUnderscore: boolean;
  lowercase: boolean;
}

export interface BatchActionConfig {
  action: BatchActionType;
  // Compress options
  compressionLevel: 'recommended' | 'extreme' | 'low';
  // Rotate options
  rotationAngle: 90 | 180 | 270;
  // Watermark options
  watermarkText: string;
  watermarkOpacity: number;
  // Page number options
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'top-right';
  // Auto-rename options
  rename: BatchRenameConfig;
}

// Text Editing Types
export interface TextReplacementItem {
  id: string;
  pageIndex: number; // 0-based
  findText: string;
  replaceText: string;
  // Bounding rect in PDF points
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Times-Bold' | 'Courier' | 'Courier-Bold';
  textColor: string; // hex
  fillColor?: string; // background cover, default white
}

// Performance Analytics Telemetry
export interface PerformanceTelemetry {
  taskId: string;
  taskName: string;
  isActive: boolean;
  phase: string;
  elapsedMs: number;
  pagesProcessed: number;
  totalPages: number;
  memoryMb?: number;
  throughputPagesPerSec: number;
}

