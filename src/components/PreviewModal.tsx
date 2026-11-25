import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  CheckCircle,
  ShieldCheck,
  X,
  FileText,
  Clock,
  RefreshCw,
  Presentation,
  Check,
  Trash2,
  Undo2,
  CheckSquare,
  Square,
  Eye,
  Scissors,
  Layers,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { MergeResult, MergedPageItem } from '../types';
import { formatBytes } from '../utils/pdfMerger';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PreviewModalProps {
  result: MergeResult | null;
  onClose: () => void;
  onResetAll: () => void;
  onDeletePages: (indicesToDelete: number[]) => Promise<void>;
  onRestoreOriginal: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  result,
  onClose,
  onResetAll,
  onDeletePages,
  onRestoreOriginal,
}) => {
  if (!result) return null;

  const isPdf = result.format === 'pdf';
  const unitName = isPdf ? '페이지' : '슬라이드';

  // Active view tab: 'preview' (viewer) or 'manage' (page deletion)
  const [activeTab, setActiveTab] = useState<'preview' | 'manage'>('preview');

  // Selected indices (0-based) for deletion in the current merged file
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessNotice, setDeleteSuccessNotice] = useState<string | null>(null);

  // Derive items to show (either from pageList or slideTitles or generated from totalPages)
  const items: { index: number; pageNumber: number; sourceDoc: string; title: string }[] = React.useMemo(() => {
    if (isPdf) {
      if (result.pageList && result.pageList.length === result.totalPages) {
        return result.pageList;
      }
      return Array.from({ length: result.totalPages }, (_, i) => ({
        index: i,
        pageNumber: i + 1,
        sourceDoc: '병합 문서',
        title: `${i + 1}페이지`,
      }));
    } else {
      if (result.slideTitles && result.slideTitles.length === result.totalPages) {
        return result.slideTitles.map((st, i) => ({
          index: i,
          pageNumber: st.slideNum,
          sourceDoc: st.sourceDoc,
          title: st.title,
        }));
      }
      return Array.from({ length: result.totalPages }, (_, i) => ({
        index: i,
        pageNumber: i + 1,
        sourceDoc: '병합 프레젠테이션',
        title: `슬라이드 ${i + 1}`,
      }));
    }
  }, [isPdf, result.pageList, result.slideTitles, result.totalPages]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = result.url;
    const ext = isPdf ? '.pdf' : '.pptx';
    a.download = result.fileName.endsWith(ext) ? result.fileName : `${result.fileName}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    window.open(result.url, '_blank');
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedIndices.length === items.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(items.map((it) => it.index));
    }
  };

  const handleSelectOdd = () => {
    // 1-based odd = index 0, 2, 4...
    setSelectedIndices(items.filter((it) => it.pageNumber % 2 !== 0).map((it) => it.index));
  };

  const handleSelectEven = () => {
    // 1-based even = index 1, 3, 5...
    setSelectedIndices(items.filter((it) => it.pageNumber % 2 === 0).map((it) => it.index));
  };

  const handleDeselectAll = () => {
    setSelectedIndices([]);
  };

  const executeDelete = async (indicesToDelete: number[]) => {
    if (indicesToDelete.length === 0) return;

    if (indicesToDelete.length >= result.totalPages) {
      alert(`모든 ${unitName}를 삭제할 수는 없습니다. 최소 1개 이상 남아있어야 합니다.`);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeletePages(indicesToDelete);
      setSelectedIndices([]);
      setDeleteSuccessNotice(`${indicesToDelete.length}개의 ${unitName}가 무손실로 삭제되었습니다.`);
      setTimeout(() => setDeleteSuccessNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || `${unitName} 삭제 중 오류가 발생했습니다.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = () => {
    executeDelete(selectedIndices);
  };

  const handleDeleteSingle = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    executeDelete([index]);
  };

  const handleRestore = () => {
    onRestoreOriginal();
    setSelectedIndices([]);
    setDeleteSuccessNotice('원래 병합본으로 전체 복원되었습니다.');
    setTimeout(() => setDeleteSuccessNotice(null), 4000);
  };

  return (
    <div
      id="preview-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div
        id="preview-modal-content"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPdf ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {isPdf ? 'PDF 무손실 병합 결과' : 'PPTX 파워포인트 무손실 병합 결과'}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  {isPdf ? '원본 화질 100% 보존' : '서식 및 마스터 100% 보존'}
                </span>
                {result.deletedCount && result.deletedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                    <Scissors className="w-3 h-3" />
                    {result.deletedCount}개 {unitName} 삭제됨
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {result.fileName} • 총 <strong>{result.totalPages}</strong>{unitName} • {formatBytes(result.totalSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-modal-download"
              type="button"
              onClick={handleDownload}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                isPdf
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">병합 {result.format.toUpperCase()}</span> 다운로드
            </button>

            {isPdf && (
              <button
                id="btn-modal-new-tab"
                type="button"
                onClick={handleOpenNewTab}
                title="새 창에서 원본 열기"
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-modal-close"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Tabs Bar */}
        <div className="px-4 sm:px-6 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              id="tab-view-preview"
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>문서 뷰어</span>
            </button>

            <button
              id="tab-view-manage-pages"
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? isPdf
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>선택 {unitName} 삭제 관리</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'manage'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {result.totalPages}개
              </span>
            </button>
          </div>

          {/* Right quick stats */}
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              {isPdf ? <FileText className="w-3.5 h-3.5 text-indigo-600" /> : <Presentation className="w-3.5 h-3.5 text-orange-600" />}
              용량: <strong>{formatBytes(result.totalSize)}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              처리 속도: <strong>{(result.processingTimeMs / 1000).toFixed(2)}초</strong>
            </span>
          </div>
        </div>

        {/* Delete Success Inline Banner */}
        {deleteSuccessNotice && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteSuccessNotice}</span>
            </div>
            {result.deletedCount && result.deletedCount > 0 ? (
              <button
                type="button"
                onClick={handleRestore}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                원본 복원하기
              </button>
            ) : null}
          </div>
        )}

        {/* Tab Content 1: Document Preview */}
        {activeTab === 'preview' && (
          <div className="flex-1 bg-slate-100 relative min-h-0 overflow-hidden flex flex-col">
            {isPdf ? (
              /* Canvas-based PDF Viewer (works inside nested iframes & all browsers) */
              <div className="w-full h-full relative">
                <PdfCanvasViewer
                  key={result.url}
                  blob={result.blob}
                  fileName={result.fileName}
                />
              </div>
            ) : (
              /* PPTX Presentation Overview */
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 bg-slate-50">
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      <Presentation className="w-7 h-7" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="text-base font-bold text-slate-900">
                        파워포인트 무손실 병합 완료
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        총 <strong className="text-orange-600 font-bold">{result.totalPages}개 슬라이드</strong>가 원본 디자인 서식, 마스터 템플릿, 고화질 이미지와 함께 안전하게 결합되었습니다.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('manage')}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Scissors className="w-4 h-4 text-orange-600" />
                        슬라이드 삭제 관리
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-200 flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Download className="w-4 h-4" />
                        다운로드 (.pptx)
                      </button>
                    </div>
                  </div>

                  {/* Slide Outline List */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-orange-600" />
                        병합된 슬라이드 구성 목록 ({items.length}개)
                      </h5>
                      <button
                        type="button"
                        onClick={() => setActiveTab('manage')}
                        className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        슬라이드 삭제하기
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                      {items.map((slide) => (
                        <div
                          key={slide.index}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-orange-50/40 hover:border-orange-200 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-md bg-orange-100 text-orange-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {slide.pageNumber}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {slide.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            출처: {slide.sourceDoc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compatibility Notice */}
                  <div className="bg-orange-50/50 border border-orange-200/80 rounded-xl p-3 text-xs text-orange-800 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <p>
                      다운로드한 <strong>{result.fileName}</strong> 파일은 Microsoft PowerPoint, Google Slides, Keynote 등 모든 프레젠테이션 프로그램에서 서식 깨짐 없이 원본 그대로 열립니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Page & Slide Deletion Manager */}
        {activeTab === 'manage' && (
          <div className="flex-1 bg-slate-100/70 relative min-h-0 overflow-y-auto flex flex-col p-3 sm:p-5">
            {/* Top Toolbar for Selection & Deletion */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-rose-500" />
                  삭제 대상 선택:
                </span>

                <button
                  id="btn-select-all"
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedIndices.length === items.length ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      전체 해제
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      전체 선택
                    </>
                  )}
                </button>

                <button
                  id="btn-select-odd"
                  type="button"
                  onClick={handleSelectOdd}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  홀수 {unitName}
                </button>

                <button
                  id="btn-select-even"
                  type="button"
                  onClick={handleSelectEven}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  짝수 {unitName}
                </button>

                {selectedIndices.length > 0 && (
                  <button
                    id="btn-deselect-all"
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    선택 취소
                  </button>
                )}
              </div>

              {/* Action Buttons: Delete Selected & Undo Restore */}
              <div className="flex items-center gap-2.5">
                {result.deletedCount && result.deletedCount > 0 ? (
                  <button
                    id="btn-restore-original"
                    type="button"
                    onClick={handleRestore}
                    title="초기 병합 파일로 원상태 복원"
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-slate-600" />
                    원본 복원 (총 {result.deletedCount}개 복구)
                  </button>
                ) : null}

                <button
                  id="btn-execute-delete-selected"
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedIndices.length === 0 || isDeleting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                    selectedIndices.length > 0 && !isDeleting
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 active:scale-98'
                      : 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
                  }`}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      삭제 처리 중...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      선택한 {selectedIndices.length}개 {unitName} 삭제
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="mb-3 px-3 py-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  삭제하려는 {unitName}를 클릭하여 선택하거나 각 카드의 <strong>삭제(🗑️)</strong> 버튼을 누르면 원본 화질 저하 없이 무손실로 안전하게 제거됩니다.
                </span>
              </div>
              <span className="font-semibold shrink-0 text-[11px] bg-white px-2 py-0.5 rounded border border-amber-300">
                현재 총 {items.length}개 중 {selectedIndices.length}개 선택
              </span>
            </div>

            {/* Visual Page/Slide Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 pb-4">
              {items.map((item) => {
                const isSelected = selectedIndices.includes(item.index);

                return (
                  <div
                    key={item.index}
                    id={`page-card-${item.index}`}
                    onClick={() => toggleSelect(item.index)}
                    className={`group relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/40 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Checkbox + Page Badge + Quick Delete */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-white border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-rose-200/80 text-rose-800'
                              : isPdf
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          #{item.pageNumber}
                        </span>
                      </div>

                      {/* Quick 1-click single page delete */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSingle(item.index, e)}
                        title={`이 ${unitName} 즉시 삭제`}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle: Visual representation preview card */}
                    <div
                      className={`w-full aspect-[4/3] rounded-lg border flex flex-col items-center justify-center p-2 mb-2.5 transition-colors ${
                        isSelected
                          ? 'bg-white border-rose-200'
                          : 'bg-slate-50/80 border-slate-100 group-hover:bg-slate-100/50'
                      }`}
                    >
                      {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                          <div className="w-7 h-9 bg-white border border-slate-200 rounded-sm shadow-2xs flex flex-col items-center justify-center p-1 mb-1.5">
                            <div className="w-full h-1 bg-slate-300 rounded mb-1" />
                            <div className="w-3/4 h-0.5 bg-slate-200 rounded mb-0.5" />
                            <div className="w-4/5 h-0.5 bg-slate-200 rounded" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">
                            {item.pageNumber}페이지
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col justify-between p-1.5 bg-white border border-slate-200 rounded">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-[10px] font-bold text-slate-700 truncate">
                              슬라이드 {item.pageNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                            {item.title}
                          </p>
                          <div className="w-full h-0.5 bg-orange-100 rounded" />
                        </div>
                      )}
                    </div>

                    {/* Bottom: Origin Source Document */}
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                      <span className="truncate" title={item.sourceDoc}>
                        {item.sourceDoc}
                      </span>
                      {isSelected && (
                        <span className="text-rose-600 font-bold shrink-0">
                          삭제 예정
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {activeTab === 'manage' ? (
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <Scissors className="w-3.5 h-3.5 text-rose-500" />
                선택한 페이지를 삭제하면 다운로드 파일에 즉시 반영되며, 필요 시 원본 복원할 수 있습니다.
              </span>
            ) : (
              <span>
                {isPdf
                  ? '* 브라우저 내장 PDF 뷰어에서 인쇄, 회전, 확대/축소 등 원본 해상도를 즉시 확인하실 수 있습니다.'
                  : '* 100% 무손실 OpenXML 패키징으로 슬라이드 마스터와 도형 서식이 원형 그대로 유지됩니다.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-modal-new-task"
              type="button"
              onClick={onResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로운 파일 병합하기
            </button>
            <button
              id="btn-modal-bottom-download"
              type="button"
              onClick={handleDownload}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                isPdf ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              {result.format.toUpperCase()} 다운로드 ({result.totalPages}{unitName})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
