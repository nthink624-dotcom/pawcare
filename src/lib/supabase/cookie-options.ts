import { getSupabaseRuntimeStage } from "@/lib/env";

function shouldUseProductionCookieDomain() {
  if (getSupabaseRuntimeStage() !== "production") {
    return false;
  }

  if (typeof window !== "undefined") {
    return window.location.hostname === "petmanager.co.kr" || window.location.hostname.endsWith(".petmanager.co.kr");
  }

  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function getSupabaseCookieOptions(options?: { secure?: boolean }) {
  const browserSecure =
    typeof window !== "undefined" ? window.location.protocol === "https:" : undefined;
  const secure = options?.secure ?? browserSecure ?? getSupabaseRuntimeStage() === "production";
  const productionOptions =
    shouldUseProductionCookieDomain()
      ? {
          domain: ".petmanager.co.kr",
          secure,
        }
      : {};

  return {
    path: "/",
    sameSite: "lax" as const,
    ...productionOptions,
  };
}
