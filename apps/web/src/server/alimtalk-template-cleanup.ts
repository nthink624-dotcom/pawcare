import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";

type CleanupState = "stopped" | "review_cancelled" | "manual_review" | "unknown";
const states = new Set<CleanupState>(["stopped", "review_cancelled", "manual_review", "unknown"]);

export async function runRetiredAlimtalkCleanup() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Template cleanup storage unavailable");
  const runId = randomUUID();
  const claimed = await admin.rpc("claim_alimtalk_template_cleanup", { p_run: runId, p_limit: 20 });
  if (claimed.error || !claimed.data) throw new Error("Template cleanup claim failed");
  const counts = { processed: 0, stopped: 0, review_cancelled: 0, manual_review: 0, unknown: 0 };
  for (let index = 0; index < claimed.data.length; index += 4) {
    await Promise.all(claimed.data.slice(index, index + 4).map(async (job: { template_code: string; attempts: number }) => {
      const ownership = await admin.from("alimtalk_template_registry").select("scope,retired_at").eq("template_code", job.template_code).maybeSingle();
      if (ownership.error || !ownership.data || ownership.data.scope !== "shop" || !ownership.data.retired_at) throw new Error("Invalid cleanup ownership");
      let state: CleanupState = "unknown";
      try {
        const base = serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl;
        if (!base || !serverEnv.alimtalkRelaySecret) throw new Error("Cleanup relay unavailable");
        const url = new URL(base); url.pathname = "/admin/templates/retire"; url.search = ""; url.hash = "";
        const response = await fetch(url, {
          method: "POST", headers: { "x-relay-secret": serverEnv.alimtalkRelaySecret, "Content-Type": "application/json" },
          body: JSON.stringify({ templateCode: job.template_code }), cache: "no-store", signal: AbortSignal.timeout(55_000),
        });
        if (response.ok) {
          const body = await response.json() as { ok?: boolean; state?: CleanupState };
          if (body.ok && body.state && states.has(body.state)) state = body.state;
        }
      } catch { /* Uncertain provider outcomes require fresh readback on a later leased attempt, never immediate replay. */ }
      if (state === "unknown" && job.attempts >= 6) state = "manual_review";
      const saved = await admin.rpc("finish_alimtalk_template_cleanup", { p_run: runId, p_code: job.template_code, p_state: state });
      if (saved.error || saved.data !== true) throw new Error("Template cleanup receipt failed");
      counts.processed++; counts[state]++;
    }));
  }
  return counts;
}
