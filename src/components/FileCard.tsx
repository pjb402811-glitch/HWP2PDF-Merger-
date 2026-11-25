import React, { useState } from 'react';
import { FileText, ArrowUp, ArrowDown, Trash2, SlidersHorizontal, AlertCircle, Presentation } from 'lucide-react';
import { DocumentItem } from '../types';
import { formatBytes, parsePageRange } from '../utils/pdfMerger';

interface FileCardProps {
  item: DocumentItem;
  index: number;
  totalCount: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onUpdateRange: (id: string, range: string, isValid: boolean) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  item,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateRange,
}) => {
  const [showRangeCustom, setShowRangeCustom] = useState(item.pageRange !== 'all');
  const [rangeInput, setRangeInput] = useState(item.pageRange === 'all' ? `1-${item.pageCount}` : item.pageRange);

  const isPdf = item.format === 'pdf';
  const unitName = isPdf ? '페이지' : '슬라이드';

  const handleRangeChange = (val: string) => {
    setRangeInput(val);
    const { isValid } = parsePageRange(val, item.pageCount);
    onUpdateRange(item.id, val, isValid);
  };

  const setAllPages = () => {
    setShowRangeCustom(false);
    setRangeInput(`1-${item.pageCount}`);
    onUpdateRange(item.id, 'all', true);
  };

  const setCustomMode = () => {
    setShowRangeCustom(true);
    const initialRange = `1-${item.pageCount}`;
    setRangeInput(initialRange);
    const { isValid } = parsePageRange(initialRange, item.pageCount);
    onUpdateRange(item.id, initialRange, isValid);
  };

  const parsedPages = parsePageRange(item.pageRange, item.pageCount);
  const selectedPagesCount = parsedPages.indices.length;

  return (
    <div
      id={`file-card-${item.id}`}
      className={`group bg-white border rounded-xl p-3.5 shadow-2xs hover:shadow-sm transition-all duration-150 flex flex-col gap-2.5 ${
        isPdf ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-200 hover:border-orange-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Sequence & File Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
            {index + 1}
          </div>

          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              isPdf
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : 'bg-orange-50 text-orange-600 border-orange-100'
            }`}
          >
            {isPdf ? <FileText className="w-5 h-5" /> : <Presentation className="w-5 h-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="font-medium text-sm text-slate-800 truncate"
                title={item.name}
              >
                {item.name}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  isPdf ? 'bg-rose-100/70 text-rose-700' : 'bg-orange-100/70 text-orange-700'
                }`}
              >
                {item.format}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-0.5">
              <span>{formatBytes(item.size)}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
              <span className="font-medium text-slate-700">
                총 {item.pageCount}{unitName}
              </span>
              {item.pageRange !== 'all' && (
                <>
                  <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                  <span className={isPdf ? 'text-indigo-600 font-medium' : 'text-orange-600 font-medium'}>
                    {selectedPagesCount}{unitName} 선택됨
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            id={`btn-moveup-${item.id}`}
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            title="위로 이동"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <button
            id={`btn-movedown-${item.id}`}
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalCount - 1}
            title="아래로 이동"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowDown className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            id={`btn-remove-${item.id}`}
            type="button"
            onClick={() => onRemove(item.id)}
            title="목록에서 제거"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page / Slide Selection Bar */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">병합 {unitName}:</span>
          {!showRangeCustom ? (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                전체 (1~{item.pageCount})
              </span>
              <button
                type="button"
                onClick={setCustomMode}
                className={`font-medium hover:underline cursor-pointer flex items-center gap-0.5 ${
                  isPdf ? 'text-indigo-600 hover:text-indigo-800' : 'text-orange-600 hover:text-orange-800'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                선별 지정
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => handleRangeChange(e.target.value)}
                  placeholder="예: 1-3, 5"
                  className={`px-2.5 py-1 text-xs rounded-lg border w-32 focus:outline-none focus:ring-1 ${
                    item.isValidRange
                      ? isPdf
                        ? 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-800 bg-white'
                        : 'border-orange-300 focus:border-orange-500 focus:ring-orange-500 text-slate-800 bg-white'
                      : 'border-rose-300 focus:border-rose-500 focus:ring-rose-500 text-rose-700 bg-rose-50/50'
                  }`}
                />
              </div>

              <span className="text-slate-400 text-[11px]">(예: 1-3, 5)</span>

              <button
                type="button"
                onClick={setAllPages}
                className="text-slate-500 hover:text-slate-800 text-[11px] underline cursor-pointer"
              >
                전체로 복원
              </button>

              {!item.isValidRange && (
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                  <AlertCircle className="w-3 h-3" />
                  범위 오류 (1~{item.pageCount})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          {isPdf ? '품질: 100% 원본 무손실 유지' : '품질: 마스터 서식 및 고화질 미디어 보존'}
        </div>
      </div>
    </div>
  );
};
