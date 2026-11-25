import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileUp,
  Sparkles,
  AlertCircle,
  Presentation,
  FileOutput,
} from 'lucide-react';
import { AppMode } from '../types';

interface DropZoneProps {
  format: AppMode;
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
  onAddSamples?: () => void;
  isAddingSamples?: boolean;
  hasFiles: boolean;
  onFormatMismatch?: (detectedFormat: AppMode, files: File[]) => void;
  maxFiles?: number;
  currentFileCount?: number;
}

export const DropZone: React.FC<DropZoneProps> = ({
  format,
  onFilesSelected,
  onAddSamples,
  isAddingSamples = false,
  hasFiles,
  onFormatMismatch,
  maxFiles,
  currentFileCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPdf = format === 'pdf';
  const isPptx = format === 'pptx';
  const isHwp = format === 'hwp';

  const acceptedExtensions = isPdf
    ? '.pdf,application/pdf'
    : isPptx
    ? '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : '.hwp,.hwpx,application/x-hwp,application/haansofthwp';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const detectFileMode = (file: File): AppMode | null => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
    if (
      name.endsWith('.pptx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      return 'pptx';
    }
    if (name.endsWith('.hwp') || name.endsWith('.hwpx')) return 'hwp';
    return null;
  };

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setErrorMsg(null);
    const validFiles: File[] = [];
    const mismatchedByMode: Record<AppMode, File[]> = { pdf: [], pptx: [], hwp: [] };
    const invalidFiles: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const detected = detectFileMode(file);

      if (detected === format) {
        validFiles.push(file);
      } else if (detected) {
        mismatchedByMode[detected].push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (validFiles.length === 0 && onFormatMismatch) {
      const candidateModes: AppMode[] = (['hwp', 'pdf', 'pptx'] as AppMode[]).filter(
        (m) => m !== format && mismatchedByMode[m].length > 0
      );
      if (candidateModes.length > 0) {
        const targetMode = candidateModes[0];
        onFormatMismatch(targetMode, mismatchedByMode[targetMode]);
        return;
      }
    }

    if (invalidFiles.length > 0) {
      const formatLabel = isHwp ? 'HWP/HWPX' : format.toUpperCase();
      setErrorMsg(
        `${formatLabel} 파일만 지원됩니다 (${invalidFiles.length}개 파일 제외됨: ${invalidFiles
          .slice(0, 2)
          .join(', ')}${invalidFiles.length > 2 ? '...' : ''})`
      );
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const remainingCapacity =
    typeof maxFiles === 'number' ? Math.max(0, maxFiles - currentFileCount) : null;

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedExtensions}
        className="hidden"
        onChange={handleInputChange}
        id="document-file-input"
      />

      <div
        id="drop-zone-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer text-center select-none ${
          isDragOver
            ? isPdf
              ? 'border-indigo-600 bg-indigo-50/70 scale-[1.008] shadow-lg shadow-indigo-100/50'
              : isPptx
              ? 'border-orange-600 bg-orange-50/70 scale-[1.008] shadow-lg shadow-orange-100/50'
              : 'border-sky-600 bg-sky-50/70 scale-[1.008] shadow-lg shadow-sky-100/50'
            : hasFiles
            ? 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/60 py-6 px-4'
            : isPdf
            ? 'border-indigo-200 hover:border-indigo-400 bg-gradient-to-b from-indigo-50/40 to-white py-12 px-6 shadow-xs'
            : isPptx
            ? 'border-orange-200 hover:border-orange-400 bg-gradient-to-b from-orange-50/40 to-white py-12 px-6 shadow-xs'
            : 'border-sky-200 hover:border-sky-400 bg-gradient-to-b from-sky-50/40 to-white py-12 px-6 shadow-xs'
        }`}
      >
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors mb-3 ${
              isDragOver
                ? isPdf
                  ? 'bg-indigo-600 text-white'
                  : isPptx
                  ? 'bg-orange-600 text-white'
                  : 'bg-sky-600 text-white'
                : isPdf
                ? 'bg-indigo-100 text-indigo-700'
                : isPptx
                ? 'bg-orange-100 text-orange-700'
                : 'bg-sky-100 text-sky-700'
            }`}
          >
            {isDragOver ? (
              <FileUp className="w-7 h-7 animate-bounce" />
            ) : isPdf ? (
              <UploadCloud className="w-7 h-7" />
            ) : isPptx ? (
              <Presentation className="w-7 h-7" />
            ) : (
              <FileOutput className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-800">
            {isDragOver
              ? `${isHwp ? '한글(HWP/HWPX)' : format.toUpperCase()} 파일을 여기에 놓으세요!`
              : `${isHwp ? '한글(HWP / HWPX)' : format.toUpperCase()} 파일을 마우스로 끌어다 놓거나 클릭하세요`}
          </h3>

          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {isPdf
              ? '여러 개의 PDF를 한 번에 선택할 수 있으며, 원본 해상도와 벡터 품질이 100% 무손실로 보존됩니다'
              : isPptx
              ? '여러 개의 PPTX 슬라이드를 한 번에 선택할 수 있으며, 마스터 서식과 고화질 미디어가 손실 없이 보존됩니다'
              : '1개 파일부터 한 번에 최대 20개까지 일괄 선택 가능하며, 개별 PDF 저장 또는 1개의 통합 PDF로 변환할 수 있습니다'}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {isPdf
                ? '모든 PDF 문서 지원 (.pdf)'
                : isPptx
                ? '파워포인트 프레젠테이션 지원 (.pptx)'
                : '한글 문서 지원 (.hwp, .hwpx)'}
            </span>
            <span
              className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                isPdf
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-100'
                  : isPptx
                  ? 'text-orange-700 bg-orange-50 border-orange-100'
                  : 'text-sky-700 bg-sky-50 border-sky-100'
              }`}
            >
              {isHwp
                ? remainingCapacity !== null && hasFiles
                  ? `최대 ${maxFiles}개 일괄 변환 (추가 가능 ${remainingCapacity}개)`
                  : `한 번에 최대 ${maxFiles ?? 20}개 일괄 변환`
                : '다중 파일 선택 가능'}
            </span>
          </div>
        </div>

        {!hasFiles && onAddSamples && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-400">
              테스트할 {isHwp ? '한글(HWP)' : format.toUpperCase()} 파일이 없으신가요?
            </span>
            <button
              id="btn-dropzone-add-samples"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSamples();
              }}
              disabled={isAddingSamples}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-white border rounded-lg shadow-2xs transition-colors cursor-pointer ${
                isPdf
                  ? 'text-indigo-600 hover:bg-indigo-50 border-indigo-200'
                  : isPptx
                  ? 'text-orange-600 hover:bg-orange-50 border-orange-200'
                  : 'text-sky-600 hover:bg-sky-50 border-sky-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAddingSamples
                ? '생성 중...'
                : `테스트용 샘플 ${isHwp ? 'HWP' : format.toUpperCase()} 3개 즉시 생성`}
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-2.5 flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
