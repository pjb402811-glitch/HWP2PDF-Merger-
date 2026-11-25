import React from 'react';
import { Layers, ShieldCheck, Sparkles, FileText, Presentation, FileOutput } from 'lucide-react';
import { AppMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentFormat: AppMode;
  onChangeFormat: (format: AppMode) => void;
  onAddSamples: () => void;
  isAddingSamples: boolean;
  fileCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentFormat,
  onChangeFormat,
  onAddSamples,
  isAddingSamples,
  fileCount,
}) => {
  const isPdf = currentFormat === 'pdf';
  const isPptx = currentFormat === 'pptx';
  const isHwp = currentFormat === 'hwp';

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* App Title & Logo */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors shrink-0 ${
              isPdf
                ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-indigo-100'
                : isPptx
                ? 'bg-gradient-to-br from-orange-600 to-amber-700 text-white shadow-orange-100'
                : 'bg-gradient-to-br from-sky-600 to-cyan-700 text-white shadow-sky-100'
            }`}
          >
            {isPdf ? (
              <Layers className="w-5 h-5" />
            ) : isPptx ? (
              <Presentation className="w-5 h-5" />
            ) : (
              <FileOutput className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                HWP2PDF Merge
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                {isHwp ? '로컬 즉시 변환' : '100% 무손실'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {isPdf
                ? '품질 저하 없이 원본 해상도와 벡터 데이터를 1개의 PDF로 합칩니다'
                : isPptx
                ? '서식, 마스터, 애니메이션, 고화질 미디어 손실 없이 1개의 PPTX로 합칩니다'
                : '한컴오피스 없이 .hwp / .hwpx 문서를 고화질 PDF로 변환하고 하나로 병합합니다 (최대 20개)'}
            </p>
          </div>
        </div>

        {/* Mode Selector & Quick Action */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Format Tabs Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              id="tab-mode-pdf"
              type="button"
              onClick={() => onChangeFormat('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isPdf
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF 병합
            </button>
            <button
              id="tab-mode-pptx"
              type="button"
              onClick={() => onChangeFormat('pptx')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isPptx
                  ? 'bg-white text-orange-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              PPTX 병합
            </button>
            <button
              id="tab-mode-hwp"
              type="button"
              onClick={() => onChangeFormat('hwp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isHwp
                  ? 'bg-white text-sky-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileOutput className="w-3.5 h-3.5" />
              한글 → PDF
            </button>
          </div>

          {fileCount === 0 && (
            <button
              id="btn-add-samples"
              type="button"
              onClick={onAddSamples}
              disabled={isAddingSamples}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isPdf
                  ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                  : isPptx
                  ? 'text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200'
                  : 'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200'
              }`}
              title={`테스트용 샘플 ${currentFormat.toUpperCase()} 3개를 즉시 생성하여 추가합니다`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAddingSamples
                ? '생성 중...'
                : `테스트용 샘플 ${isHwp ? 'HWP' : currentFormat.toUpperCase()} 추가`}
            </button>
          )}

          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
