import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRelayTemplateCatalog } from "@/server/alimtalk-approved-template";
import { syncShopAlimtalkApprovals } from "@/server/alimtalk-approval-notices";
import { readActiveAlimtalkCodes, readPlatformAlimtalkCodes } from "@/server/alimtalk-template-ownership";

/** Resumes between invocations, never advances past a failed page, and never sends a message. */
export async function runAlimtalkApprovalSync(budgetMs = 240_000) {
  const started = Date.now(), runId = randomUUID();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Approval storage unavailable");
  const claimed = await admin.rpc("claim_alimtalk_approval_job", { p_run: runId });
  if (claimed.error) throw new Error("Approval job claim failed");
  if (!claimed.data?.acquired) return { runId, skipped: true, processed: 0, complete: false };
  let afterShop: string | null = claimed.data.afterShop ?? null;
  let processed = 0, complete = false;
  const checkpoint = async (release: boolean) => {
    const result = await admin.rpc("advance_alimtalk_approval_job", { p_run: runId, p_after: afterShop, p_release: release });
    if (result.error || result.data !== true) throw new Error("Approval job checkpoint failed");
  };
  try {
    const platformCodes = await readPlatformAlimtalkCodes(true);
    while (Date.now() - started < budgetMs) {
      let query = admin.from("shops").select("id").order("id").limit(50);
      if (afterShop) query = query.gt("id", afterShop);
      const page = await query;
      if (page.error || !page.data) throw new Error("Approval shops unavailable");
      if (!page.data.length) { afterShop = null; complete = true; break; }
      const active = await readActiveAlimtalkCodes(page.data.map(row => row.id));
      const catalog = await getRelayTemplateCatalog([...platformCodes, ...active.map(row => row.template_code)]);
      if (!catalog?.allTemplates || catalog.providerStatus?.connected === false) throw new Error("Approval provider unavailable");
      // Bounded concurrency. Any failure preserves the last fully completed page for a safe retry.
      for (let index = 0; index < page.data.length; index += 10) {
        const results = await Promise.allSettled(page.data.slice(index, index + 10).map(row => syncShopAlimtalkApprovals(row.id, catalog)));
        if (results.some(result => result.status === "rejected")) throw new Error("Approval shop synchronization failed");
      }
      afterShop = page.data[page.data.length - 1].id;
      processed += page.data.length;
      await checkpoint(false);
    }
    await checkpoint(true);
    return { runId, skipped: false, processed, complete };
  } catch (error) {
    // Preserve cursor even on failure. Lost leases must not be overwritten.
    await checkpoint(true);
    throw error;
  }
}
