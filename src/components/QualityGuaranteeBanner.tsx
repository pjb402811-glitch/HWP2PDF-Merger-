import React, { useState } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  Zap,
  FileText,
  Presentation,
  Image as ImageIcon,
  FileOutput,
  Layers,
} from 'lucide-react';
import { AppMode } from '../types';

interface QualityGuaranteeBannerProps {
  format?: AppMode;
}

export const QualityGuaranteeBanner: React.FC<QualityGuaranteeBannerProps> = ({ format = 'pdf' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPdf = format === 'pdf';
  const isPptx = format === 'pptx';
  const isHwp = format === 'hwp';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isPdf
                ? 'bg-emerald-50 text-emerald-600'
                : isPptx
                ? 'bg-orange-50 text-orange-600'
                : 'bg-sky-50 text-sky-600'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">
                {isPdf
                  ? '왜 PDF 화질/품질 저하가 전혀 발생하지 않나요?'
                  : isPptx
                  ? '왜 PPTX 프레젠테이션 품질 및 서식 저하가 없나요?'
                  : '한글(HWP/HWPX) 파일은 어떻게 PDF로 변환되며 몇 개까지 가능한가요?'}
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                {isPdf
                  ? 'Lossless Direct Object Stream'
                  : isPptx
                  ? 'Lossless OpenXML Package Merge'
                  : 'Browser WASM HWP Engine · 최대 20개 일괄 처리'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isPdf
                ? '일반 툴과 달리 이미지를 재압축하거나 래스터화하지 않고, 원본 PDF의 객체 트리를 1:1로 직접 복제합니다.'
                : isPptx
                ? '슬라이드를 이미지로 변환하지 않고, 원본 슬라이드 XML, 슬라이드 마스터, 테마, 고화질 미디어를 그대로 패키징 병합합니다.'
                : '브라우저 내장 Rust/WASM 한글 조판 엔진으로 서버 업로드 없이 .hwp·.hwpx를 한 번에 최대 20개까지 고해상도 PDF로 변환합니다.'}
            </p>
          </div>
        </div>

        <button
          id="btn-toggle-quality-detail"
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-xs font-medium flex items-center gap-1 self-start sm:self-center shrink-0 cursor-pointer ${
            isHwp ? 'text-sky-600 hover:text-sky-800' : 'text-indigo-600 hover:text-indigo-800'
          }`}
        >
          {isExpanded ? (
            <>
              간략히 보기 <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              {isHwp ? '변환 안내 및 제한 확인' : '무손실 기술 세부정보'} <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {isPdf ? (
            <>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  원본 DPI 및 이미지 100% 보존
                </div>
                <p className="text-slate-600 leading-relaxed">
                  PDF 내에 포함된 300DPI 이상의 인쇄용 사진, 스캔 문서 등의 압축 스트림을 원형 그대로 유지하여 선명도를 완벽히 보장합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  벡터 도형 & 텍스트 글꼴 유지
                </div>
                <p className="text-slate-600 leading-relaxed">
                  CAD 도면, 차트, 백터 아이콘, 임베디드 폰트가 이미지로 깨지지 않고 텍스트 검색 및 무한 확대 가능한 벡터 상태를 유지합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  100% 로컬 보안 처리
                </div>
                <p className="text-slate-600 leading-relaxed">
                  사용자의 파일이 외부 서버로 업로드되지 않으며 오직 브라우저 메모리 안에서만 고속으로 병합되므로 개인정보 유출 걱정이 없습니다.
                </p>
              </div>
            </>
          ) : isPptx ? (
            <>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Presentation className="w-3.5 h-3.5 text-orange-600" />
                  슬라이드 마스터 & 레이아웃 온전 보존
                </div>
                <p className="text-slate-600 leading-relaxed">
                  각 파워포인트의 고유 슬라이드 마스터와 레이아웃 서식이 깨지지 않도록 격리 네임스페이스로 온전히 보존하여 병합합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  고해상도 사진 & 미디어 무압축 유지
                </div>
                <p className="text-slate-600 leading-relaxed">
                  슬라이드에 포함된 고화질 이미지 및 미디어 파일의 바이너리 데이터를 재압축 없이 원본 그대로 보존합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  100% 로컬 보안 처리
                </div>
                <p className="text-slate-600 leading-relaxed">
                  중요한 비즈니스 발표 자료나 기업 기획서가 외부 서버로 나가지 않고 사용자의 PC 브라우저 안에서 안전하게 병합됩니다.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  한 번에 최대 20개 파일 일괄 변환
                </div>
                <p className="text-slate-600 leading-relaxed">
                  브라우저 메모리 안정성을 위해 파일별 순차 렌더링 및 즉시 메모리 해제 방식으로 1회 최대 20개(.hwp/.hwpx)까지 안정적으로 변환합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <FileOutput className="w-3.5 h-3.5 text-indigo-600" />
                  개별 저장 · ZIP · 1개 PDF 통합 지원
                </div>
                <p className="text-slate-600 leading-relaxed">
                  1개만 변환하거나 여러 파일을 각각의 PDF(ZIP)로 저장할 수 있고, 모든 한글 문서를 변환과 동시에 하나의 PDF로 바로 합칠 수도 있습니다.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  100% 로컬 보안 · 암호 문서 지원
                </div>
                <p className="text-slate-600 leading-relaxed">
                  문서가 외부 서버로 전송되지 않아 공문서·계약서도 안심하고 변환할 수 있으며, 비밀번호가 걸린 한글 파일도 잠금 해제 후 변환 가능합니다.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
