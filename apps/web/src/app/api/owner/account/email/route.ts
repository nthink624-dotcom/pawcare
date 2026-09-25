import { NextRequest } from "next/server";
import { z } from "zod";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { OwnerProfile } from "@/types/domain";

const schema = z.object({
  shopId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  currentPassword: z.string().min(1),
});

function toEmailChangeError(error: { message?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();
  if (message.includes("already") || message.includes("duplicate") || message.includes("unique")) {
    return "이미 사용 중인 이메일입니다.";
  }
  return "로그인 이메일을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      throw new OwnerApiError("로그인 이메일 변경 환경을 확인하지 못했습니다.", 503);
    }

    const body = schema.parse(await request.json());
    const email = normalizeOwnerEmail(body.email);
    if (!isValidOwnerEmail(email)) {
      throw new OwnerApiError("올바른 이메일 주소를 입력해 주세요.", 400);
    }

    const owner = await requireOwnerShop(request, body.shopId);
    if (!owner.userId || owner.role !== "owner") {
      throw new OwnerApiError("오너 계정만 로그인 이메일을 변경할 수 있습니다.", 403);
    }

    const admin = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();
    if (!admin || !authClient) {
      throw new OwnerApiError("로그인 이메일 변경 환경을 확인하지 못했습니다.", 503);
    }

    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
      .eq("user_id", owner.userId)
      .eq("shop_id", owner.shopId)
      .maybeSingle<OwnerProfile>();

    if (profileResult.error) {
      throw new OwnerApiError("로그인 이메일을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }
    if (!profileResult.data?.login_id) {
      throw new OwnerApiError("오너 프로필을 찾지 못했습니다.", 404);
    }

    const currentEmail = normalizeOwnerEmail(profileResult.data.login_id);
    if (email === currentEmail) {
      return ownerMobileCorsJson(request, { success: true, profile: profileResult.data });
    }

    const passwordCheck = await authClient.auth.signInWithPassword({
      email: currentEmail,
      password: body.currentPassword,
    });
    if (passwordCheck.error || passwordCheck.data.user?.id !== owner.userId) {
      throw new OwnerApiError("현재 비밀번호를 다시 확인해 주세요.", 401);
    }

    const duplicateResult = await admin
      .from("owner_profiles")
      .select("user_id")
      .eq("login_id", email)
      .neq("user_id", owner.userId)
      .maybeSingle<{ user_id: string }>();
    if (duplicateResult.error) {
      throw new OwnerApiError("로그인 이메일 중복 여부를 확인하지 못했습니다.", 500);
    }
    if (duplicateResult.data?.user_id) {
      throw new OwnerApiError("이미 사용 중인 이메일입니다.", 409);
    }

    const authUserResult = await admin.auth.admin.getUserById(owner.userId);
    if (authUserResult.error || !authUserResult.data.user) {
      throw new OwnerApiError("오너 인증 정보를 확인하지 못했습니다.", 500);
    }

    const updatedAuth = await admin.auth.admin.updateUserById(owner.userId, {
      email,
      email_confirm: true,
      user_metadata: {
        ...(authUserResult.data.user.user_metadata ?? {}),
        login_id: email,
      },
    });
    if (updatedAuth.error) {
      throw new OwnerApiError(toEmailChangeError(updatedAuth.error), 400);
    }

    const updatedAt = new Date().toISOString();
    const updatedProfileResult = await admin
      .from("owner_profiles")
      .update({ login_id: email, updated_at: updatedAt })
      .eq("user_id", owner.userId)
      .eq("shop_id", owner.shopId)
      .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
      .single<OwnerProfile>();

    if (updatedProfileResult.error) {
      await admin.auth.admin.updateUserById(owner.userId, {
        email: currentEmail,
        email_confirm: true,
        user_metadata: authUserResult.data.user.user_metadata ?? {},
      });
      throw new OwnerApiError("로그인 이메일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }

    return ownerMobileCorsJson(request, { success: true, profile: updatedProfileResult.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "로그인 이메일과 현재 비밀번호를 다시 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }
    return ownerMobileCorsJson(request, { message: "로그인 이메일을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
