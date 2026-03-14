type CounterMap = Map<string, number>;

class Telemetry {
  private counters: CounterMap = new Map();
  private started = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastFlushedAt: number | null = null;
  private lastFlushedSnapshot: Record<string, number> = {};

  start() {
    if (this.started) return;
    this.started = true;
    this.interval = setInterval(() => {
      this.flush();
    }, 60_000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.started = false;
  }

  inc(metric: string, value = 1) {
    this.counters.set(metric, (this.counters.get(metric) || 0) + value);
  }

  flush() {
    if (this.counters.size === 0) return;
    const snapshot = Object.fromEntries(this.counters.entries());
    this.counters.clear();
    this.lastFlushedSnapshot = snapshot;
    this.lastFlushedAt = Date.now();
    console.log("[telemetry]", JSON.stringify(snapshot));
  }

  snapshot() {
    return {
      started: this.started,
      pending: Object.fromEntries(this.counters.entries()),
      lastFlushedAt: this.lastFlushedAt,
      lastFlushedSnapshot: this.lastFlushedSnapshot,
    };
  }
}

export const telemetry = new Telemetry();
