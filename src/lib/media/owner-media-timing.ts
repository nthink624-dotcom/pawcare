export type OwnerMediaTimingStep =
  | "status-action-click"
  | "pending-feedback"
  | "stage-pending-local"
  | "claim-pending-upload"
  | "compress-original"
  | "create-upload-intent"
  | "upload-original"
  | "complete-upload-readback"
  | "compress-provider-ready"
  | "create-provider-ready-intent"
  | "upload-provider-ready"
  | "complete-provider-ready"
  | "durable-asset-readback"
  | "persist-durable-local"
  | "appointment-status-commit"
  | "appointment-status-saved"
  | "appointment-row-apply"
  | "clear-pending-local"
  | "care-report-prepare";

export type OwnerMediaTimingEvent = Readonly<{
  step: OwnerMediaTimingStep;
  outcome: "success" | "failure";
  durationMs: number;
  errorName?: string;
}>;

type OwnerMediaTimingSink = (event: OwnerMediaTimingEvent) => void;

function ownerMediaNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function safeErrorName(error: unknown) {
  const candidate = error instanceof Error ? error.name : "UnknownError";
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(candidate) ? candidate : "Error";
}

function emitOwnerMediaTiming(event: OwnerMediaTimingEvent) {
  if (event.outcome === "success") console.info("[owner-media]", event);
  else console.warn("[owner-media]", event);
}

export async function traceOwnerMediaStep<T>(
  step: OwnerMediaTimingStep,
  work: () => Promise<T>,
  emit: OwnerMediaTimingSink = emitOwnerMediaTiming,
): Promise<T> {
  const startedAt = ownerMediaNow();
  try {
    const result = await work();
    emit({ step, outcome: "success", durationMs: Math.max(0, Math.round(ownerMediaNow() - startedAt)) });
    return result;
  } catch (error) {
    emit({
      step,
      outcome: "failure",
      durationMs: Math.max(0, Math.round(ownerMediaNow() - startedAt)),
      errorName: safeErrorName(error),
    });
    throw error;
  }
}

export function markOwnerMediaStep(
  step: OwnerMediaTimingStep,
  emit: OwnerMediaTimingSink = emitOwnerMediaTiming,
) {
  emit({ step, outcome: "success", durationMs: 0 });
}
