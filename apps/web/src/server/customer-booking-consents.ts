import "server-only";

import { readOptionalBookingPolicy } from "@/server/booking-preparation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { phoneNormalize } from "@/lib/utils";
import { readCustomerConsentState } from "@/server/customer-consent-state";
import type { ConsentTemplate, CustomerBookingDepositOptions } from "@petmanager/shared/contracts/booking-preparation";
import type { Appointment, Guardian } from "@/types/domain";

export type CustomerBookingConsentPreview = {
  enabled: boolean;
  legacyGrace: boolean;
  documents: Array<Pick<ConsentTemplate, "id" | "version" | "title" | "body" | "scope">>;
  depositOptions: CustomerBookingDepositOptions;
};

type CustomerBookingIdentity = Pick<CustomerBookingConsentLookup, "shopId" | "guardianName" | "phone" | "appointmentDate">;
type CustomerBookingSnapshot = {
  guardians: Guardian[];
  appointments: Appointment[];
};

export type CustomerBookingConsentLookup = {
  appointmentDate?: string;
  shopId: string;
  guardianName: string;
  phone: string;
  petName: string;
};

function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
}

function noDepositOptions(): CustomerBookingDepositOptions {
  return { eligible: false, required: false, selectable: false, amount: 0, holdMinutes: 20, bankName: "", bankAccount: "", bankHolder: "" };
}

export async function resolveCustomerBookingDepositOptions(
  input: CustomerBookingIdentity,
  settingOverride?: Awaited<ReturnType<typeof readOptionalBookingPolicy>>,
  _snapshot?: CustomerBookingSnapshot,
): Promise<CustomerBookingDepositOptions> {
  const setting = settingOverride === undefined ? await readOptionalBookingPolicy(input.shopId) : settingOverride;
  if (!setting) return noDepositOptions();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("예약금 적용 여부를 확인할 수 없습니다.");
  const result = await admin.rpc("pm_deposit_preview", {
    p_shop: input.shopId, p_name: input.guardianName, p_phone: input.phone,
    ...(input.appointmentDate ? { p_date: input.appointmentDate } : {}),
  });
  if (result.error) throw new Error("고객의 예약금 적용 여부를 확인하지 못했습니다.");
  return result.data as CustomerBookingDepositOptions;
}

export async function previewCustomerBookingConsents(
  input: CustomerBookingConsentLookup,
  settingOverride?: Awaited<ReturnType<typeof readOptionalBookingPolicy>>,
  snapshot?: CustomerBookingSnapshot,
): Promise<CustomerBookingConsentPreview> {
  const setting = settingOverride === undefined ? await readOptionalBookingPolicy(input.shopId) : settingOverride;
  const policy = setting?.policy;
  const depositOptions = await resolveCustomerBookingDepositOptions(input, setting, snapshot);
  const active = policy?.consentBeforeStart
    ? policy.templates.filter(template => template.enabled && !template.archivedAt)
    : [];
  if (!active.length) return { enabled: false, legacyGrace: false, documents: [], depositOptions };

  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("동의서 상태를 확인할 수 없습니다.");
  const phone = phoneNormalize(input.phone);
  const guardianRows = snapshot ? null : await admin.from("guardians").select("id,name,phone").eq("shop_id", input.shopId).is("deleted_at", null).limit(10000);
  if (guardianRows?.error) throw new Error("고객 정보를 확인하지 못했습니다.");
  const matchingGuardians = (snapshot?.guardians ?? guardianRows?.data ?? []).filter(row => !('deleted_at' in row && row.deleted_at) && phoneNormalize(row.phone ?? "") === phone
    && normalizeName(row.name ?? "") === normalizeName(input.guardianName));
  if (matchingGuardians.length > 1) throw new Error("같은 이름과 연락처의 고객이 여러 명입니다. 매장에 고객 정보 확인을 요청해 주세요.");
  const guardian = matchingGuardians[0];
  if (!guardian) return { enabled: true, legacyGrace: false, documents: active.map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })), depositOptions };

  const pets = await admin.from("pets").select("id,name").eq("shop_id", input.shopId).eq("guardian_id", guardian.id).limit(1000);
  if (pets.error) throw new Error("반려동물 정보를 확인하지 못했습니다.");
  const matchingPets = (pets.data ?? []).filter(row => normalizeName(row.name ?? "") === normalizeName(input.petName));
  if (matchingPets.length > 1) throw new Error("같은 이름의 반려동물이 여러 마리입니다. 매장에 고객 정보 확인을 요청해 주세요.");
  const pet = matchingPets[0];
  if (!pet) return { enabled: true, legacyGrace: false, documents: active.map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })), depositOptions };

  const state = await readCustomerConsentState(input.shopId, guardian.id, pet.id);
  return { enabled: state.enabled, legacyGrace: false, documents: state.documents
    .filter(document => document.status === "pending")
    .map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })), depositOptions };
}
