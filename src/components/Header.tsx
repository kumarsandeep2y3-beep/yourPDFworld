import React from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Share2,
} from 'lucide-react';
import { ToolMode } from '../types/pdf';
import { PWAInstallButton } from './PWAInstallButton';

export type ThemeMode = 'light' | 'dark' | 'system';

interface HeaderProps {
  currentMode: ToolMode;
  onSelectMode: (mode: ToolMode) => void;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  onLoadSamples: () => void;
  onOpenShare?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  themeMode,
  onCycleTheme,
  onLoadSamples,
  onOpenShare,
}) => {
  return (
    <header className="justpdf-header sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 md:gap-6 h-14 sm:h-16">
          {/* 1. Brand Container (Cleaned: Duplicate Trust Badge Removed) */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onSelectMode('dashboard')}
              className="brand-container flex items-center space-x-2 text-left group cursor-pointer focus:outline-none"
              title="yourPDFworld.com - Your Complete PDF Solution"
            >
              <div className="bg-blue-600 p-2 rounded-xl text-white font-bold shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform flex items-center justify-center text-base">
                📄
              </div>

              <h1 className="logo-text text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                your<span className="text-cyan-500 dark:text-cyan-400">PDF</span>world<small className="domain-badge text-xs text-slate-400 font-normal ml-0.5">.com</small>
              </h1>
            </button>
          </div>

          {/* Right Header Actions (Install, Share, Theme Toggle) */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Theme Toggle Button */}
            <button
              id="themeToggleBtn"
              onClick={onCycleTheme}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer text-sm flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
              title={`Toggle Theme (Current: ${themeMode})`}
              aria-label="Toggle Theme"
            >
              {themeMode === 'light' ? '☀️' : '🌙'}
            </button>

            {/* Native Share Button */}
            <button
              onClick={onOpenShare}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer text-sm flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
              title="Share yourPDFworld.com"
              aria-label="Share App"
            >
              🔗
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Sample Documents Button */}
            <button
              onClick={onLoadSamples}
              className="hidden sm:inline-flex px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xs transition-colors whitespace-nowrap items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sample Docs</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
