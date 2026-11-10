import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Laptop } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running inside an installed standalone PWA, suppress the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // In Chromium browsers before prompt fires, show modal with instructions
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Install yourPDFworld as an offline desktop/mobile app"
        className="flex items-center space-x-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-cyan-500/20 active:scale-95 transition cursor-pointer whitespace-nowrap"
      >
        {installSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-white" />
            <span>Installed!</span>
          </>
        ) : (
          <>
            <span>↓</span>
            <span>Install</span>
          </>
        )}
      </button>

      {/* Guided Installation Modal (for iOS Safari or manual bookmarking) */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  📄
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Install yourPDFworld
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your Complete PDF Solution.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>To install on iPhone or iPad:</span>
                </p>
                <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                  <li>
                    Tap the <strong className="text-slate-900 dark:text-white">Share</strong> button in Safari toolbar at the bottom of your screen.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-slate-900 dark:text-white">Add</strong> in the top-right corner.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <span>Desktop & Mobile Installation:</span>
                </p>
                <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                  <li>
                    Click the install icon in your browser URL bar, or open the browser menu (<strong className="text-slate-900 dark:text-white">⋮</strong>).
                  </li>
                  <li>
                    Select <strong className="text-slate-900 dark:text-white">Install yourPDFworld</strong> or <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                  </li>
                  <li>
                    The app launches in a clean, standalone native window with full offline access.
                  </li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
