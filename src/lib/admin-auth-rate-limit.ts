import { createHash, timingSafeEqual } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const BLOCK_MS = 30 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

type AttemptState = {
  failures: number[];
  blockedUntil: number;
};

type AttemptStore = Map<string, AttemptState>;

const globalStore = globalThis as typeof globalThis & {
  __petmanagerAdminAuthAttempts?: AttemptStore;
};

function store() {
  globalStore.__petmanagerAdminAuthAttempts ??= new Map();
  return globalStore.__petmanagerAdminAuthAttempts;
}

export function buildAdminAuthAttemptKey(input: {
  action: "login" | "reset" | "setup";
  loginId: string;
  clientAddress: string;
}) {
  const normalized = `${input.action}:${input.loginId.trim().toLowerCase()}:${input.clientAddress.trim() || "unknown"}`;
  return createHash("sha256").update(normalized).digest("hex");
}

export function safeAdminSecretEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function getAdminAuthClientAddress(headers: Headers) {
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export function assertAdminAuthAttemptAllowed(key: string, now = Date.now()) {
  const current = store().get(key);
  if (!current) return;

  if (current.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.blockedUntil - now) / 1000));
    const error = new Error("관리자 인증 시도가 잠시 차단되었습니다.") as Error & { retryAfterSeconds: number };
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  const failures = current.failures.filter((value) => now - value < WINDOW_MS);
  if (failures.length === 0) store().delete(key);
  else store().set(key, { failures, blockedUntil: 0 });
}

export function recordAdminAuthFailure(key: string, now = Date.now()) {
  const attempts = store();
  const current = attempts.get(key);
  const failures = [...(current?.failures ?? []).filter((value) => now - value < WINDOW_MS), now];
  attempts.set(key, {
    failures,
    blockedUntil: failures.length >= MAX_FAILURES ? now + BLOCK_MS : 0,
  });

  if (attempts.size > MAX_TRACKED_KEYS) {
    const oldestKey = attempts.keys().next().value;
    if (oldestKey) attempts.delete(oldestKey);
  }
}

export function clearAdminAuthFailures(key: string) {
  store().delete(key);
}

export function resetAdminAuthRateLimitForTests() {
  store().clear();
}

export const ADMIN_AUTH_RATE_LIMIT = {
  windowMs: WINDOW_MS,
  maxFailures: MAX_FAILURES,
  blockMs: BLOCK_MS,
} as const;
