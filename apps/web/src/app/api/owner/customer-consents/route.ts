import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerShop, assertOwnerOrManager, OwnerApiError } from "@/server/owner-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readCustomerConsentState } from "@/server/customer-consent-state";

const headers = { "Cache-Control": "private, no-store" };
const identity = z.object({ shopId: z.string().min(1), guardianId: z.string().uuid(), petId: z.string().uuid() });
function failure(error: unknown) { return NextResponse.json({ message: error instanceof OwnerApiError ? error.message : "동의서 처리 내용을 확인해 주세요." }, { status: error instanceof OwnerApiError ? error.status : 400, headers }); }
export async function GET(request: NextRequest) {
  try {
    const input = identity.parse(Object.fromEntries(request.nextUrl.searchParams));
    const owner = await requireOwnerShop(request, input.shopId); assertOwnerOrManager(owner);
    return NextResponse.json(await readCustomerConsentState(owner.shopId, input.guardianId, input.petId), { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    const input = identity.extend({ policyVersion: z.number().int().positive(), templateId: z.string().min(1), templateVersion: z.number().int().positive(), confirmedExistingConsent: z.literal(true) }).parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    if (owner.role !== "owner") throw new OwnerApiError("기존 동의 인정은 오너가 확인해 주세요.", 403);
    const admin = getSupabaseAdmin(); if (!admin) throw new OwnerApiError("동의서 저장소를 확인할 수 없습니다.", 503);
    const result = await admin.rpc("pm_record_consent_recognitions", { p_shop: owner.shopId, p_guardian: input.guardianId, p_pet: input.petId, p_actor: owner.userId, p_policy_version: input.policyVersion, p_documents: [{ id: input.templateId, version: input.templateVersion }] });
    if (result.error) throw new OwnerApiError(result.error.message.includes("CONSENT_") ? "동의서 또는 고객 정보가 변경되었습니다. 다시 확인해 주세요. 예약마다 작성하는 문서는 기존 동의로 인정할 수 없습니다." : "기존 동의 인정을 저장하지 못했습니다.", 409);
    return NextResponse.json(await readCustomerConsentState(owner.shopId, input.guardianId, input.petId), { headers });
  } catch (e) { return failure(e); }
}
