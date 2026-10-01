import { NextResponse } from "next/server";

import { getReleaseId, getRequestId } from "@/lib/observability";
import { logOperationalEvent } from "@/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  let supabaseStatus: "ok" | "failed" = "failed";

  try {
    // Keep optional provider configuration failures inside the readiness
    // response instead of failing during route module evaluation.
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      try {
        const result = await supabase.from("shops").select("id").limit(1).abortSignal(controller.signal);
        supabaseStatus = result.error ? "failed" : "ok";
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
    logOperationalEvent("readiness.supabase_failed", {
      requestId,
      route: "/api/readyz",
      status: 503,
      operation: "health_check",
    });
  }

  const ready = supabaseStatus === "ok";
  return NextResponse.json(
    { status: ready ? "ok" : "not_ready", checks: { supabase: { status: supabaseStatus } }, requestId, release: getReleaseId() },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0", "x-request-id": requestId },
    },
  );
}
