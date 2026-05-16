import { getSupabaseRuntimeStage } from "@/lib/env";

function shouldUseProductionCookieDomain(hostname?: string) {
  const normalizedHostname = hostname?.toLowerCase();
  if (normalizedHostname) {
    return normalizedHostname === "petmanager.co.kr" || normalizedHostname.endsWith(".petmanager.co.kr");
  }

  if (getSupabaseRuntimeStage() !== "production") {
    return false;
  }

  if (typeof window !== "undefined") {
    return window.location.hostname === "petmanager.co.kr" || window.location.hostname.endsWith(".petmanager.co.kr");
  }

  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function getSupabaseCookieOptions(options?: { secure?: boolean; hostname?: string }) {
  const browserSecure =
    typeof window !== "undefined" ? window.location.protocol === "https:" : undefined;
  const secure = options?.secure ?? browserSecure ?? getSupabaseRuntimeStage() === "production";
  const productionOptions =
    shouldUseProductionCookieDomain(options?.hostname)
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
