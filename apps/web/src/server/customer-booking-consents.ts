import "server-only";

import { readOptionalBookingPolicy } from "@/server/booking-preparation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { phoneNormalize } from "@/lib/utils";
import type { ConsentTemplate } from "@petmanager/shared/contracts/booking-preparation";

export type CustomerBookingConsentPreview = {
  enabled: boolean;
  legacyGrace: boolean;
  documents: Array<Pick<ConsentTemplate, "id" | "version" | "title" | "body" | "scope">>;
};

export type CustomerBookingConsentLookup = {
  shopId: string;
  guardianName: string;
  phone: string;
  petName: string;
};

function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
}

export async function previewCustomerBookingConsents(input: CustomerBookingConsentLookup): Promise<CustomerBookingConsentPreview> {
  const setting = await readOptionalBookingPolicy(input.shopId);
  const policy = setting?.policy;
  const active = policy?.consentBeforeStart
    ? policy.templates.filter(template => template.enabled && !template.archivedAt)
    : [];
  if (!active.length) return { enabled: false, legacyGrace: false, documents: [] };

  const admin = getSupabaseAdmin();
  if (!admin) return { enabled: false, legacyGrace: false, documents: [] };
  const guardians = await admin.from("guardians").select("id,name,phone").eq("shop_id", input.shopId).is("deleted_at", null).limit(10000);
  if (guardians.error) throw new Error("고객 정보를 확인하지 못했습니다.");
  const phone = phoneNormalize(input.phone);
  const guardian = (guardians.data ?? []).find(row => phoneNormalize(row.phone ?? "") === phone && normalizeName(row.name ?? "") === normalizeName(input.guardianName));
  if (!guardian) return { enabled: true, legacyGrace: false, documents: active.map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })) };

  const pets = await admin.from("pets").select("id,name").eq("shop_id", input.shopId).eq("guardian_id", guardian.id).limit(1000);
  if (pets.error) throw new Error("반려동물 정보를 확인하지 못했습니다.");
  const pet = (pets.data ?? []).find(row => normalizeName(row.name ?? "") === normalizeName(input.petName));
  if (!pet) return { enabled: true, legacyGrace: false, documents: active.map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })) };

  const [preparations, imported, appointmentVisits, groomingVisits] = await Promise.all([
    admin.from("booking_preparations").select("data").eq("shop_id", input.shopId).eq("guardian_id", guardian.id).eq("pet_id", pet.id).limit(1000),
    admin.from("pet_consent_import_status").select("status").eq("shop_id", input.shopId).eq("pet_id", pet.id).maybeSingle(),
    admin.from("appointments").select("id", { head: true, count: "exact" }).eq("shop_id", input.shopId).eq("guardian_id", guardian.id).eq("pet_id", pet.id).in("status", ["completed", "in_progress", "almost_done"]),
    admin.from("grooming_records").select("id", { head: true, count: "exact" }).eq("shop_id", input.shopId).eq("guardian_id", guardian.id).eq("pet_id", pet.id),
  ]);
  for (const result of [preparations, imported, appointmentVisits, groomingVisits]) if (result.error) throw new Error("동의서 상태를 확인하지 못했습니다.");

  const past = (preparations.data ?? []).flatMap(row => Array.isArray(row.data?.consents) ? row.data.consents : []);
  const legacyCustomer = Boolean(imported.data) || Boolean(appointmentVisits.count) || Boolean(groomingVisits.count);
  const documents = active.filter(template => {
    if (template.scope === "appointment") return true;
    const sameTemplate = past.filter((record: { id?: string; status?: string; version?: number }) => record.id === template.id && ["signed", "recognized"].includes(record.status ?? ""));
    if (sameTemplate.some((record: { status?: string; version?: number }) => record.status === "signed" && record.version === template.version)) return false;
    const priorAccepted = past.some((record: { status?: string }) => ["signed", "recognized"].includes(record.status ?? "")) || imported.data?.status === "recognized";
    if (priorAccepted && template.reconsentExisting === false) return false;
    return true;
  });
  const legacyGrace = !imported.data && legacyCustomer && documents.length > 0 && documents.every(template => template.scope === "pet"
    && !(past.some((record: { status?: string }) => ["signed", "recognized"].includes(record.status ?? ""))
      || (imported.data?.status === "recognized" && template.reconsentExisting !== false)));
  return { enabled: true, legacyGrace, documents: legacyGrace ? [] : documents.map(({ id, version, title, body, scope }) => ({ id, version, title, body, scope })) };
}
