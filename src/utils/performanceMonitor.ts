import { PerformanceTelemetry } from '../types/pdf';

type Listener = (telemetry: PerformanceTelemetry | null) => void;

class PerformanceMonitorService {
  private currentTelemetry: PerformanceTelemetry | null = null;
  private listeners: Set<Listener> = new Set();
  private timerInterval: any = null;
  private startTime: number = 0;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.currentTelemetry);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentTelemetry));
  }

  private getMemoryUsageMb(): number | undefined {
    if (typeof window !== 'undefined' && (performance as any).memory) {
      const bytes = (performance as any).memory.usedJSHeapSize;
      return Math.round((bytes / (1024 * 1024)) * 10) / 10;
    }
    return undefined;
  }

  public startTask(taskName: string, totalPages: number = 1): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.startTime = performance.now();

    this.currentTelemetry = {
      taskId,
      taskName,
      isActive: true,
      phase: 'Initializing engine...',
      elapsedMs: 0,
      pagesProcessed: 0,
      totalPages: Math.max(1, totalPages),
      memoryMb: this.getMemoryUsageMb(),
      throughputPagesPerSec: 0,
    };

    this.notify();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.currentTelemetry || !this.currentTelemetry.isActive) return;
      const elapsedMs = Math.round(performance.now() - this.startTime);
      const elapsedSec = Math.max(0.1, elapsedMs / 1000);
      const throughput =
        Math.round((this.currentTelemetry.pagesProcessed / elapsedSec) * 10) / 10;

      this.currentTelemetry = {
        ...this.currentTelemetry,
        elapsedMs,
        throughputPagesPerSec: throughput,
        memoryMb: this.getMemoryUsageMb(),
      };
      this.notify();
    }, 150);

    return taskId;
  }

  public updateTask(pagesProcessed: number, phase?: string) {
    if (!this.currentTelemetry || !this.currentTelemetry.isActive) return;
    const elapsedMs = Math.round(performance.now() - this.startTime);
    const elapsedSec = Math.max(0.1, elapsedMs / 1000);
    const throughput = Math.round((pagesProcessed / elapsedSec) * 10) / 10;

    this.currentTelemetry = {
      ...this.currentTelemetry,
      pagesProcessed,
      elapsedMs,
      throughputPagesPerSec: throughput,
      phase: phase || this.currentTelemetry.phase,
      memoryMb: this.getMemoryUsageMb(),
    };
    this.notify();
  }

  public finishTask(finalMessage: string = 'Task completed successfully') {
    if (!this.currentTelemetry) return;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const elapsedMs = Math.round(performance.now() - this.startTime);
    const elapsedSec = Math.max(0.1, elapsedMs / 1000);
    const throughput =
      Math.round(
        (Math.max(1, this.currentTelemetry.pagesProcessed) / elapsedSec) * 10
      ) / 10;

    this.currentTelemetry = {
      ...this.currentTelemetry,
      isActive: false,
      phase: finalMessage,
      elapsedMs,
      throughputPagesPerSec: throughput,
      memoryMb: this.getMemoryUsageMb(),
    };
    this.notify();

    // Auto-clear after 8 seconds of inactivity
    setTimeout(() => {
      if (this.currentTelemetry && !this.currentTelemetry.isActive) {
        this.currentTelemetry = null;
        this.notify();
      }
    }, 8000);
  }
}

export const performanceMonitor = new PerformanceMonitorService();
