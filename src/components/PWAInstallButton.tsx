import React, { useState } from 'react';
import { MonitorSmartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide when already running as an installed standalone app
  if (isInstalled) {
    return null;
  }

  // Chromium / Edge / Android Desktop & Mobile flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        type="button"
        onClick={install}
        title="PC 또는 스마트폰 홈 화면에 앱으로 설치"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
      >
        <MonitorSmartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span>앱 설치</span>
      </button>
    );
  }

  // iOS Safari flow (WebKit does not support beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <MonitorSmartphone className="w-3.5 h-3.5 text-indigo-600" />
          <span>홈 화면에 앱 추가</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/icon.svg"
                    alt="앱 아이콘"
                    className="w-11 h-11 rounded-xl shadow-xs border border-slate-200"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      iPhone / iPad에 앱 설치하기
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Safari에서 홈 화면에 추가하여 앱처럼 실행하세요
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1 flex-wrap">
                    하단 Safari 도구 막대의{' '}
                    <strong className="inline-flex items-center gap-1 text-indigo-700">
                      <Share className="w-3.5 h-3.5" /> 공유
                    </strong>{' '}
                    버튼을 탭하세요.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="flex items-center gap-1 flex-wrap">
                    아래로 스크롤하여{' '}
                    <strong className="inline-flex items-center gap-1 text-indigo-700">
                      <PlusSquare className="w-3.5 h-3.5" /> 홈 화면에 추가
                    </strong>
                    를 선택하세요.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
