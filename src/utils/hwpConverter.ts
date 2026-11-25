import initRhwp, { HwpDocument } from '@rhwp/core';
import wasmUrl from '@rhwp/core/rhwp_bg.wasm?url';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import {
  HwpConvertedItem,
  HwpFileItem,
  HwpQualityPreset,
  MergedPageItem,
} from '../types';

export const MAX_HWP_BATCH_FILES = 20;

export const HWP_QUALITY_OPTIONS: Record<
  HwpQualityPreset,
  { label: string; shortLabel: string; dpi: number; scale: number; description: string }
> = {
  standard: {
    label: '표준 (150 DPI)',
    shortLabel: '150 DPI',
    dpi: 150,
    scale: 150 / 96,
    description: '빠른 변환 · 작은 파일 용량',
  },
  high: {
    label: '고화질 (240 DPI · 권장)',
    shortLabel: '240 DPI',
    dpi: 240,
    scale: 240 / 96,
    description: '선명한 한글 글꼴 · 표 테두리 균형',
  },
  ultra: {
    label: '인쇄용 초고화질 (300 DPI)',
    shortLabel: '300 DPI',
    dpi: 300,
    scale: 300 / 96,
    description: '인쇄 및 확대 감상 최적화',
  },
};

let initPromise: Promise<void> | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;
let lastMeasureFont = '';

function registerMeasureTextWidth() {
  const g = globalThis as unknown as {
    measureTextWidth?: (font: string, text: string) => number;
  };
  if (typeof g.measureTextWidth === 'function') return;

  g.measureTextWidth = (font: string, text: string) => {
    if (!measureCtx && typeof document !== 'undefined') {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    if (!measureCtx) return text.length * 8;
    if (font !== lastMeasureFont) {
      measureCtx.font = font;
      lastMeasureFont = font;
    }
    return measureCtx.measureText(text).width;
  };
}

/**
 * Initialize @rhwp/core WASM engine and wait for Korean fallback webfonts once.
 */
export async function ensureRhwpInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      registerMeasureTextWidth();
      await initRhwp({ module_or_path: wasmUrl });
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
          await Promise.race([
            document.fonts.ready,
            new Promise<void>((resolve) => setTimeout(resolve, 2500)),
          ]);
        } catch {
          // Ignore font readiness timeout
        }
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

function isPasswordRelatedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /비밀번호|암호|password|encrypt/i.test(msg);
}

function openHwpDoc(bytes: Uint8Array, fileName: string, password?: string): HwpDocument {
  const doc = password ? HwpDocument.openWithPassword(bytes, password) : new HwpDocument(bytes);
  doc.setFileName(fileName);
  return doc;
}

/**
 * Inspect an HWP or HWPX file to read its page count and password status.
 */
export async function inspectHwp(
  file: File,
  password?: string
): Promise<{ pageCount: number; needsPassword: boolean }> {
  await ensureRhwpInitialized();
  const bytes = new Uint8Array(await file.arrayBuffer());

  let doc: HwpDocument | null = null;
  try {
    doc = openHwpDoc(bytes, file.name, password);
    const pageCount = Math.max(1, doc.pageCount());
    return { pageCount, needsPassword: false };
  } catch (err) {
    if (isPasswordRelatedError(err)) {
      if (!password) {
        return { pageCount: 0, needsPassword: true };
      }
      throw new Error('비밀번호가 일치하지 않습니다.');
    }
    throw err instanceof Error
      ? err
      : new Error(`"${file.name}" 파일을 열 수 없습니다.`);
  } finally {
    if (doc) {
      try {
        doc.free();
      } catch {
        // Ignore dispose errors
      }
    }
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('캔버스 PNG 인코딩에 실패했습니다.'));
          return;
        }
        try {
          const buf = await blob.arrayBuffer();
          resolve(new Uint8Array(buf));
        } catch (err) {
          reject(err);
        }
      },
      'image/png'
    );
  });
}

function toPdfFileName(hwpFileName: string): string {
  const stripped = hwpFileName.replace(/\.(hwpx|hwp)$/i, '');
  return `${stripped || 'converted_document'}.pdf`;
}

/**
 * Convert a single HWP/HWPX file into PDF bytes in the browser.
 */
export async function convertSingleHwpToPdf(
  item: HwpFileItem,
  options: {
    quality: HwpQualityPreset;
    onPageProgress?: (currentPage: number, totalPages: number) => void;
  }
): Promise<{ pdfBytes: Uint8Array; pageCount: number; pageList: MergedPageItem[] }> {
  await ensureRhwpInitialized();

  const scale = HWP_QUALITY_OPTIONS[options.quality].scale;
  const bytes = new Uint8Array(await item.file.arrayBuffer());

  let doc: HwpDocument | null = null;
  const rawCanvas = document.createElement('canvas');
  const exportCanvas = document.createElement('canvas');

  try {
    doc = openHwpDoc(bytes, item.name, item.password);
    doc.setDimMasterPages(false);

    const totalPages = Math.max(1, doc.pageCount());
    const pdfDoc = await PDFDocument.create();
    const pageList: MergedPageItem[] = [];

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (options.onPageProgress) {
        options.onPageProgress(pageIdx + 1, totalPages);
      }

      // Yield to UI event loop so progress bar remains responsive
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      doc.renderPageToCanvas(pageIdx, rawCanvas, scale);

      const canvasW = rawCanvas.width > 0 ? rawCanvas.width : Math.round(793.7 * scale);
      const canvasH = rawCanvas.height > 0 ? rawCanvas.height : Math.round(1122.5 * scale);

      exportCanvas.width = canvasW;
      exportCanvas.height = canvasH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('브라우저 2D 캔버스 컨텍스트를 생성할 수 없습니다.');
      }

      // Paint solid white paper background before compositing rendered page
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      if (rawCanvas.width > 0 && rawCanvas.height > 0) {
        ctx.drawImage(rawCanvas, 0, 0);
      }

      const pngBytes = await canvasToPngBytes(exportCanvas);
      const pngImage = await pdfDoc.embedPng(pngBytes);

      // Convert 96 DPI CSS pixel size to PDF points (72 pt/in)
      const widthPt = (canvasW / scale) * (72 / 96);
      const heightPt = (canvasH / scale) * (72 / 96);

      const page = pdfDoc.addPage([widthPt, heightPt]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: widthPt,
        height: heightPt,
      });

      pageList.push({
        index: pageIdx,
        pageNumber: pageIdx + 1,
        sourceDoc: item.name,
        title: `${item.name} (${pageIdx + 1}페이지)`,
      });
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return { pdfBytes, pageCount: totalPages, pageList };
  } finally {
    if (doc) {
      try {
        doc.free();
      } catch {
        // Ignore WASM dispose errors
      }
    }
    rawCanvas.width = 0;
    rawCanvas.height = 0;
    exportCanvas.width = 0;
    exportCanvas.height = 0;
  }
}

/**
 * Convert multiple HWP/HWPX files sequentially into individual PDF blobs.
 */
export async function convertHwpBatchToIndividualPdfs(
  items: HwpFileItem[],
  quality: HwpQualityPreset,
  onProgress?: (percent: number, stepText: string) => void
): Promise<HwpConvertedItem[]> {
  const results: HwpConvertedItem[] = [];
  const totalFiles = items.length;

  for (let i = 0; i < totalFiles; i++) {
    const item = items[i];
    const { pdfBytes, pageCount, pageList } = await convertSingleHwpToPdf(item, {
      quality,
      onPageProgress: (page, total) => {
        if (onProgress) {
          const fileBase = (i / totalFiles) * 95;
          const fileSpan = (1 / totalFiles) * 95;
          const pageProgress = (page / Math.max(1, total)) * fileSpan;
          const percent = Math.min(99, Math.round(fileBase + pageProgress));
          onProgress(
            percent,
            `[${i + 1}/${totalFiles}] ${item.name} — ${page}/${total}페이지 PDF 변환 중...`
          );
        }
      },
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    results.push({
      id: `converted-${item.id}`,
      sourceName: item.name,
      pdfFileName: toPdfFileName(item.name),
      blob,
      url,
      size: blob.size,
      pageCount,
      pageList,
    });
  }

  if (onProgress) {
    onProgress(100, '모든 한글 파일 PDF 변환 완료');
  }

  return results;
}

/**
 * Convert multiple HWP/HWPX files and merge them into a single unified PDF.
 */
export async function convertHwpBatchAndMergePdf(
  items: HwpFileItem[],
  quality: HwpQualityPreset,
  onProgress?: (percent: number, stepText: string) => void
): Promise<{
  pdfBytes: Uint8Array;
  totalPages: number;
  pageList: MergedPageItem[];
  convertedItems: HwpConvertedItem[];
}> {
  const convertedItems = await convertHwpBatchToIndividualPdfs(
    items,
    quality,
    (percent, stepText) => {
      if (onProgress) {
        onProgress(Math.round(percent * 0.9), stepText);
      }
    }
  );

  if (onProgress) {
    onProgress(93, '변환된 PDF 문서를 하나로 무손실 병합 중...');
  }

  const mergedPdf = await PDFDocument.create();
  const pageList: MergedPageItem[] = [];
  let totalPages = 0;

  for (const converted of convertedItems) {
    const buf = await converted.blob.arrayBuffer();
    const srcPdf = await PDFDocument.load(buf);
    const indices = srcPdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(srcPdf, indices);

    for (let idx = 0; idx < copiedPages.length; idx++) {
      mergedPdf.addPage(copiedPages[idx]);
      pageList.push({
        index: totalPages,
        pageNumber: totalPages + 1,
        sourceDoc: converted.sourceName,
        title: `${converted.sourceName} (${idx + 1}페이지)`,
      });
      totalPages++;
    }
  }

  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });

  if (onProgress) {
    onProgress(100, '통합 PDF 생성 완료');
  }

  return {
    pdfBytes,
    totalPages,
    pageList,
    convertedItems,
  };
}

/**
 * Package multiple converted PDFs into a single ZIP file for batch download.
 */
export async function createZipFromConvertedPdfs(items: HwpConvertedItem[]): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const item of items) {
    let fileName = item.pdfFileName;
    const count = usedNames.get(fileName) || 0;
    usedNames.set(fileName, count + 1);
    if (count > 0) {
      fileName = fileName.replace(/\.pdf$/i, `_${count + 1}.pdf`);
    }
    zip.file(fileName, item.blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Generate a real sample .hwp document in-memory for instant testing.
 */
export async function generateSampleHwp(
  title: string,
  docNumber: number
): Promise<File> {
  await ensureRhwpInitialized();

  const doc = HwpDocument.createEmpty();
  try {
    const heading = `${title} (샘플 한글 문서 #${docNumber})`;
    doc.insertText(0, 0, 0, heading);
    doc.applyCharFormat(0, 0, 0, heading.length, JSON.stringify({ bold: true, fontSizePt: 18 }));
    doc.splitParagraph(0, 0, heading.length);

    const bodyText =
      '본 문서는 별도 한컴오피스 설치 없이 브라우저 내장 WASM 엔진으로 PDF 변환을 테스트하기 위해 생성된 한글(.hwp) 파일입니다.';
    doc.insertText(0, 1, 0, bodyText);
    doc.splitParagraph(0, 1, bodyText.length);

    doc.createTable(0, 2, 0, 3, 3);
    const cells = [
      '구분',
      '세부 항목',
      '상태',
      '문서 형식',
      `HWP 5.0 / HWPX 지원 (#${docNumber})`,
      '정상 지원',
      '보안 및 속도',
      '브라우저 로컬 무업로드 변환',
      '100% 보안',
    ];
    cells.forEach((txt, idx) => {
      doc.insertTextInCell(0, 2, 0, idx, 0, 0, txt);
    });

    const hwpBytes = doc.exportHwp();
    const blob = new Blob([new Uint8Array(hwpBytes)], { type: 'application/x-hwp' });
    return new File([blob], `${title.replace(/\s+/g, '_')}.hwp`, {
      type: 'application/x-hwp',
    });
  } finally {
    doc.free();
  }
}
