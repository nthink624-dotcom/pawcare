import type { NextRequest } from "next/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Cleanup storage unavailable");
    const states = ["pending", "processing", "stopped", "review_cancelled", "manual_review", "unknown"] as const;
    const [counts, review] = await Promise.all([
      Promise.all(states.map(async state => {
        const result = await admin.from("alimtalk_template_cleanup").select("template_code", { count: "exact", head: true }).eq("state", state);
        if (result.error || result.count === null) throw new Error("Cleanup count unavailable");
        return [state, result.count] as const;
      })),
      admin.from("alimtalk_template_cleanup").select("template_code,state,attempts,updated_at").in("state", ["manual_review", "unknown", "review_cancelled"]).order("updated_at", { ascending: false }).limit(100),
    ]);
    if (review.error) throw new Error("Cleanup review unavailable");
    return Response.json({ counts: Object.fromEntries(counts), needsReview: review.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ message: "문구 정리 상태를 확인하지 못했습니다." }, { status: error instanceof AdminApiError ? error.status : 503 });
  }
}
