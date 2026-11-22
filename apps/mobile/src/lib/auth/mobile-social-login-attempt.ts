import { getSafeNextPath } from "./safe-next-path";

const ATTEMPT_KEY = "petmanager.ownerSocialLoginAttempt";
const ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;
const MOBILE_LOGIN_PATH = "/auth/social/callback/";
const NATIVE_CALLBACK_ORIGIN = "kr.petmanager.owner://auth";
const FALLBACK_PATH = "/owner/mobile";
const NONCE = /^[a-f0-9]{32}$/;

export function getMobileSocialNextPath(value: string | undefined) {
  const candidate = getSafeNextPath(value, FALLBACK_PATH);
  const normalized = new URL(candidate, "https://petmanager.invalid");
  return normalized.pathname === "/owner" || normalized.pathname.startsWith("/owner/")
    ? `${normalized.pathname}${normalized.search}${normalized.hash}`
    : FALLBACK_PATH;
}

export function cancelMobileSocialAttempt(storage: Storage) {
  try { storage.removeItem(ATTEMPT_KEY); } catch { /* Unavailable storage cannot contain a usable attempt. */ }
}

export function beginMobileSocialAttempt(storage: Storage, nextPath: string, webOrigin?: string) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  const redirectTo = `${webOrigin ?? NATIVE_CALLBACK_ORIGIN}${MOBILE_LOGIN_PATH}${nonce}`;
  storage.setItem(ATTEMPT_KEY, JSON.stringify({ nonce, nextPath: getMobileSocialNextPath(nextPath), startedAt: Date.now() }));
  return redirectTo;
}

export function consumeMobileSocialReturn(url: string, storage: Storage, webOrigin?: string) {
  try {
    const returned = new URL(url);
    if (returned.username || returned.password) return null;
    if (webOrigin ? returned.origin !== webOrigin : returned.protocol !== "kr.petmanager.owner:" || returned.host !== "auth") return null;
    if (!returned.pathname.startsWith(MOBILE_LOGIN_PATH)) return null;
    const nonce = returned.pathname.slice(MOBILE_LOGIN_PATH.length);
    if (!NONCE.test(nonce)) return null;

    const attempt = JSON.parse(storage.getItem(ATTEMPT_KEY) || "null");
    if (!attempt || attempt.nonce !== nonce) return null;
    storage.removeItem(ATTEMPT_KEY);
    if (!Number.isFinite(attempt.startedAt) || attempt.startedAt > Date.now() || Date.now() - attempt.startedAt > ATTEMPT_MAX_AGE_MS) return null;

    const nextPath = getMobileSocialNextPath(typeof attempt.nextPath === "string" ? attempt.nextPath : undefined);
    const fragment = new URLSearchParams(returned.hash.slice(1));
    const error = returned.searchParams.get("error") || fragment.get("error");
    const errorCode = returned.searchParams.get("error_code") || fragment.get("error_code");
    if (error || errorCode) return { nextPath, error: error === "access_denied" || errorCode === "access_denied" ? "social-cancelled" : "social-failed" } as const;
    const codes = returned.searchParams.getAll("code");
    if (returned.hash || codes.length !== 1 || !/^[a-zA-Z0-9_-]{1,256}$/.test(codes[0])) return { nextPath, error: "social-failed" } as const;
    return { nextPath, code: codes[0] } as const;
  } catch {
    return null;
  }
}
