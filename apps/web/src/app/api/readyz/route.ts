import { NextResponse } from "next/server";

import { getReleaseId, getRequestId, logOperationalEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReadinessCheck = {
  status: "ok" | "failed";
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const checks: Record<string, ReadinessCheck> = {};
  // Vercel intentionally redacts sensitive values from CLI exports. Publish only
  // non-secret readiness booleans from the running deployment, never key values.
  const aiFlag = process.env.OPENAI_PRICE_GUIDE_ENABLED;
  const aiModel = process.env.OPENAI_PRICE_GUIDE_MODEL?.trim() || "gpt-5.6-luna";
  const configuration = {
    priceGuideAi: {
      enabled: aiFlag === "true",
      settingValid: aiFlag === undefined || aiFlag === "true" || aiFlag === "false",
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
      modelSupported: ["gpt-5.6-luna", "gpt-6-luna"].includes(aiModel),
    },
  };

  try {
    // Load the server client inside the guarded probe. A malformed optional
    // provider environment must produce a 503 readiness result, not a route
    // module-evaluation 500 that hides the actual dependency failure.
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      checks.supabase = { status: "failed" };
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      try {
        const result = await supabase.from("shops").select("id").limit(1).abortSignal(controller.signal);
        checks.supabase = { status: result.error ? "failed" : "ok" };
        if (result.error) {
          logOperationalEvent("readiness.supabase_query_failed", {
            requestId,
            route: "/api/readyz",
            status: 503,
            operation: "health_check",
            code: result.error.code,
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch {
    checks.supabase = { status: "failed" };
    logOperationalEvent("readiness.supabase_failed", { requestId, route: "/api/readyz", status: 503, operation: "health_check" });
  }

  const ready = Object.values(checks).every((check) => check.status === "ok");
  return NextResponse.json(
    { status: ready ? "ok" : "not_ready", checks, configuration, requestId, release: getReleaseId() },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "x-request-id": requestId,
      },
    },
  );
}
