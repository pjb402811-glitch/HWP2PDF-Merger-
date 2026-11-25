import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ArrowDownAZ,
  ArrowUpDown,
  FileOutput,
  Lock,
  Unlock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { HwpFileItem } from '../types';
import { formatBytes } from '../utils/pdfMerger';
import { MAX_HWP_BATCH_FILES } from '../utils/hwpConverter';

interface HwpFileListProps {
  files: HwpFileItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onSortByName: (ascending: boolean) => void;
  onSortBySize: () => void;
  onReverseOrder: () => void;
  onOpenUpload: () => void;
  onUnlockPassword: (id: string, password: string) => Promise<void>;
}

export const HwpFileList: React.FC<HwpFileListProps> = ({
  files,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClearAll,
  onSortByName,
  onSortBySize,
  onReverseOrder,
  onOpenUpload,
  onUnlockPassword,
}) => {
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalPages = files.reduce((acc, f) => acc + f.pageCount, 0);
  const isAtLimit = files.length >= MAX_HWP_BATCH_FILES;

  const handleUnlockSubmit = async (id: string) => {
    const pw = passwordInputs[id] || '';
    if (!pw.trim()) return;
    setUnlockingId(id);
    try {
      await onUnlockPassword(id, pw);
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
            <FileOutput className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">
            변환할 한글 문서 목록{' '}
            <span className="text-sky-600">
              ({files.length} / 최대 {MAX_HWP_BATCH_FILES}개)
            </span>
          </h2>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">
            총{' '}
            <strong className="text-slate-700 font-semibold">
              {totalPages}페이지
            </strong>{' '}
            ({formatBytes(totalBytes)})
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <button
            id="btn-hwp-sort-name"
            type="button"
            onClick={() => onSortByName(true)}
            title="이름 가나다순 정렬"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowDownAZ className="w-3.5 h-3.5 text-slate-500" />
            이름순
          </button>

          <button
            id="btn-hwp-sort-size"
            type="button"
            onClick={onSortBySize}
            title="파일 크기순 정렬"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            크기순
          </button>

          <button
            id="btn-hwp-reverse"
            type="button"
            onClick={onReverseOrder}
            title="목록 순서 뒤집기"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            반전
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

          <button
            id="btn-hwp-add-more"
            type="button"
            onClick={onOpenUpload}
            disabled={isAtLimit}
            title={
              isAtLimit
                ? `한 번에 최대 ${MAX_HWP_BATCH_FILES}개까지만 추가할 수 있습니다`
                : '한글 파일 더 추가하기'
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            파일 추가
          </button>

          <button
            id="btn-hwp-clear-all"
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 비우기
          </button>
        </div>
      </div>

      {/* File Cards */}
      <div className="space-y-2.5">
        {files.map((item, idx) => {
          const isLocked = item.status === 'needs-password';
          const isError = item.status === 'error';

          return (
            <div
              key={item.id}
              id={`hwp-card-${item.id}`}
              className={`bg-white border rounded-xl p-3.5 shadow-2xs transition-all duration-150 flex flex-col gap-2.5 ${
                isLocked
                  ? 'border-amber-300 bg-amber-50/20'
                  : isError
                  ? 'border-rose-300 bg-rose-50/20'
                  : 'border-slate-200 hover:border-sky-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                    {idx + 1}
                  </div>

                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      isLocked
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-sky-50 text-sky-600 border-sky-100'
                    }`}
                  >
                    {isLocked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <FileOutput className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-sm text-slate-800 truncate"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase bg-sky-100/80 text-sky-700 shrink-0">
                        {item.ext}
                      </span>
                      {isLocked && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 shrink-0">
                          비밀번호 필요
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-0.5">
                      <span>{formatBytes(item.size)}</span>
                      <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                      {isLocked ? (
                        <span className="text-amber-700 font-medium">
                          암호화된 문서입니다. 비밀번호를 입력해 주세요.
                        </span>
                      ) : isError ? (
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {item.errorMessage || '문서 읽기 오류'}
                        </span>
                      ) : (
                        <span className="font-medium text-slate-700">
                          총 {item.pageCount}페이지 → PDF 변환 대기
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMoveUp(idx)}
                    disabled={idx === 0}
                    title="위로 이동"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onMoveDown(idx)}
                    disabled={idx === files.length - 1}
                    title="아래로 이동"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <div className="w-px h-4 bg-slate-200 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    title="목록에서 제거"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Password Unlock Row for Encrypted HWP/HWPX */}
              {isLocked && (
                <div className="pt-2.5 border-t border-amber-200/70 flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="password"
                    value={passwordInputs[item.id] || ''}
                    onChange={(e) =>
                      setPasswordInputs((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUnlockSubmit(item.id);
                    }}
                    placeholder="문서 열기 비밀번호 입력"
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-48"
                  />
                  <button
                    type="button"
                    onClick={() => handleUnlockSubmit(item.id)}
                    disabled={unlockingId === item.id || !(passwordInputs[item.id] || '').trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {unlockingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    잠금 해제
                  </button>
                  {item.errorMessage && (
                    <span className="text-rose-600 font-medium">{item.errorMessage}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
