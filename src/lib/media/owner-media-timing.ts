export type OwnerMediaTimingEvent = Readonly<{
  step: string;
  outcome: "success" | "failure";
  durationMs: number;
  errorName?: string;
}>;

type OwnerMediaTimingSink = (event: OwnerMediaTimingEvent) => void;

function ownerMediaNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function emitOwnerMediaTiming(event: OwnerMediaTimingEvent) {
  if (event.outcome === "success") console.info("[owner-media]", event);
  else console.warn("[owner-media]", event);
}

export async function traceOwnerMediaStep<T>(
  step: string,
  work: () => Promise<T>,
  emit: OwnerMediaTimingSink = emitOwnerMediaTiming,
): Promise<T> {
  const startedAt = ownerMediaNow();
  try {
    const result = await work();
    emit({ step, outcome: "success", durationMs: Math.round(ownerMediaNow() - startedAt) });
    return result;
  } catch (error) {
    emit({
      step,
      outcome: "failure",
      durationMs: Math.round(ownerMediaNow() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
