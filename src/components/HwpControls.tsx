import React from 'react';
import { FileOutput, Loader2, ShieldCheck, Files, Layers } from 'lucide-react';
import { HwpOutputMode, HwpQualityPreset } from '../types';
import { HWP_QUALITY_OPTIONS, MAX_HWP_BATCH_FILES } from '../utils/hwpConverter';

interface HwpControlsProps {
  outputMode: HwpOutputMode;
  onChangeOutputMode: (mode: HwpOutputMode) => void;
  quality: HwpQualityPreset;
  onChangeQuality: (quality: HwpQualityPreset) => void;
  mergedFileName: string;
  onChangeMergedFileName: (name: string) => void;
  onConvert: () => void;
  isConverting: boolean;
  progressPercent: number;
  currentStep: string;
  filesCount: number;
  hasLockedFiles: boolean;
}

export const HwpControls: React.FC<HwpControlsProps> = ({
  outputMode,
  onChangeOutputMode,
  quality,
  onChangeQuality,
  mergedFileName,
  onChangeMergedFileName,
  onConvert,
  isConverting,
  progressPercent,
  currentStep,
  filesCount,
  hasLockedFiles,
}) => {
  const isReady = filesCount >= 1 && !hasLockedFiles && !isConverting;
  const presets: HwpQualityPreset[] = ['standard', 'high', 'ultra'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Output Mode Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            PDF 변환 방식 선택
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              id="btn-hwp-mode-individual"
              type="button"
              disabled={isConverting}
              onClick={() => onChangeOutputMode('individual')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                outputMode === 'individual'
                  ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-500/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                <Files
                  className={`w-4 h-4 ${
                    outputMode === 'individual' ? 'text-sky-600' : 'text-slate-400'
                  }`}
                />
                개별 PDF로 변환
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                파일마다 각각 .pdf 생성 (여러 개일 때 ZIP 일괄 저장)
              </p>
            </button>

            <button
              id="btn-hwp-mode-merged"
              type="button"
              disabled={isConverting}
              onClick={() => onChangeOutputMode('merged')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                outputMode === 'merged'
                  ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-500/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                <Layers
                  className={`w-4 h-4 ${
                    outputMode === 'merged' ? 'text-sky-600' : 'text-slate-400'
                  }`}
                />
                1개 PDF로 변환 + 통합
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                모든 한글 문서를 순서대로 1개의 PDF로 합쳐서 저장
              </p>
            </button>
          </div>
        </div>

        {/* Resolution Quality Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            PDF 변환 해상도 품질
          </label>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => {
              const info = HWP_QUALITY_OPTIONS[preset];
              const active = quality === preset;
              return (
                <button
                  key={preset}
                  id={`btn-hwp-quality-${preset}`}
                  type="button"
                  disabled={isConverting}
                  onClick={() => onChangeQuality(preset)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-500/30'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800">{info.shortLabel}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {preset === 'standard'
                      ? '빠른 속도'
                      : preset === 'high'
                      ? '고화질 권장'
                      : '인쇄 최적화'}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            선택됨: <strong className="text-slate-700">{HWP_QUALITY_OPTIONS[quality].label}</strong> —{' '}
            {HWP_QUALITY_OPTIONS[quality].description}
          </p>
        </div>
      </div>

      {/* Bottom Row: Merged File Name (if merged) + Convert Button */}
      <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          {outputMode === 'merged' ? (
            <div>
              <label
                htmlFor="hwp-merged-filename-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                저장될 통합 PDF 파일 이름
              </label>
              <div className="flex items-center gap-1.5 max-w-md">
                <input
                  id="hwp-merged-filename-input"
                  type="text"
                  value={mergedFileName}
                  onChange={(e) => onChangeMergedFileName(e.target.value)}
                  disabled={isConverting}
                  placeholder="한글변환_통합문서"
                  className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:border-sky-500 focus:ring-sky-500 transition-colors"
                />
                <span className="text-xs font-semibold px-2.5 py-2 rounded-lg select-none border text-sky-700 bg-sky-50 border-sky-200">
                  .pdf
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">
                원본 파일명을 그대로 유지하여 PDF로 변환합니다
              </div>
              <p className="text-[11px] text-slate-500">
                예: <code className="bg-slate-100 px-1 py-0.5 rounded">공문서.hwp</code> →{' '}
                <code className="bg-sky-50 text-sky-700 px-1 py-0.5 rounded">공문서.pdf</code> • 한 번에 최대{' '}
                {MAX_HWP_BATCH_FILES}개까지 일괄 변환 가능
              </p>
            </div>
          )}
        </div>

        {/* Convert CTA */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <button
            id="btn-execute-hwp-convert"
            type="button"
            onClick={onConvert}
            disabled={!isReady}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-150 cursor-pointer ${
              isReady
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-200 hover:shadow-sky-300 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
            }`}
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>PDF 변환 중 ({progressPercent}%)</span>
              </>
            ) : (
              <>
                <FileOutput className="w-4 h-4 text-sky-100" />
                <span>
                  {outputMode === 'merged' && filesCount > 1
                    ? `${filesCount}개 한글 문서 → 1개 PDF로 변환·병합`
                    : `${filesCount}개 한글 파일 PDF로 변환하기`}
                </span>
              </>
            )}
          </button>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {hasLockedFiles ? (
              <span className="text-amber-600 font-medium">
                * 암호화된 문서의 비밀번호를 먼저 해제해 주세요.
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                변환 준비 완료 (100% 브라우저 로컬 처리 · 최대 {MAX_HWP_BATCH_FILES}개)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Progress Bar */}
      {isConverting && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-medium text-sky-700 flex items-center gap-1.5 truncate pr-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="truncate">{currentStep}</span>
            </span>
            <span className="font-bold text-slate-700 shrink-0">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-sky-600 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
