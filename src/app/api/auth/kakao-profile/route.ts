import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveSocialProviderFromAuthUser } from "@/lib/auth/social-auth";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";

const KAKAO_PROFILE_URL = "https://kapi.kakao.com/v2/user/me";

const requestSchema = z.object({
  providerToken: z.string().trim().min(1).max(4_000),
});

const kakaoProfileSchema = z.object({
  id: z.union([z.number(), z.string()]),
  kakao_account: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      phone_number: z.string().trim().max(40).optional(),
    })
    .optional(),
});

function normalizePhone(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  const domesticDigits = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  return domesticDigits.slice(0, 11);
}

function resolveKakaoIdentityId(user: {
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown>;
  }> | null;
}) {
  const identity = user.identities?.find((item) => item.provider === "kakao");
  const candidates = [
    identity?.identity_data?.sub,
    identity?.identity_data?.provider_id,
    identity?.identity_data?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }

  return null;
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
    const user = userResult.data.user;
    if (userResult.error || !user || resolveSocialProviderFromAuthUser(user) !== "kakao") {
      return NextResponse.json({ message: "카카오 로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "계정 정보를 저장할 수 없습니다." }, { status: 503 });
    }

    const existingShopResult = await admin
      .from("shops")
      .select("id")
      .eq("owner_user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (existingShopResult.error) {
      return NextResponse.json({ message: "매장 연결 정보를 확인하지 못했어요." }, { status: 500 });
    }

    if (existingShopResult.data?.id) {
      return NextResponse.json({
        shopId: existingShopResult.data.id,
        profileUpdated: false,
      });
    }

    const profileUrl = new URL(KAKAO_PROFILE_URL);
    profileUrl.searchParams.set(
      "property_keys",
      JSON.stringify(["kakao_account.name", "kakao_account.phone_number"]),
    );

    const profileResponse = await fetch(profileUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${payload.providerToken}` },
    });
    const profilePayload = kakaoProfileSchema.safeParse(await profileResponse.json());
    const profile = profilePayload.success ? profilePayload.data : null;
    const account = profile?.kakao_account;
    const name = account?.name ?? "";
    const phone = normalizePhone(account?.phone_number);
    const hasRequiredProfile = Boolean(name && /^01\d{8,9}$/.test(phone));

    const expectedKakaoId = resolveKakaoIdentityId(user);
    const receivedKakaoId = profile ? String(profile.id) : null;
    if (expectedKakaoId && receivedKakaoId && expectedKakaoId !== receivedKakaoId) {
      return NextResponse.json({ message: "카카오 계정 정보가 일치하지 않습니다." }, { status: 403 });
    }

    if (!profileResponse.ok || !profilePayload.success || !hasRequiredProfile) {
      return NextResponse.json(
        {
          message:
            "카카오에서 이름과 휴대전화번호를 받지 못했어요. 카카오 정보 제공 동의 후 다시 시도해 주세요.",
        },
        { status: 422 },
      );
    }

    const updateResult = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        name,
        phone_number: phone,
      },
    });

    if (updateResult.error) {
      return NextResponse.json({ message: "카카오 계정 정보를 저장하지 못했어요." }, { status: 500 });
    }

    return NextResponse.json({
      name,
      phone,
      shopId: null,
      profileUpdated: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "카카오 로그인 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "카카오 계정 정보를 확인하지 못했어요." }, { status: 500 });
  }
}
