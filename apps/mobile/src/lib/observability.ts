const SAFE_CONTEXT_KEYS = new Set([
  "requestId",
  "status",
  "operation",
  "code",
]);

export type OperationalContext = Record<string, string | number | boolean | null | undefined>;

export function getRequestId(_request?: Request) {
  // Never trust a caller-provided correlation ID; it can contain identifying data.
  return crypto.randomUUID();
}

export function getReleaseId() {
  const configured = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA)?.trim();
  if (configured) return configured.slice(0, 64);
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" ? "unknown" : "local";
}

export function logOperationalEvent(event: string, context?: OperationalContext) {
  const safeContext = Object.fromEntries(
    Object.entries(context ?? {})
      .filter(([key]) => SAFE_CONTEXT_KEYS.has(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]),
  );

  console.error(JSON.stringify({
    source: "petmanager-mobile",
    event: event.trim().slice(0, 120) || "unknown",
    at: new Date().toISOString(),
    ...safeContext,
  }));
}
