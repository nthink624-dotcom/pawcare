/** Give the initial owner screen a paint before competing background work. */
export function scheduleOwnerEntryBackground(work: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;
  let timer: number | undefined;
  let frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (!cancelled) work();
      }, 1500);
    });
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
