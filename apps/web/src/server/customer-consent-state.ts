import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { ConsentRecord } from "@petmanager/shared/contracts/booking-preparation";

export type CustomerConsentState = { enabled: boolean; policyVersion: number; documents: ConsentRecord[]; legacyRecognitionRequiresReview?: boolean };
export async function readCustomerConsentState(shopId: string, guardianId: string, petId: string, appointmentId?: string): Promise<CustomerConsentState> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("동의서 상태를 확인할 수 없습니다.", 503);
  const result = await admin.rpc("pm_customer_consent_state", { p_shop: shopId, p_guardian: guardianId, p_pet: petId, ...(appointmentId ? { p_appointment: appointmentId } : {}) });
  if (result.error) throw new OwnerApiError("동의서 상태를 확인하지 못했습니다. 다시 시도해 주세요.", 503);
  const state = result.data as CustomerConsentState;
  const legacy = await admin.from("pet_consent_import_status").select("status").eq("shop_id", shopId).eq("pet_id", petId).maybeSingle();
  if (legacy.error) throw new OwnerApiError("기존 동의 이관 기록을 확인하지 못했습니다.", 503);
  return { ...state, legacyRecognitionRequiresReview: legacy.data?.status === "recognized" && state.documents.some(doc => doc.scope === "pet" && doc.status === "pending") };
}
