import { getSupabaseRuntimeStage } from "@/lib/env";

export function getSupabaseCookieOptions(options?: { secure?: boolean }) {
  const browserSecure =
    typeof window !== "undefined" ? window.location.protocol === "https:" : undefined;
  const secure = options?.secure ?? browserSecure ?? getSupabaseRuntimeStage() === "production";
  const productionOptions =
    getSupabaseRuntimeStage() === "production"
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
