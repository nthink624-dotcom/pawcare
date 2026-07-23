import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";

const NAVER_PROFILE_URL = "https://openapi.naver.com/v1/nid/me";

const requestSchema = z.object({
  providerToken: z.string().trim().min(1).max(4_000),
});

const naverProfileSchema = z.object({
  resultcode: z.string().optional(),
  response: z
    .object({
      email: z.string().trim().email().optional(),
      name: z.string().trim().min(1).max(100).optional(),
      mobile: z.string().trim().max(40).optional(),
      mobile_e164: z.string().trim().max(40).optional(),
    })
    .optional(),
});

function normalizePhone(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  const domesticDigits = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  return domesticDigits.slice(0, 11);
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const payload = requestSchema.parse(await request.json());
    const authClient = getSupabaseAuthClient();

    if (!accessToken || !authClient) {
      return NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const userResult = await authClient.auth.getUser(accessToken);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const profileResponse = await fetch(NAVER_PROFILE_URL, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${payload.providerToken}` },
    });
    const profilePayload = naverProfileSchema.safeParse(await profileResponse.json());
    const isNaverSuccess = profilePayload.success && profilePayload.data.resultcode === "00";
    const profile = profilePayload.success ? profilePayload.data.response : null;

    if (!profileResponse.ok || !isNaverSuccess || !profile?.email) {
      return NextResponse.json(
        {
          message:
            "네이버에서 이메일 정보를 받지 못했어요. 네이버 계정의 연락처 이메일과 제공 동의 설정을 확인해 주세요.",
        },
        { status: 422 },
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "계정 정보를 저장할 수 없습니다." }, { status: 503 });
    }

    const user = userResult.data.user;
    const name = profile.name || (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "");
    const phone = normalizePhone(profile.mobile_e164 || profile.mobile);
    const updateResult = await admin.auth.admin.updateUserById(user.id, {
      email: profile.email,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        ...(name ? { name } : {}),
        ...(phone ? { phone_number: phone } : {}),
      },
    });

    if (updateResult.error) {
      const status = updateResult.error.message.toLowerCase().includes("already") ? 409 : 500;
      return NextResponse.json({ message: "네이버 계정 정보를 저장하지 못했어요." }, { status });
    }

    return NextResponse.json({
      email: profile.email,
      name,
      phone,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "네이버 로그인 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "네이버 계정 정보를 확인하지 못했어요." }, { status: 500 });
  }
}
