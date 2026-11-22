type Options = {
  run: (signal: AbortSignal) => Promise<unknown>;
  canRun: () => boolean;
  intervalMs: number;
  timeoutMs?: number;
  maxBackoffMs?: number;
};

export function shouldPollOwnerData({ visible, online, activeTab, busy }: {
  visible: boolean;
  online: boolean;
  activeTab: string;
  busy: boolean;
}) {
  return visible && online && !busy && ["home", "book", "customers"].includes(activeTab);
}

/** Background reads only. User actions and push events keep their own refresh path. */
export function createOwnerBackgroundPoller({
  run,
  canRun,
  intervalMs,
  timeoutMs = 20_000,
  maxBackoffMs = 300_000,
}: Options) {
  let stopped = false;
  let running = false;
  let failures = 0;
  let nextAllowedAt = Date.now() + intervalMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  function schedule(delay = Math.max(0, nextAllowedAt - Date.now())) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void request(), delay);
  }

  async function request() {
    if (stopped || running) return;
    if (!canRun()) {
      schedule(intervalMs);
      return;
    }
    if (Date.now() < nextAllowedAt) {
      schedule();
      return;
    }

    running = true;
    clearTimeout(timer);
    const current = new AbortController();
    controller = current;
    const deadline = setTimeout(() => current.abort(), timeoutMs);
    try {
      await run(current.signal);
      if (current.signal.aborted) throw new Error("Background read timed out");
      failures = 0;
    } catch {
      failures = Math.min(failures + 1, 10);
    } finally {
      clearTimeout(deadline);
      running = false;
      controller = undefined;
      // Count the interval from completion. Never overlap a slow/aborted read,
      // even if its transport does not settle immediately after abort().
      const delay = Math.min(maxBackoffMs, intervalMs * 2 ** failures);
      nextAllowedAt = Date.now() + delay;
      schedule();
    }
  }

  schedule();
  return {
    request,
    stop() {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}
