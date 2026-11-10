import React, { useState, useEffect, useRef } from 'react';
import {
  Highlighter,
  Type,
  PenTool,
  Square,
  Circle,
  MoveRight,
  Minus,
  Underline,
  Strikethrough,
  Eraser,
  Undo2,
  Trash2,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Palette,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { AnnotationToolType, AnnotationItem } from '../types/pdf';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';
import { exportAnnotatedPdf, downloadBytes, formatBytes } from '../utils/pdfEngine';

interface AnnotateToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

const COLOR_PALETTE = [
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Slate', hex: '#1e293b' },
];

export const AnnotateTool: React.FC<AnnotateToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-based
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);

  // Active tool settings
  const [activeTool, setActiveTool] = useState<AnnotationToolType>('highlight');
  const [activeColor, setActiveColor] = useState<string>('#eab308');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [opacity, setOpacity] = useState<number>(0.4);

  // Store annotations per page index
  const [annotations, setAnnotations] = useState<{ [pageIndex: number]: AnnotationItem[] }>({});
  const [history, setHistory] = useState<{ [pageIndex: number]: AnnotationItem[][] }>({});

  // Interaction drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Text comment input modal/popover state
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedBytes, setExportedBytes] = useState<Uint8Array | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF metadata
  useEffect(() => {
    if (!file) {
      setPageImageUrl(null);
      setAnnotations({});
      setTotalPages(1);
      setCurrentPage(0);
      setExportedBytes(null);
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        if (!isMounted) return;
        setTotalPages(count);
        setCurrentPage(0);
      } catch (err) {
        console.error('Failed to load PDF for annotation:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Render current page background image
  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    const render = async () => {
      try {
        const img = await renderPdfPageToDataUrl(file, currentPage + 1, 1.4 * zoomScale);
        if (isMounted) {
          setPageImageUrl(img);
        }
      } catch (err) {
        console.error('Failed to render page image:', err);
      }
    };

    render();

    return () => {
      isMounted = false;
    };
  }, [file, currentPage, zoomScale]);

  // Redraw canvas overlay whenever annotations or live drawing changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageItems = annotations[currentPage] || [];

    // Render committed items
    for (const item of pageItems) {
      drawSingleAnnotation(ctx, item);
    }

    // Render in-progress item
    if (isDrawing) {
      ctx.save();
      if (activeTool === 'pen' || activeTool === 'highlight') {
        if (currentPoints.length > 1) {
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = activeTool === 'highlight' ? strokeWidth * 2.5 : strokeWidth;
          ctx.globalAlpha = activeTool === 'highlight' ? Math.min(opacity, 0.45) : 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (activeTool === 'highlight') ctx.globalCompositeOperation = 'multiply';

          ctx.beginPath();
          ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
          for (let p = 1; p < currentPoints.length; p++) {
            ctx.lineTo(currentPoints[p].x, currentPoints[p].y);
          }
          ctx.stroke();
        }
      } else if (dragStart && dragCurrent) {
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = strokeWidth;
        ctx.globalAlpha = opacity;
        ctx.lineCap = 'round';

        if (activeTool === 'rectangle') {
          const rx = Math.min(dragStart.x, dragCurrent.x);
          const ry = Math.min(dragStart.y, dragCurrent.y);
          const rw = Math.abs(dragCurrent.x - dragStart.x);
          const rh = Math.abs(dragCurrent.y - dragStart.y);
          ctx.fillStyle = activeColor;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.globalAlpha = 1;
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (activeTool === 'circle') {
          const cx = (dragStart.x + dragCurrent.x) / 2;
          const cy = (dragStart.y + dragCurrent.y) / 2;
          const rx = Math.abs(dragCurrent.x - dragStart.x) / 2;
          const ry = Math.abs(dragCurrent.y - dragStart.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (activeTool === 'arrow' || activeTool === 'line') {
          ctx.beginPath();
          ctx.moveTo(dragStart.x, dragStart.y);
          ctx.lineTo(dragCurrent.x, dragCurrent.y);
          ctx.stroke();

          if (activeTool === 'arrow') {
            const headlen = 12;
            const dx = dragCurrent.x - dragStart.x;
            const dy = dragCurrent.y - dragStart.y;
            const angle = Math.atan2(dy, dx);
            ctx.fillStyle = activeColor;
            ctx.beginPath();
            ctx.moveTo(dragCurrent.x, dragCurrent.y);
            ctx.lineTo(
              dragCurrent.x - headlen * Math.cos(angle - Math.PI / 6),
              dragCurrent.y - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              dragCurrent.x - headlen * Math.cos(angle + Math.PI / 6),
              dragCurrent.y - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
        } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
          const startX = Math.min(dragStart.x, dragCurrent.x);
          const endX = Math.max(dragStart.x, dragCurrent.x);
          const y = activeTool === 'underline'
            ? Math.max(dragStart.y, dragCurrent.y)
            : (dragStart.y + dragCurrent.y) / 2;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }, [annotations, currentPage, isDrawing, currentPoints, dragStart, dragCurrent, activeTool, activeColor, strokeWidth, opacity]);

  const drawSingleAnnotation = (ctx: CanvasRenderingContext2D, item: AnnotationItem) => {
    ctx.save();
    if (item.type === 'pen' || item.type === 'highlight') {
      const freehand = item as any;
      if (freehand.points && freehand.points.length > 1) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.strokeWidth;
        ctx.globalAlpha = item.type === 'highlight' ? Math.min(item.opacity || 0.4, 0.45) : (item.opacity ?? 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (item.type === 'highlight') ctx.globalCompositeOperation = 'multiply';

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
        ctx.globalAlpha = 0.2;
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
        const headlen = 12;
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
      ctx.font = `${textItem.fontSize || 13}px 'Plus Jakarta Sans', system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      const pad = 6;
      const textMetrics = ctx.measureText(textItem.text || '');
      const boxW = textMetrics.width + pad * 2;
      const boxH = (textItem.fontSize || 13) + pad * 2;

      ctx.fillStyle = textItem.bgColor || 'rgba(254, 240, 138, 0.95)';
      ctx.beginPath();
      ctx.roundRect(textItem.x, textItem.y, boxW, boxH, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(202, 138, 4, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = item.color || '#1e293b';
      ctx.globalAlpha = 1;
      ctx.fillText(textItem.text, textItem.x + pad, textItem.y + pad);
    }
    ctx.restore();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (activeTool === 'eraser') {
      // Find and remove clicked annotation
      const currentList = annotations[currentPage] || [];
      const updated = currentList.filter((item) => {
        if (item.type === 'text') {
          const t = item as any;
          return !(Math.abs(t.x - coords.x) < 40 && Math.abs(t.y - coords.y) < 20);
        }
        return true;
      });
      commitAnnotations(updated);
      return;
    }

    if (activeTool === 'text') {
      setTextInputPos(coords);
      setCommentText('');
      return;
    }

    setIsDrawing(true);

    if (activeTool === 'pen' || activeTool === 'highlight') {
      setCurrentPoints([coords]);
    } else {
      setDragStart(coords);
      setDragCurrent(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'pen' || activeTool === 'highlight') {
      setCurrentPoints((prev) => [...prev, coords]);
    } else {
      setDragCurrent(coords);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    let newAnnotation: AnnotationItem | null = null;

    if (activeTool === 'pen' || activeTool === 'highlight') {
      if (currentPoints.length > 1) {
        newAnnotation = {
          id: Math.random().toString(36).substring(2, 9),
          pageIndex: currentPage,
          type: activeTool,
          color: activeColor,
          opacity: activeTool === 'highlight' ? Math.min(opacity, 0.45) : opacity,
          strokeWidth: activeTool === 'highlight' ? strokeWidth * 2.5 : strokeWidth,
          points: currentPoints,
        };
      }
    } else if (dragStart && dragCurrent) {
      const dist = Math.hypot(dragCurrent.x - dragStart.x, dragCurrent.y - dragStart.y);
      if (dist > 3) {
        newAnnotation = {
          id: Math.random().toString(36).substring(2, 9),
          pageIndex: currentPage,
          type: activeTool as any,
          color: activeColor,
          opacity,
          strokeWidth,
          startX: dragStart.x,
          startY: dragStart.y,
          endX: dragCurrent.x,
          endY: dragCurrent.y,
        };
      }
    }

    if (newAnnotation) {
      const currentList = annotations[currentPage] || [];
      commitAnnotations([...currentList, newAnnotation]);
    }

    setCurrentPoints([]);
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleAddTextComment = () => {
    if (!textInputPos || !commentText.trim()) {
      setTextInputPos(null);
      return;
    }

    const newAnnotation: AnnotationItem = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: currentPage,
      type: 'text',
      x: textInputPos.x,
      y: textInputPos.y,
      text: commentText.trim(),
      fontSize: 13,
      color: activeColor === '#eab308' ? '#1e293b' : activeColor,
      opacity: 1,
      strokeWidth: 1,
      bgColor: 'rgba(254, 240, 138, 0.95)',
    };

    const currentList = annotations[currentPage] || [];
    commitAnnotations([...currentList, newAnnotation]);
    setTextInputPos(null);
    setCommentText('');
  };

  const commitAnnotations = (newList: AnnotationItem[]) => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: newList,
    }));

    // Record history for undo
    setHistory((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), newList],
    }));
  };

  const handleUndo = () => {
    const pageHistory = history[currentPage] || [];
    if (pageHistory.length <= 1) {
      setAnnotations((prev) => ({ ...prev, [currentPage]: [] }));
      setHistory((prev) => ({ ...prev, [currentPage]: [] }));
    } else {
      const newHistory = [...pageHistory];
      newHistory.pop(); // Remove current state
      const previousState = newHistory[newHistory.length - 1];
      setAnnotations((prev) => ({ ...prev, [currentPage]: previousState }));
      setHistory((prev) => ({ ...prev, [currentPage]: newHistory }));
    }
  };

  const handleClearPage = () => {
    commitAnnotations([]);
  };

  const handleExport = async () => {
    if (!file) return;
    setIsExporting(true);
    setExportProgress(15);

    try {
      const bytes = await exportAnnotatedPdf(file, annotations, (p) =>
        setExportProgress(p)
      );
      const cleanName = `${file.name.replace(/\.pdf$/i, '')}_annotated.pdf`;
      setExportedBytes(bytes);
      downloadBytes(bytes, cleanName);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || 'Failed to export annotated PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Highlight, Draw & Annotate PDFs Online
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Markup text, add sticky comments, freehand draw, underline, and draw arrows and shapes directly in your browser.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => setFile(files[0])}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to annotate and markup"
          subtitle="Highlight important paragraphs, insert text notes, add arrows, rectangles, and draw freehand."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top File & Page Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Highlighter className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {formatBytes(file.size)} · {totalPages} pages
            </p>
          </div>
        </div>

        {/* Page navigation & Zoom */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          <button
            onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => setZoomScale((z) => Math.min(2.0, z + 0.2))}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Change file & Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFile(null)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Change File
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-sm hover:shadow transition-all flex items-center gap-1.5"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Exporting ({exportProgress}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Annotated PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating / Sticky Annotation Studio Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Tool selectors */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'highlight', label: 'Highlight', icon: Highlighter },
            { id: 'text', label: 'Text Note', icon: Type },
            { id: 'pen', label: 'Freehand Draw', icon: PenTool },
            { id: 'rectangle', label: 'Rectangle', icon: Square },
            { id: 'circle', label: 'Circle', icon: Circle },
            { id: 'arrow', label: 'Arrow', icon: MoveRight },
            { id: 'line', label: 'Line', icon: Minus },
            { id: 'underline', label: 'Underline', icon: Underline },
            { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough },
            { id: 'eraser', label: 'Eraser', icon: Eraser },
          ].map((tool) => {
            const IconComponent = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as AnnotationToolType)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={tool.label}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tool.label}</span>
              </button>
            );
          })}
        </div>

        {/* Color Palette & Stroke Controls */}
        <div className="flex items-center gap-3">
          {/* Color picks */}
          <div className="flex items-center gap-1.5">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                onClick={() => setActiveColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`w-5 h-5 rounded-full transition-transform ${
                  activeColor === c.hex ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-80 hover:opacity-100'
                }`}
                title={c.name}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Stroke Width */}
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
            className="px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value={2}>Thin (2px)</option>
            <option value={4}>Regular (4px)</option>
            <option value={8}>Thick (8px)</option>
            <option value={14}>Marker (14px)</option>
          </select>

          {/* Undo & Clear */}
          <button
            onClick={handleUndo}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearPage}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
            title="Clear Page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Annotation Viewport */}
      <div
        ref={containerRef}
        className="relative bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-8 flex items-center justify-center min-h-[600px] overflow-auto select-none"
      >
        {pageImageUrl ? (
          <div className="relative shadow-2xl bg-white border border-slate-300 dark:border-slate-800 rounded-xs">
            {/* Background PDF Page Image */}
            <img
              src={pageImageUrl}
              alt={`Page ${currentPage + 1}`}
              className="block max-w-full h-auto pointer-events-none select-none"
            />

            {/* Overlaid Transparent Drawing Canvas */}
            <canvas
              ref={canvasRef}
              width={pageImageUrl ? 595 * 1.4 * zoomScale : 800}
              height={pageImageUrl ? 842 * 1.4 * zoomScale : 1100}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`absolute inset-0 w-full h-full ${
                activeTool === 'eraser'
                  ? 'cursor-pointer'
                  : activeTool === 'text'
                  ? 'cursor-text'
                  : 'cursor-crosshair'
              }`}
            />

            {/* Interactive Inline Text Note Creator */}
            {textInputPos && (
              <div
                className="absolute z-20 bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2 w-64"
                style={{
                  left: `${(textInputPos.x / (595 * 1.4 * zoomScale)) * 100}%`,
                  top: `${(textInputPos.y / (842 * 1.4 * zoomScale)) * 100}%`,
                }}
              >
                <textarea
                  autoFocus
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type note / comment..."
                  className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setTextInputPos(null)}
                    className="px-2 py-1 text-[11px] rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTextComment}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Rendering page for annotation...</span>
          </div>
        )}
      </div>

      {/* Export Result confirmation */}
      {exportedBytes && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Annotated document exported successfully!</span>
          </div>

          <button
            onClick={() =>
              onPreviewPdf(
                undefined,
                exportedBytes,
                `${file.name.replace(/\.pdf$/i, '')}_annotated.pdf`
              )
            }
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Result</span>
          </button>
        </div>
      )}
    </div>
  );
};
