import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700/80 px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200"
    >
      <div className="relative flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="absolute w-3.5 h-3.5 rounded-full bg-amber-400/40 animate-ping" />
      </div>
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-slate-200">
        Offline Mode <span className="hidden sm:inline">— PDF tools active in local memory</span>
      </span>
    </div>
  );
};
