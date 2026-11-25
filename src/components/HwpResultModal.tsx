import React, { useState } from 'react';
import {
  CheckCircle,
  Download,
  FileArchive,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  Clock,
} from 'lucide-react';
import { HwpBatchResult, HwpConvertedItem } from '../types';
import { formatBytes } from '../utils/pdfMerger';
import { createZipFromConvertedPdfs, HWP_QUALITY_OPTIONS } from '../utils/hwpConverter';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface HwpResultModalProps {
  result: HwpBatchResult | null;
  onClose: () => void;
  onResetAll: () => void;
  onSendToPdfMerger: (items: HwpConvertedItem[]) => Promise<void>;
}

export const HwpResultModal: React.FC<HwpResultModalProps> = ({
  result,
  onClose,
  onResetAll,
  onSendToPdfMerger,
}) => {
  if (!result || result.items.length === 0) return null;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZipping, setIsZipping] = useState(false);
  const [isSendingToMerge, setIsSendingToMerge] = useState(false);

  const selectedItem = result.items[selectedIndex] || result.items[0];
  const hasMultiple = result.items.length > 1;

  const downloadSingle = (item: HwpConvertedItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zipBlob = await createZipFromConvertedPdfs(result.items);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `한글_PDF_변환모음_${result.items.length}개.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsZipping(false);
    }
  };

  const handleSendToMerge = async () => {
    setIsSendingToMerge(true);
    try {
      await onSendToPdfMerger(result.items);
    } finally {
      setIsSendingToMerge(false);
    }
  };

  return (
    <div
      id="hwp-result-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div
        id="hwp-result-modal-content"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  한글(HWP/HWPX) → PDF 변환 완료
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  {HWP_QUALITY_OPTIONS[result.quality].shortLabel} 고해상도
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                총 <strong>{result.totalFiles}개</strong> 문서 ({result.totalPages}페이지) •{' '}
                {formatBytes(result.totalOutputSize)} •{' '}
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 inline" />
                  {(result.processingTimeMs / 1000).toFixed(2)}초
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasMultiple ? (
              <button
                id="btn-hwp-download-zip"
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-200 transition-all cursor-pointer disabled:opacity-60"
              >
                {isZipping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4" />
                )}
                <span>전체 ZIP 다운로드 ({result.totalFiles}개)</span>
              </button>
            ) : (
              <button
                id="btn-hwp-download-single"
                type="button"
                onClick={() => downloadSingle(selectedItem)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-200 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>PDF 다운로드</span>
              </button>
            )}

            <button
              id="btn-hwp-modal-close"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: File Selector Sidebar (when >= 1) + Live PDF Viewer */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          {/* Converted PDF List */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 bg-white overflow-y-auto p-3 space-y-2 max-h-52 md:max-h-none shrink-0">
            <div className="px-1 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>변환된 PDF 목록 ({result.items.length}개)</span>
              <span>클릭하여 미리보기</span>
            </div>

            {result.items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-sky-50/80 border-sky-400 ring-1 ring-sky-400/40'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-sky-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-500'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-xs font-bold text-slate-800 truncate"
                        title={item.pdfFileName}
                      >
                        {item.pdfFileName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.pageCount}페이지 • {formatBytes(item.size)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSingle(item);
                    }}
                    title={`${item.pdfFileName} 다운로드`}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Embedded PDF Preview */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-200/60">
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 truncate">
                미리보기: {selectedItem.pdfFileName} ({selectedItem.pageCount}페이지)
              </span>
              <button
                type="button"
                onClick={() => downloadSingle(selectedItem)}
                className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                이 파일만 저장
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PdfCanvasViewer
                key={selectedItem.id}
                blob={selectedItem.blob}
                fileName={selectedItem.pdfFileName}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            * 변환된 PDF들을 이어서 1개로 합치거나 페이지를 편집하려면 <strong>PDF 병합 탭으로 보내기</strong>를 눌러주세요.
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-hwp-new-task"
              type="button"
              onClick={onResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로운 한글 파일 변환하기
            </button>

            <button
              id="btn-hwp-send-to-merge"
              type="button"
              onClick={handleSendToMerge}
              disabled={isSendingToMerge}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSendingToMerge ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
              &apos;PDF 병합&apos; 탭으로 보내기 ({result.totalFiles}개)
            </button>

            {hasMultiple && (
              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <FileArchive className="w-3.5 h-3.5" />
                전체 ZIP 저장
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
