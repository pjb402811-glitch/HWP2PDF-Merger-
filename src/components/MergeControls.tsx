import React from 'react';
import { Layers, Loader2, ShieldCheck, Presentation } from 'lucide-react';
import { MergeFormat } from '../types';

interface MergeControlsProps {
  format: MergeFormat;
  outputFileName: string;
  onChangeOutputFileName: (name: string) => void;
  onMerge: () => void;
  isMerging: boolean;
  progressPercent: number;
  currentStep: string;
  filesCount: number;
  hasInvalidRanges: boolean;
}

export const MergeControls: React.FC<MergeControlsProps> = ({
  format,
  outputFileName,
  onChangeOutputFileName,
  onMerge,
  isMerging,
  progressPercent,
  currentStep,
  filesCount,
  hasInvalidRanges,
}) => {
  const isPdf = format === 'pdf';
  const isReady = filesCount >= 2 && !hasInvalidRanges && !isMerging;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Output File Name Setting */}
        <div className="flex-1">
          <label
            htmlFor="output-file-name-input"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            저장될 병합 파일 이름
          </label>
          <div className="flex items-center gap-1.5 max-w-md">
            <div className="relative flex-1">
              <input
                id="output-file-name-input"
                type="text"
                value={outputFileName}
                onChange={(e) => onChangeOutputFileName(e.target.value)}
                disabled={isMerging}
                placeholder={isPdf ? 'merged_document' : 'merged_presentation'}
                className={`w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 transition-colors ${
                  isPdf
                    ? 'focus:border-indigo-500 focus:ring-indigo-500'
                    : 'focus:border-orange-500 focus:ring-orange-500'
                }`}
              />
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-2 rounded-lg select-none border ${
                isPdf
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                  : 'text-orange-700 bg-orange-50 border-orange-200'
              }`}
            >
              .{format}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isPdf
              ? '품질 손실 0% • 원본 벡터, 폰트, 이미지 스트림 100% 무손실 복제'
              : '서식 손실 0% • 원본 슬라이드 마스터, 레이아웃, 고화질 미디어 100% 보존'}
          </p>
        </div>

        {/* Merge Button & Progress */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <button
            id="btn-execute-merge"
            type="button"
            onClick={onMerge}
            disabled={!isReady}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-150 cursor-pointer ${
              isReady
                ? isPdf
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200 hover:shadow-orange-300 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
            }`}
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>무손실 병합 진행 중 ({progressPercent}%)</span>
              </>
            ) : (
              <>
                {isPdf ? (
                  <Layers className="w-4 h-4 text-indigo-200" />
                ) : (
                  <Presentation className="w-4 h-4 text-orange-200" />
                )}
                <span>
                  품질 저하 없이 {filesCount}개 {format.toUpperCase()} 병합하기
                </span>
              </>
            )}
          </button>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {filesCount < 2 ? (
              <span className="text-amber-600">
                * 병합하려면 최소 2개 이상의 {format.toUpperCase()} 파일이 필요합니다
              </span>
            ) : hasInvalidRanges ? (
              <span className="text-rose-600">
                * 잘못 지정된 범위가 있습니다. 확인해 주세요.
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                병합 준비 완료 (브라우저 로컬 무손실 처리)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Progress Bar when Merging */}
      {isMerging && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span
              className={`font-medium flex items-center gap-1.5 ${
                isPdf ? 'text-indigo-700' : 'text-orange-700'
              }`}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {currentStep}
            </span>
            <span className="font-bold text-slate-700">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
                isPdf ? 'bg-indigo-600' : 'bg-orange-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
