import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { OwnerProfile } from "@/types/domain";

const updateOwnerProfileSchema = z.object({
  shopId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(60),
  phoneNumber: z.string().trim().max(30).nullable().optional(),
  profileImageUrl: z.string().max(1_200_000).optional(),
});

function normalizePhoneNumber(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d+-]/g, "").trim();
}

export async function PATCH(request: NextRequest) {
  try {
    const body = updateOwnerProfileSchema.parse(await request.json());
    const now = new Date().toISOString();

    if (!hasSupabaseServerEnv()) {
      if (getSupabaseServerRuntimeStage() === "production") {
        throw new OwnerApiError("Supabase 서버 설정이 없어 오너 프로필을 저장할 수 없습니다.", 503);
      }

      return ownerMobileCorsJson(request, {
        profile: {
          user_id: "demo-owner",
          shop_id: body.shopId,
          login_id: "demo-owner",
          name: body.name,
          birth_date: null,
          phone_number: normalizePhoneNumber(body.phoneNumber),
          identity_verified_at: null,
          agreements: {
            profile_image_url: body.profileImageUrl ?? "",
          },
          created_at: now,
          updated_at: now,
        } satisfies OwnerProfile,
      });
    }

    const owner = await requireOwnerShop(request, body.shopId);
    if (!owner.userId) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new OwnerApiError("Supabase 관리자 연결을 확인해 주세요.", 503);
    }

    const currentResult = await admin
      .from("owner_profiles")
      .select("user_id,shop_id,login_id,birth_date,agreements,created_at")
      .eq("user_id", owner.userId)
      .maybeSingle<{
        user_id: string;
        shop_id: string;
        login_id: string;
        birth_date: string | null;
        agreements: Record<string, unknown> | null;
        created_at: string;
      }>();

    if (currentResult.error) {
      throw new OwnerApiError(currentResult.error.message, 500);
    }

    const profilePayload = {
      user_id: owner.userId,
      shop_id: owner.shopId,
      login_id: currentResult.data?.login_id ?? `owner_${owner.userId.replace(/-/g, "")}`,
      name: body.name,
      birth_date: currentResult.data?.birth_date ?? null,
      phone_number: normalizePhoneNumber(body.phoneNumber),
      agreements: {
        ...(currentResult.data?.agreements ?? {}),
        ...(body.profileImageUrl !== undefined ? { profile_image_url: body.profileImageUrl } : {}),
      },
      updated_at: now,
      ...(currentResult.data ? {} : { created_at: now }),
    };

    const result = await admin
      .from("owner_profiles")
      .upsert(profilePayload, { onConflict: "user_id" })
      .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
      .single<OwnerProfile>();

    if (result.error) {
      throw new OwnerApiError(result.error.message, 500);
    }

    return ownerMobileCorsJson(request, { profile: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "오너 프로필 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "오너 프로필을 저장하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
