const SAFE_CONTEXT_KEYS = new Set([
  "requestId",
  "route",
  "status",
  "provider",
  "operation",
  "code",
  "retryable",
  "durationMs",
  "target",
]);

export type OperationalContext = Record<string, string | number | boolean | null | undefined>;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function getRequestId(request?: Request) {
  const candidate = request?.headers.get("x-request-id")?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : crypto.randomUUID();
}

export function getReleaseId() {
  const configured = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA)?.trim();
  if (configured) return configured.slice(0, 64);
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" ? "unknown" : "local";
}

function safeContext(context: OperationalContext | undefined) {
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context)
      .filter(([key]) => SAFE_CONTEXT_KEYS.has(key))
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 120) : value,
      ]),
  );
}

export function logOperationalEvent(event: string, context?: OperationalContext) {
  const normalizedEvent = event.trim().slice(0, 120) || "unknown";
  console.error(
    JSON.stringify({
      source: "petmanager",
      event: normalizedEvent,
      at: new Date().toISOString(),
      ...safeContext(context),
    }),
  );
}
