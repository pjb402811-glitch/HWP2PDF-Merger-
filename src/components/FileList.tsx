import React from 'react';
import { DocumentItem, MergeFormat } from '../types';
import { FileCard } from './FileCard';
import { formatBytes, parsePageRange } from '../utils/pdfMerger';
import { ArrowUpDown, Trash2, Plus, ArrowDownAZ, FileStack, Presentation } from 'lucide-react';

interface FileListProps {
  format: MergeFormat;
  files: DocumentItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onUpdateRange: (id: string, range: string, isValid: boolean) => void;
  onClearAll: () => void;
  onSortByName: (ascending: boolean) => void;
  onSortBySize: () => void;
  onReverseOrder: () => void;
  onOpenUpload: () => void;
}

export const FileList: React.FC<FileListProps> = ({
  format,
  files,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateRange,
  onClearAll,
  onSortByName,
  onSortBySize,
  onReverseOrder,
  onOpenUpload,
}) => {
  const isPdf = format === 'pdf';
  const unitName = isPdf ? '페이지' : '슬라이드';

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalPages = files.reduce((acc, f) => {
    const { indices } = parsePageRange(f.pageRange, f.pageCount);
    return acc + indices.length;
  }, 0);

  return (
    <div className="space-y-3">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              isPdf ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
            }`}
          >
            {isPdf ? <FileStack className="w-4 h-4" /> : <Presentation className="w-4 h-4" />}
          </div>
          <h2 className="text-sm font-bold text-slate-800">
            병합할 {format.toUpperCase()} 목록{' '}
            <span className={isPdf ? 'text-indigo-600' : 'text-orange-600'}>
              ({files.length}개)
            </span>
          </h2>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">
            예상 결과:{' '}
            <strong className="text-slate-700 font-semibold">
              {totalPages}{unitName}
            </strong>{' '}
            ({formatBytes(totalBytes)})
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <button
            id="btn-sort-name-asc"
            type="button"
            onClick={() => onSortByName(true)}
            title="이름 가나다순 정렬"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowDownAZ className="w-3.5 h-3.5 text-slate-500" />
            이름순
          </button>

          <button
            id="btn-sort-size"
            type="button"
            onClick={onSortBySize}
            title="파일 크기순 정렬"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            크기순
          </button>

          <button
            id="btn-reverse-order"
            type="button"
            onClick={onReverseOrder}
            title="목록 순서 뒤집기"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            반전
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

          <button
            id="btn-add-more-files"
            type="button"
            onClick={onOpenUpload}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-lg transition-colors cursor-pointer ${
              isPdf
                ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                : 'text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            파일 추가
          </button>

          <button
            id="btn-clear-all"
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 비우기
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2.5">
        {files.map((fileItem, idx) => (
          <FileCard
            key={fileItem.id}
            item={fileItem}
            index={idx}
            totalCount={files.length}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            onUpdateRange={onUpdateRange}
          />
        ))}
      </div>
    </div>
  );
};
