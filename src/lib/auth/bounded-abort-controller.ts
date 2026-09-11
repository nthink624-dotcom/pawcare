export type AbortTimeoutScheduler = {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timeoutId: number) => void;
};

export type BoundedAbortController = {
  controller: AbortController;
  didTimeout: () => boolean;
  dispose: () => void;
};

function browserScheduler(): AbortTimeoutScheduler {
  return {
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timeoutId) => window.clearTimeout(timeoutId),
  };
}

export function createBoundedAbortController(
  timeoutMs: number,
  scheduler: AbortTimeoutScheduler = browserScheduler(),
): BoundedAbortController {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = scheduler.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    didTimeout: () => timedOut,
    dispose: () => scheduler.clearTimeout(timeoutId),
  };
}
