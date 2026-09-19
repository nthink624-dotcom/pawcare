import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || PETMANAGER_SERVICE_NAME,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseEnvName:
    process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME ||
    ((process.env.NEXT_PUBLIC_SITE_URL || "").includes("petmanager.co.kr") ? "production" : "development"),
  allowProdSupabaseInDev: process.env.NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV === "true",
  portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  portoneIdentityUnifiedChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_UNIFIED_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  portoneIdentityPhoneChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_PHONE_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_DANAL_CHANNEL_KEY,
  portoneIdentityDanalChannelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_DANAL_CHANNEL_KEY,
  portoneIdentityChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  portonePaymentChannelKey: process.env.NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY,
  portoneKakaoPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY,
  portoneNaverPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_NAVERPAY_CHANNEL_KEY,
  portoneBillingChannelKey: process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
};

const DEVELOPMENT_API_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

const PRODUCTION_API_ORIGINS = new Set([
  "https://app.petmanager.co.kr",
  "https://petmanager.co.kr",
  "https://www.petmanager.co.kr",
]);

const MAX_API_PATH_DECODE_PASSES = 4;
const UNSAFE_API_PATH_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\\]/u;
const ENCODED_API_PATH_SEPARATOR = /%(?:2f|5c)/i;

function parseOriginOnly(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} 주소 형식을 확인해 주세요.`);
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${label}에는 원점 주소만 사용할 수 있습니다.`);
  }

  return url.origin;
}

export function getMobileApiOrigin() {
  const runtimeStage = getSupabaseRuntimeStage();
  const configured = env.apiBaseUrl.trim();
  const candidate = configured || (runtimeStage === "development" ? "http://127.0.0.1:3000" : "");

  if (!candidate) {
    throw new Error("운영 API 원점 설정을 확인해 주세요.");
  }

  const origin = parseOriginOnly(candidate, "API");
  const allowedOrigins = runtimeStage === "development" ? DEVELOPMENT_API_ORIGINS : PRODUCTION_API_ORIGINS;

  if (!allowedOrigins.has(origin)) {
    throw new Error("허용되지 않은 API 원점입니다.");
  }

  if (runtimeStage !== "development" && !origin.startsWith("https://")) {
    throw new Error("운영 API는 HTTPS 원점만 사용할 수 있습니다.");
  }

  return origin;
}

function assertMobileApiPathnameStage(pathname: string, origin: string) {
  if (
    !pathname.startsWith("/api/") ||
    pathname.startsWith("//") ||
    UNSAFE_API_PATH_CHARACTERS.test(pathname) ||
    ENCODED_API_PATH_SEPARATOR.test(pathname) ||
    pathname.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("API 요청 경로를 확인해 주세요.");
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(pathname, `${origin}/`);
  } catch {
    throw new Error("API 요청 경로를 확인해 주세요.");
  }

  if (normalizedUrl.origin !== origin || !normalizedUrl.pathname.startsWith("/api/")) {
    throw new Error("API 요청 경로를 확인해 주세요.");
  }
}

function assertSafeMobileApiPathname(rawPathname: string, origin: string) {
  let candidate = rawPathname;

  for (let pass = 0; pass <= MAX_API_PATH_DECODE_PASSES; pass += 1) {
    assertMobileApiPathnameStage(candidate, origin);

    const normalized = candidate.normalize("NFKC");
    const separatorCount = candidate.split("/").length;
    if (normalized.split("/").length !== separatorCount) {
      throw new Error("API 요청 경로를 확인해 주세요.");
    }
    assertMobileApiPathnameStage(normalized, origin);

    let decoded: string;
    try {
      decoded = decodeURIComponent(normalized);
    } catch {
      throw new Error("API 요청 경로를 확인해 주세요.");
    }

    if (decoded === normalized) return;
    if (pass === MAX_API_PATH_DECODE_PASSES) {
      throw new Error("API 요청 경로를 확인해 주세요.");
    }
    candidate = decoded;
  }
}

export function buildMobileApiUrl(path: string) {
  const pathnameEnd = path.search(/[?#]/);
  const rawPathname = pathnameEnd === -1 ? path : path.slice(0, pathnameEnd);
  const origin = getMobileApiOrigin();
  assertSafeMobileApiPathname(rawPathname, origin);

  let url: URL;
  try {
    url = new URL(path, `${origin}/`);
  } catch {
    throw new Error("API 요청 경로를 확인해 주세요.");
  }
  if (url.origin !== origin) {
    throw new Error("API 요청 원점을 확인해 주세요.");
  }
  assertSafeMobileApiPathname(url.pathname, origin);

  return url.toString();
}

export function hasSupabaseBrowserEnv() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function hasPortoneBrowserEnv() {
  return Boolean(env.portoneStoreId && (env.portoneIdentityUnifiedChannelKey || env.portoneIdentityPhoneChannelKey));
}

export function hasPortonePaymentBrowserEnv() {
  return Boolean(
    env.portoneStoreId &&
      (env.portonePaymentChannelKey || env.portoneKakaoPayChannelKey || env.portoneNaverPayChannelKey),
  );
}

export function getSupabaseRuntimeStage() {
  if (typeof window === "undefined") {
    if (process.env.VERCEL_ENV === "production") return "production" as const;
    if (process.env.VERCEL_ENV === "preview") return "preview" as const;
  }

  const configuredHostname = (() => {
    try {
      return new URL(env.siteUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "development" as const;
    }
    if (configuredHostname && hostname === configuredHostname) {
      return "production" as const;
    }
    if (hostname.endsWith(".vercel.app")) {
      return "preview" as const;
    }
    return "production" as const;
  }

  if (configuredHostname === "localhost" || configuredHostname === "127.0.0.1") {
    return "development" as const;
  }
  if (configuredHostname.endsWith(".vercel.app") && process.env.VERCEL_ENV === "preview") {
    return "preview" as const;
  }
  return "production" as const;
}

export function isUnsafeProdSupabaseBrowserEnv() {
  return getSupabaseRuntimeStage() !== "production" && env.supabaseEnvName === "production" && !env.allowProdSupabaseInDev;
}
