import "server-only";
import { z } from "zod";
import { readCustomerConsentState } from "@/server/customer-consent-state";
import { actOnPreparation, getPreparation, initializePreparation } from "@/server/booking-preparation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, type OwnerShopContext } from "@/server/owner-api-auth";

const choiceSchema = z.object({
  decision: z.enum(["send", "recognize"]),
  policyVersion: z.number().int().positive(),
  documents: z.array(z.object({ id: z.string().min(1), version: z.number().int().positive() })).max(100),
});
type Actor = Pick<OwnerShopContext, "shopId" | "userId" | "role">;
type Identity = { guardianId: string; petId: string };

/** Validate before saving a booking; never accept a client-supplied signed status. */
export async function validateOwnerBookingConsentChoice(actor: Actor, identity: Identity, raw: unknown, newlyCreated = false) {
  if (raw == null) return null; // Safe default for existing API consumers: request, never waive.
  const choice = choiceSchema.parse(raw);
  if (choice.decision === "send") return null;
  if (newlyCreated || actor.role !== "owner") throw new OwnerApiError("기존 동의 인정은 기존 고객의 문서를 오너가 확인해 주세요.", 403);
  const state = await readCustomerConsentState(actor.shopId, identity.guardianId, identity.petId);
  const eligible = state.documents.filter(doc => doc.scope === "pet" && doc.status === "pending");
  if (!state.enabled || state.policyVersion !== choice.policyVersion || !choice.documents.length
    || choice.documents.some(doc => !eligible.some(t => t.id === doc.id && t.version === doc.version))) {
    throw new OwnerApiError("동의서 설정이 변경되었습니다. 현재 문서를 다시 확인해 주세요.", 409);
  }
  return choice;
}

/** Reuse the existing recognition RPC and preparation request/dispatch ledger. */
export async function processOwnerBookingConsent(actor: Actor, identity: Identity & { id: string }, choice: Awaited<ReturnType<typeof validateOwnerBookingConsentChoice>>) {
  try {
    if (choice) {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error("동의서 저장소를 확인할 수 없습니다.");
      const result = await admin.rpc("pm_record_consent_recognitions", { p_shop: actor.shopId, p_guardian: identity.guardianId, p_pet: identity.petId, p_actor: actor.userId, p_policy_version: choice.policyVersion, p_documents: choice.documents });
      if (result.error) throw new Error("동의서 설정이 변경되어 기존 동의를 인정하지 못했습니다. 고객 상세에서 다시 확인해 주세요.");
    }
    const state = await readCustomerConsentState(actor.shopId, identity.guardianId, identity.petId, identity.id);
    if (!state.enabled || !state.documents.some(doc => doc.status === "pending")) return;
    let prep;
    try { prep = await getPreparation(actor.shopId, identity.id, true); }
    catch (error) { if (!(error instanceof OwnerApiError && error.status === 404)) throw error; prep = await initializePreparation(actor.shopId, identity.id); }
    if (prep.data.requests.some(r => r.purposes.includes("consent"))) return;
    await actOnPreparation(prep, { action: "request_guidance", version: prep.version, consent: true, deposit: false }, { kind: "owner", userId: actor.userId });
  } catch (error) {
    // The booking already exists. Never turn a failed notification into a failed
    // booking response (which would encourage duplicate reservation submissions).
    // Persist a safe failure if the preparation is available; leave consent pending.
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const saved = await admin.from("booking_preparations").select("version,data").eq("shop_id", actor.shopId).eq("appointment_id", identity.id).maybeSingle();
    if (!saved.data || saved.error) { console.error("[owner-consent] preparation unavailable", { appointmentId: identity.id }); return; }
    const data = structuredClone(saved.data.data);
    if (data.requests.some((r: { purposes: string[] }) => r.purposes.includes("consent"))) return;
    data.requests.push({ id: crypto.randomUUID(), at: new Date().toISOString(), purposes: ["consent"], status: "failed", reason: error instanceof OwnerApiError && error.status === 409 ? "동의서 상태가 변경되었습니다. 작성 링크에서 현재 문서를 확인해 주세요." : "동의서 요청을 완료하지 못했습니다. 고객 상세에서 동의 상태를 확인하고 작성 링크를 전달해 주세요." });
    const result = await admin.rpc("save_booking_preparation", { p_shop: actor.shopId, p_appointment: identity.id, p_version: saved.data.version, p_data: data, p_status: null, p_rule: null, p_preferences: null });
    if (result.error) console.error("[owner-consent] request failure could not be recorded", { appointmentId: identity.id });
  }
}
