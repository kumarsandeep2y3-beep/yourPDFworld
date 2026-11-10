# PaperPlane PDF - Suite Expansion Plan: Text Editor, Batch Queue, Performance Analytics & System Theme

Comprehensive implementation blueprint introducing in-document text modification, multi-file batch execution with per-item progress, a non-intrusive client-side performance HUD, and seamless OS system theme synchronization.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying questions were dismissed, so we have adopted the recommended defaults:
> - **Edit Text Mode**: Hybrid approach offering both search-and-replace text updates across pages and visual click-to-edit overlays on rendered canvas previews.
> - **Performance Analytics HUD**: A collapsible floating telemetry pill in the bottom-right corner that automatically activates during heavy operations (compression, batch processing, OCR, rendering) showing elapsed time, memory footprint (`performance.memory`), throughput (pages/sec), and processing state.
> - **Theme Mode**: A modern three-state selector (`Light` | `Dark` | `System Auto`) with real-time `matchMedia` change listening so OS theme switches propagate instantly.
> - **Batch Queue Actions**: Supports **Batch Compress**, **Batch Rotate**, **Batch Watermark**, and **Batch Page Numbering**, with per-file progress bars and 1-click "Download All (.ZIP)" or individual download triggers.

---

## 1. Overview & Core Concept

PaperPlane PDF is a private, client-side document workstation. This update expands its utility with four core capabilities:

1. **'Edit Text' Tool (`EditTextTool.tsx`)**:
   - Enables users to perform targeted text modifications in existing PDFs without converting to Word.
   - Text replacement mechanism: Uses PDF.js text layer mapping to detect text coordinates, covers the original target text using a precise background-matched or clean whiteout bounding rect, and draws the replacement text using matching standard fonts (`Helvetica`, `Times-Roman`, `Courier`) with adjustable font size, tracking, and color via `pdf-lib`.
   - Offers both **Global Find & Replace** (replace occurrences across all or selected pages) and **Visual Page Click & Edit** (click any line on the canvas to edit text in place).

2. **Batch Processing Queue Tool (`BatchTool.tsx`)**:
   - Multi-file drag-and-drop queue supporting 2 to 50+ PDF documents simultaneously.
   - Central action selector:
     - **Batch Compression**: Choose between Recommended, Extreme, Lossless, or Target Size presets.
     - **Batch Rotation**: Rotate all pages in all files by 90° clockwise, 180°, or 90° counter-clockwise.
     - **Batch Watermarking**: Apply uniform text stamp (e.g. "CONFIDENTIAL", "DRAFT", or custom branding) across all documents.
     - **Batch Page Numbering**: Add standardized headers or footers to all documents.
   - Granular progress: Every file card displays individual status (`Waiting`, `Processing... %`, `Complete`, `Error`), time taken, before/after file sizes, and an individual download button.
   - Batch Export: Generates a single `.zip` archive via `JSZip` containing all processed PDFs, plus a "Download All" option.

3. **Real-Time Performance Analytics Overlay (`PerformanceOverlay.tsx`)**:
   - A sleek, floating HUD that appears when intensive processing begins and can be docked or collapsed into a quiet badge.
   - Live metrics:
     - **Memory Footprint**: Heap allocation (`usedJSHeapSize` / `totalJSHeapSize` in MB) via Chromium `performance.memory` API, with fallback heap estimation.
     - **Processing Speed & Throughput**: Milliseconds elapsed, average milliseconds per page, and throughput rate (pages/sec).
     - **Task Phases**: Visual pipeline indicators (e.g. `Decompressing` → `Rasterizing` → `Encoding` → `Packaging`).
     - **Privacy Guarantee**: Reassuring badge indicating 0 bytes transmitted over the network.

4. **OS-Level System Theme Sync (`Header.tsx`, `App.tsx`)**:
   - Upgrades the theme toggle to support 3 distinct postures: `Light`, `Dark`, and `Auto (System)`.
   - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` event listeners for live dynamic updates when the user's OS changes between day and night mode.
   - Stores preference in `localStorage.getItem('paperplane_theme_mode')`.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Color Discipline**: Strict adherence to PaperPlane's dark slate `#020617` and crisp `#ffffff` canvas, with indigo-600 `#4f46e5` accent buttons and emerald `#10b981` progress indicators.
- **Single-Elevation Depth**: Flat containers with subtle hairline borders (`border-slate-200 dark:border-slate-800`), avoiding nested card sandwiches.
- **Tabular Figures**: Monospace numerals (`tabular-nums font-mono`) for progress percentages, byte sizes, and timing counters.
- **Zero-Pill Restraint**: Metadata rendered with clean typographical dividers (`·` and `/`), reserving pills strictly for active interactive controls.

### User Flows

#### Flow 1: Edit Text in PDF
1. User drops PDF or clicks "Try Sample Docs".
2. Left pane displays page navigation thumbnails and Find & Replace controls; center viewport renders interactive page preview.
3. User enters target text to find (e.g. "DocuFlow") and replacement text (e.g. "Acme Corp"). Matches are highlighted on the preview.
4. User clicks "Apply Text Replacements" or clicks a specific text line to edit locally.
5. `pdf-lib` computes text bounds, draws background masking, embeds replacement font glyphs, and compiles updated PDF.
6. User previews the modified page and downloads the revised PDF.

#### Flow 2: Batch Processing
1. User navigates to "Batch Queue" tab.
2. User drops 5 files (e.g., invoices or reports).
3. User selects action: "Compress (Recommended 70%)" and clicks "Start Batch Processing".
4. The queue executes sequentially (or in controlled 2-concurrency chunks to prevent UI freeze), updating each file's progress bar in real time.
5. The Performance Analytics HUD slides in showing live throughput (e.g. `14.2 pages/sec`, `180ms/file`, `42 MB Heap`).
6. Upon completion, user clicks "Download All (.ZIP)" or saves individual files.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale |
| :--- | :--- | :--- |
| **PDF Text Replacement** | Bounding box redaction + vector text overdraw | Native PDF streams do not support reflowing like HTML; whiteout + font overdraw preserves exact page layouts without font corruption or page re-rasterization. |
| **Batch Archive Export** | In-memory `JSZip` stream to `.zip` download | Users processing multiple files prefer downloading a single bundle rather than triggering 10 browser download prompts. |
| **Performance Analytics HUD** | Ambient floating overlay with auto-hide & collapse | Avoids cluttering the primary editing surface while providing transparent, trustworthy telemetry during long operations. |
| **Theme Sync** | 3-state setting (`Light`, `Dark`, `System`) | Meets power-user expectations of seamless day/night transitions while retaining manual override control. |

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PaperPlane PDF UI                             │
├───────────────────┬───────────────────┬────────────────────────────────┤
│  Top Navigation   │  Workspace Tabs   │       System Theme Sync        │
│  (Header.tsx)     │  13 Tool Modes    │  (Light / Dark / Auto-System)  │
└─────────┬─────────┴─────────┬─────────┴───────────────┬────────────────┘
          │                   │                         │
          ▼                   ▼                         ▼
┌───────────────────┐ ┌───────────────────┐   ┌──────────────────────────┐
│  EditTextTool     │ │   BatchTool       │   │  PerformanceOverlay      │
│  - Text layer map │ │  - Multi-dropzone │   │  - Heap memory prober    │
│  - Find & replace │ │  - Action router  │   │  - Elapsed timer / throughput
│  - Redact & draw  │ │  - JSZip packager │   │  - Dockable HUD pill     │
└─────────┬─────────┘ └─────────┬─────────┘   └─────────────┬────────────┘
          │                     │                           │
          ▼                     ▼                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Client-Side Processing Engine                        │
│   • pdf-lib (Vector modification, font embedding, page transformations)│
│   • pdfjs-dist (Text layer extraction, canvas rasterization)           │
│   • Performance API (window.performance.now, performance.memory)       │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & State Plan
1. **`src/types/pdf.ts`**:
   - Add `'edit'` and `'batch'` to `ToolMode`.
   - Define `BatchActionType` (`compress`, `rotate`, `watermark`, `pagenumber`).
   - Define `BatchQueueItem` (file, id, status, progress, resultBytes, sizeBefore, sizeAfter, error).
   - Define `PerformanceMetric` (taskName, isRunning, elapsedMs, pagesProcessed, totalPages, memoryMb).
2. **`src/utils/performanceMonitor.ts`**:
   - Global event emitter/hook for tracking live memory, page latency, and throughput during tasks.
3. **`src/utils/pdfTextEditor.ts`**:
   - Search text occurrences in PDF using `pdfjsLib.getTextContent()`.
   - Calculate bounding boxes in PDF points.
   - Apply background whiteout patch and draw text with `pdf-lib`.
4. **`src/components/PerformanceOverlay.tsx`**:
   - Real-time HUD displaying active task telemetry, memory usage, and throughput.
5. **`src/components/EditTextTool.tsx`**:
   - Search/replace form, page thumbnail viewer, interactive text editor canvas, and export button.
6. **`src/components/BatchTool.tsx`**:
   - Multi-file queue table with individual progress bars, bulk controls, and ZIP download.
7. **`src/components/Header.tsx` & `src/App.tsx`**:
   - Three-way theme toggle (`Light`, `Dark`, `System`), wiring new tools into navigation and workspace.

---

## 5. Hotfix: Minimum File Size Validation, Graceful Loading Fallback & Merge Output

### Implemented Fixes:
1. **Size Check (< 5 KB)**:
   - Added strict threshold check (`MIN_FILE_SIZE = 5 * 1024` / 5120 bytes) in `secureValidateFile`, `getValidatedPdfBytes`, `loadPdfSafely`, `compressPdf`, `mergePdfs`, `Dropzone`, `CompressTool`, `MergeTool`, and `BatchTool`.
   - Before attempting to parse with `pdf-lib`, if a file is under 5 KB, it triggers the user-friendly alert: `"File is too small or empty. Please upload a valid PDF."` and aborts immediately.
2. **Graceful Fallback**:
   - When `PDFDocument.load()` or metadata reading fails, the UI does not crash or get stuck with a broken preview.
   - Faulty files are automatically cleared from the preview list/queue (`handleClearFile()`, `removeItem()`), allowing the user to seamlessly try another file.
3. **Merge PDF Output Fix**:
   - Ensured `mergePdfs` strictly awaits saving the array buffer (`await mergedDoc.save({ useObjectStreams: true })`) and validates non-zero page count and non-empty byte buffer.
   - Updated `downloadBytes` to extract a clean byte slice into a dedicated `Uint8Array` copy before Blob generation, preventing truncated/empty 2KB files.
