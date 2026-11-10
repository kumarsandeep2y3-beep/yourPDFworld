import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { PerformanceTelemetry } from '../types/pdf';
import { performanceMonitor } from '../utils/performanceMonitor';

export const PerformanceOverlay: React.FC = () => {
  const [telemetry, setTelemetry] = useState<PerformanceTelemetry | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe((data) => {
      setTelemetry(data);
    });
    return unsubscribe;
  }, []);

  if (!telemetry) {
    return null;
  }

  const {
    taskName,
    isActive,
    phase,
    elapsedMs,
    pagesProcessed,
    totalPages,
    memoryMb,
    throughputPagesPerSec,
  } = telemetry;

  const seconds = (elapsedMs / 1000).toFixed(1);
  const percent = totalPages > 0 ? Math.min(100, Math.round((pagesProcessed / totalPages) * 100)) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full sm:w-84 font-sans animate-in slide-in-from-bottom-3 duration-200">
      <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden text-xs">
        {/* Header Bar */}
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3.5 py-2.5 bg-slate-800/90 flex items-center justify-between cursor-pointer border-b border-slate-700/60 select-none hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <span className="font-bold tracking-tight text-[11px] truncate max-w-[170px]">
              {taskName || 'Client Performance HUD'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-300">
            {isActive ? (
              <span className="text-emerald-400 font-mono font-semibold">LIVE</span>
            ) : (
              <span className="text-slate-400">IDLE</span>
            )}
            <button className="text-slate-400 hover:text-white p-0.5" aria-label="Toggle collapse">
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isCollapsed && (
          <div className="p-3.5 space-y-3">
            {/* Phase & Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 truncate max-w-[200px]">{phase}</span>
                <span className="font-mono tabular-nums text-slate-200 font-semibold">{percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Real-time KPI Metric Grid */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              {/* Latency */}
              <div className="p-2 bg-slate-800/70 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Elapsed</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-xs text-white">
                  {seconds}s
                </span>
              </div>

              {/* Throughput */}
              <div className="p-2 bg-slate-800/70 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Speed</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-xs text-white">
                  {throughputPagesPerSec > 0 ? `${throughputPagesPerSec} p/s` : `${pagesProcessed}/${totalPages}`}
                </span>
              </div>

              {/* Memory Usage */}
              <div className="p-2 bg-slate-800/70 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>Heap</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-xs text-white">
                  {memoryMb ? `${memoryMb} MB` : 'In Memory'}
                </span>
              </div>
            </div>

            {/* Privacy Verification Footnote */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-2.5 font-medium">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>0 bytes uploaded</span>
              </span>
              <span className="text-slate-400">Local WebAssembly Engine</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
