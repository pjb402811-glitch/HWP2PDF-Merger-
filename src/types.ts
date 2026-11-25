export type MergeFormat = 'pdf' | 'pptx';
export type AppMode = 'pdf' | 'pptx' | 'hwp';

export interface DocumentItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number; // PDF: page count, PPTX: slide count
  pageRange: string; // e.g. "all" or "1-3, 5"
  isValidRange: boolean;
  status: 'ready' | 'processing' | 'error';
  errorMessage?: string;
  slideTitles?: string[]; // Extracted titles for PPTX slides
  format: MergeFormat;
}

// Backward compatibility alias
export type PdfFileItem = DocumentItem;

export interface MergedPageItem {
  index: number; // 0-based index in current merged file
  pageNumber: number; // 1-based display number
  sourceDoc: string; // Name of origin document
  title: string; // Description or slide title
}

export interface MergeResult {
  blob: Blob;
  url: string;
  fileName: string;
  totalSize: number;
  totalPages: number; // Pages for PDF, Slides for PPTX
  originalTotalSize: number;
  processingTimeMs: number;
  format: MergeFormat;
  slideTitles?: { slideNum: number; sourceDoc: string; title: string }[];
  pageList?: MergedPageItem[];
  initialBlob?: Blob;
  initialTotalPages?: number;
  initialPageList?: MergedPageItem[];
  initialSlideTitles?: { slideNum: number; sourceDoc: string; title: string }[];
  deletedCount?: number;
}

export type HwpQualityPreset = 'standard' | 'high' | 'ultra';
export type HwpOutputMode = 'individual' | 'merged';

export interface HwpFileItem {
  id: string;
  file: File;
  name: string;
  ext: 'hwp' | 'hwpx';
  size: number;
  pageCount: number;
  status: 'ready' | 'needs-password' | 'converting' | 'error';
  errorMessage?: string;
  needsPassword?: boolean;
  password?: string;
}

export interface HwpConvertedItem {
  id: string;
  sourceName: string;
  pdfFileName: string;
  blob: Blob;
  url: string;
  size: number;
  pageCount: number;
  pageList: MergedPageItem[];
}

export interface HwpBatchResult {
  outputMode: HwpOutputMode;
  items: HwpConvertedItem[];
  totalFiles: number;
  totalPages: number;
  totalSourceSize: number;
  totalOutputSize: number;
  processingTimeMs: number;
  quality: HwpQualityPreset;
}
