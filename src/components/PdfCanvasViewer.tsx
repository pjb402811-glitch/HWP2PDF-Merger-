import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Maximize2,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  blob: Blob;
  fileName?: string;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  containerWidth: number;
  fitWidth: boolean;
  onVisible: (pageNum: number) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  rotation,
  containerWidth,
  fitWidth,
  onVisible,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isInView, setIsInView] = useState(pageNumber <= 3);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (entry.intersectionRatio >= 0.35) {
              onVisible(pageNumber);
            }
          }
        }
      },
      { rootMargin: '350px 0px', threshold: [0.05, 0.35, 0.7] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!isInView) return;

    let cancelled = false;
    let activeRenderTask: pdfjsLib.RenderTask | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const targetWidth = Math.max(280, containerWidth - 48);
        const effectiveScale = fitWidth
          ? Math.min(2.2, Math.max(0.4, targetWidth / baseViewport.width))
          : scale;

        const viewport = page.getViewport({ scale: effectiveScale, rotation });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        activeRenderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        });

        await activeRenderTask.promise;
        if (!cancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`PDF 페이지 ${pageNumber} 렌더링 실패:`, err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // Ignore cancel error
        }
      }
    };
  }, [pdfDoc, pageNumber, scale, rotation, containerWidth, fitWidth, isInView]);

  return (
    <div
      ref={wrapperRef}
      data-pdf-page={pageNumber}
      className="flex flex-col items-center gap-1.5"
    >
      <div
        className="relative bg-white shadow-md border border-slate-300/80 rounded-sm overflow-hidden"
        style={{
          minWidth: Math.floor(pageDimensions.width),
          minHeight: Math.floor(pageDimensions.height),
        }}
      >
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-slate-400 text-xs gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>{pageNumber}페이지 불러오는 중...</span>
          </div>
        )}
        <canvas ref={canvasRef} className="block" />
      </div>
      <span className="text-[11px] font-medium text-slate-500">
        {pageNumber} 페이지
      </span>
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ blob, fileName }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(760);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Measure container width for responsive fit-width scaling
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF bytes directly from Blob (bypasses browser iframe/plugin restrictions)
  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      setPdfDoc(null);
      setCurrentPage(1);

      try {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
        });
        loadedDoc = await loadingTask.promise;
        if (cancelled) {
          await loadedDoc.cleanup();
          await loadingTask.destroy();
          return;
        }

        setPdfDoc(loadedDoc);
        setNumPages(loadedDoc.numPages);
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF 뷰어 로드 실패:', err);
          setErrorMsg(err?.message || 'PDF 문서를 미리보기로 렌더링할 수 없습니다.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.cleanup().catch(() => {});
      }
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [blob]);

  const handleVisible = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
  }, []);

  const scrollToPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(numPages, targetPage));
    setCurrentPage(clamped);
    const el = scrollContainerRef.current?.querySelector(`[data-pdf-page="${clamped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleZoomOut = () => {
    setFitWidth(false);
    setScale((prev) => Math.max(0.5, Number((prev - 0.15).toFixed(2))));
  };

  const handleZoomIn = () => {
    setFitWidth(false);
    setScale((prev) => Math.min(2.4, Number((prev + 0.15).toFixed(2))));
  };

  const handleFitWidth = () => {
    setFitWidth(true);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-200/80 min-h-0">
      {/* Viewer Toolbar */}
      <div className="px-3 sm:px-4 py-2 bg-slate-800 text-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={currentPage <= 1 || numPages === 0}
            title="이전 페이지"
            className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 py-0.5 bg-slate-700/80 rounded font-medium tabular-nums">
            {numPages > 0 ? `${currentPage} / ${numPages}` : '- / -'}
          </span>
          <button
            type="button"
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={currentPage >= numPages || numPages === 0}
            title="다음 페이지"
            className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {fileName && (
            <span className="hidden sm:inline text-slate-400 truncate max-w-[200px] ml-2">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            title="축소"
            className="p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-[11px] font-medium text-slate-200 min-w-[58px] text-center">
            {fitWidth ? '너비 맞춤' : `${Math.round(scale * 100)}%`}
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="확대"
            className="p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitWidth}
            title="화면에 맞춤"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              fitWidth
                ? 'bg-sky-600 text-white'
                : 'hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            맞춤
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button
            type="button"
            onClick={handleRotate}
            title="90도 회전"
            className="p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable PDF Pages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 min-h-0"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2.5 text-slate-600 text-xs">
            <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
            <span className="font-medium">PDF 미리보기를 렌더링하고 있습니다...</span>
          </div>
        ) : errorMsg ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-rose-600 text-xs p-6 text-center">
            <AlertCircle className="w-8 h-8" />
            <p className="font-semibold">{errorMsg}</p>
            <p className="text-slate-500">우측 상단의 다운로드 버튼을 통해 PDF 파일을 직접 저장하실 수 있습니다.</p>
          </div>
        ) : pdfDoc ? (
          <div className="flex flex-col items-center gap-5 pb-6">
            {Array.from({ length: numPages }, (_, idx) => (
              <PdfPageCanvas
                key={`${idx + 1}-${rotation}`}
                pdfDoc={pdfDoc}
                pageNumber={idx + 1}
                scale={scale}
                rotation={rotation}
                containerWidth={containerWidth}
                fitWidth={fitWidth}
                onVisible={handleVisible}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
