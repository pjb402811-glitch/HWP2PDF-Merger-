import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PdfFileItem, MergedPageItem } from '../types';

/**
 * Format bytes into readable string (KB, MB, etc.)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse human readable page ranges like "all", "1-3, 5, 7-10" into 0-indexed page array
 */
export function parsePageRange(rangeStr: string, totalPages: number): { indices: number[]; isValid: boolean } {
  const trimmed = rangeStr.trim().toLowerCase();
  if (!trimmed || trimmed === 'all') {
    return {
      indices: Array.from({ length: totalPages }, (_, i) => i),
      isValid: true,
    };
  }

  const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  const indicesSet = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > totalPages) {
        return { indices: [], isValid: false };
      }

      const safeEnd = Math.min(end, totalPages);
      for (let p = start; p <= safeEnd; p++) {
        indicesSet.add(p - 1);
      }
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page) || page < 1 || page > totalPages) {
        return { indices: [], isValid: false };
      }
      indicesSet.add(page - 1);
    }
  }

  const sortedIndices = Array.from(indicesSet).sort((a, b) => a - b);
  return {
    indices: sortedIndices,
    isValid: sortedIndices.length > 0,
  };
}

/**
 * Inspect PDF to quickly determine page count without full parsing
 */
export async function inspectPdf(file: File): Promise<{ pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return {
    pageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Merge multiple PDFs losslessly using pdf-lib.
 * Directly copies page dictionary streams, embedded fonts, vector paths and image streams.
 * Zero rasterization or compression degradation occurs.
 */
export async function mergePdfsLossless(
  fileItems: PdfFileItem[],
  onProgress?: (progress: number, currentItem: string) => void
): Promise<{ pdfBytes: Uint8Array; totalPages: number; pageList: MergedPageItem[] }> {
  const mergedPdf = await PDFDocument.create();
  let totalCopiedPages = 0;
  const pageList: MergedPageItem[] = [];

  const totalFiles = fileItems.length;

  for (let i = 0; i < totalFiles; i++) {
    const item = fileItems[i];
    if (onProgress) {
      const percent = Math.round((i / totalFiles) * 90);
      onProgress(percent, item.name);
    }

    const fileBuffer = await item.file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const sourcePageCount = sourcePdf.getPageCount();

    const { indices } = parsePageRange(item.pageRange, sourcePageCount);
    if (indices.length === 0) continue;

    // copyPages retains 100% original objects: vector graphics, fonts, lossless images
    const copiedPages = await mergedPdf.copyPages(sourcePdf, indices);
    for (let pIdx = 0; pIdx < copiedPages.length; pIdx++) {
      const copiedPage = copiedPages[pIdx];
      mergedPdf.addPage(copiedPage);
      const originalPageNumber = indices[pIdx] + 1;
      pageList.push({
        index: totalCopiedPages,
        pageNumber: totalCopiedPages + 1,
        sourceDoc: item.name,
        title: `${item.name} (${originalPageNumber}페이지)`,
      });
      totalCopiedPages++;
    }
  }

  if (onProgress) {
    onProgress(95, '병합 파일 최적화 및 저장 중...');
  }

  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });

  if (onProgress) {
    onProgress(100, '완료');
  }

  return {
    pdfBytes,
    totalPages: totalCopiedPages,
    pageList,
  };
}

/**
 * Losslessly delete selected pages (0-based indices) from a PDF Blob.
 * Directly removes page tree nodes in pdf-lib without recompressing or rasterizing any page content.
 */
export async function deletePagesFromPdfLossless(
  pdfBlob: Blob,
  pageIndicesToDelete: number[],
  currentPageList?: MergedPageItem[]
): Promise<{
  updatedBlob: Blob;
  totalPages: number;
  updatedPageList: MergedPageItem[];
}> {
  if (pageIndicesToDelete.length === 0) {
    const insp = await inspectPdf(new File([pdfBlob], 'temp.pdf'));
    return {
      updatedBlob: pdfBlob,
      totalPages: insp.pageCount,
      updatedPageList: currentPageList || [],
    };
  }

  const buffer = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const initialCount = pdfDoc.getPageCount();

  if (pageIndicesToDelete.length >= initialCount) {
    throw new Error('모든 페이지를 삭제할 수는 없습니다. 최소 1페이지 이상 남아있어야 합니다.');
  }

  // Sort descending to ensure stable index deletion
  const sortedDesc = Array.from(new Set(pageIndicesToDelete)).sort((a, b) => b - a);

  for (const idx of sortedDesc) {
    if (idx >= 0 && idx < pdfDoc.getPageCount()) {
      pdfDoc.removePage(idx);
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const updatedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const remainingCount = pdfDoc.getPageCount();

  // Re-index remaining pages
  const deleteSet = new Set(pageIndicesToDelete);
  const updatedPageList: MergedPageItem[] = [];

  if (currentPageList && currentPageList.length === initialCount) {
    let newCounter = 0;
    for (let i = 0; i < currentPageList.length; i++) {
      if (!deleteSet.has(i)) {
        newCounter++;
        updatedPageList.push({
          index: updatedPageList.length,
          pageNumber: newCounter,
          sourceDoc: currentPageList[i].sourceDoc,
          title: currentPageList[i].title,
        });
      }
    }
  } else {
    for (let i = 0; i < remainingCount; i++) {
      updatedPageList.push({
        index: i,
        pageNumber: i + 1,
        sourceDoc: '병합 문서',
        title: `페이지 ${i + 1}`,
      });
    }
  }

  return {
    updatedBlob,
    totalPages: remainingCount,
    updatedPageList,
  };
}

/**
 * Utility to generate a lightweight sample PDF for instant testing
 */
export async function generateSamplePdf(
  title: string,
  docNumber: number,
  pageCount: number = 2
): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pageCount; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
    const { width, height } = page.getSize();

    // Top decorative bar
    page.drawRectangle({
      x: 40,
      y: height - 60,
      width: width - 80,
      height: 6,
      color: docNumber === 1 ? rgb(0.15, 0.4, 0.95) : docNumber === 2 ? rgb(0.1, 0.65, 0.45) : rgb(0.85, 0.35, 0.2),
    });

    page.drawText(`${title} - Page ${i}/${pageCount}`, {
      x: 40,
      y: height - 100,
      size: 22,
      font,
      color: rgb(0.1, 0.15, 0.25),
    });

    page.drawText(`High Quality Vector Sample Document #${docNumber}`, {
      x: 40,
      y: height - 130,
      size: 13,
      font: regularFont,
      color: rgb(0.4, 0.45, 0.55),
    });

    // Draw some crisp vector shapes to prove lossless retention
    page.drawCircle({
      x: 100,
      y: height - 220,
      size: 40,
      color: rgb(0.92, 0.95, 1.0),
      borderColor: rgb(0.2, 0.45, 0.9),
      borderWidth: 2,
    });

    page.drawRectangle({
      x: 170,
      y: height - 260,
      width: 140,
      height: 80,
      color: rgb(0.97, 0.97, 0.98),
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1.5,
    });

    page.drawText(`Vector Crisp Test [Page ${i}]`, {
      x: 185,
      y: height - 225,
      size: 11,
      font,
      color: rgb(0.2, 0.25, 0.35),
    });

    page.drawText('Original resolution, fonts, and vector paths are 100% preserved.', {
      x: 40,
      y: 100,
      size: 11,
      font: regularFont,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return new File([blob], `${title.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });
}
