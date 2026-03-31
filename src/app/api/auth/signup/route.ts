import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildOwnerAuthEmail,
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";

const signupSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
  name: z.string().min(1),
  birthDate: z.string().min(8).max(8),
  shopName: z.string().min(1),
  shopAddress: z.string().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean(),
    marketing: z.boolean(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 필요합니다." }, { status: 503 });
    }

    const payload = signupSchema.parse(await request.json());
    const loginId = normalizeOwnerLoginId(payload.loginId);

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json({ message: "아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요." }, { status: 400 });
    }

    if (!isValidOwnerPassword(payload.password)) {
      return NextResponse.json({ message: ownerPasswordRuleMessage }, { status: 400 });
    }

    if (payload.password !== payload.passwordConfirm) {
      return NextResponse.json({ message: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 8자리 숫자로 입력해 주세요." }, { status: 400 });
    }

    if (!payload.agreements.service || !payload.agreements.privacy) {
      return NextResponse.json({ message: "필수 약관에 모두 동의해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 연결을 확인해 주세요." }, { status: 503 });
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (duplicate.data?.login_id) {
      return NextResponse.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    const authEmail = buildOwnerAuthEmail(loginId);
    const createdUser = await supabase.auth.admin.createUser({
      email: authEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        login_id: loginId,
        name: payload.name,
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      const message = createdUser.error?.message || "회원가입을 완료하지 못했습니다.";
      return NextResponse.json({ message: message.includes("already") ? "이미 사용 중인 아이디입니다." : message }, { status: 400 });
    }

    const user = createdUser.data.user;
    const shopId = `shop-${randomUUID().slice(0, 8)}`;

    const shopInsert = await supabase.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: "미입력",
      address: payload.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      approval_mode: "manual",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    if (shopInsert.error) {
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "매장 정보를 생성하지 못했습니다." }, { status: 400 });
    }

    const profileInsert = await supabase.from("owner_profiles").insert({
      user_id: user.id,
      shop_id: shopId,
      login_id: loginId,
      name: payload.name,
      birth_date: payload.birthDate,
      agreements: payload.agreements,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    if (profileInsert.error) {
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "회원 프로필을 생성하지 못했습니다." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "회원가입이 완료되었습니다." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: error instanceof Error ? error.message : "회원가입에 실패했습니다." }, { status: 400 });
  }
}
