import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { hashIdentityStableValue } from "@/lib/auth/owner-identity";
import { ownerFindLoginIdSchema } from "@/lib/auth/owner-find-login-id";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { consumeVerifiedIdentity, getVerifiedIdentityForToken } from "@/server/owner-identity-verification";

type OwnerProfileLookup = {
  user_id: string;
  login_id: string;
  phone_number: string | null;
  ci_hash: string | null;
  di_hash: string | null;
};

function normalizePhoneNumber(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 11);
}

function pickProfileByIdentity(profiles: OwnerProfileLookup[], verifiedIdentity: Awaited<ReturnType<typeof getVerifiedIdentityForToken>>) {
  if (!verifiedIdentity) {
    return { profile: null, message: "본인인증이 만료되었어요. 다시 인증해 주세요.", shouldBackfill: false };
  }

  const ciHash = verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null;
  const diHash = verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null;
  const hasVerifiedIdentityHash = Boolean(ciHash || diHash);
  const profilesWithStoredIdentity = profiles.filter((profile) => Boolean(profile.ci_hash || profile.di_hash));
  const strongMatches = profilesWithStoredIdentity.filter(
    (profile) => (ciHash && profile.ci_hash === ciHash) || (diHash && profile.di_hash === diHash),
  );

  if (strongMatches.length > 1) {
    return {
      profile: null,
      message: "본인인증 결과와 연결된 계정이 여러 개입니다. 관리자에게 문의해 주세요.",
      shouldBackfill: false,
    };
  }

  if (strongMatches.length === 1) {
    return { profile: strongMatches[0], message: null, shouldBackfill: false };
  }

  if (profilesWithStoredIdentity.length > 0) {
    return { profile: null, message: "입력한 정보와 일치하는 계정을 찾지 못했어요.", shouldBackfill: false };
  }

  const phoneMatches = profiles.filter(
    (profile) => normalizePhoneNumber(profile.phone_number) === normalizePhoneNumber(verifiedIdentity.phone_number),
  );

  if (phoneMatches.length > 1) {
    return {
      profile: null,
      message: "입력한 정보와 연결된 계정이 여러 개입니다. 관리자에게 문의해 주세요.",
      shouldBackfill: false,
    };
  }

  if (phoneMatches.length === 1) {
    return { profile: phoneMatches[0], message: null, shouldBackfill: hasVerifiedIdentityHash };
  }

  if (profiles.length === 1 && hasVerifiedIdentityHash) {
    return { profile: profiles[0], message: null, shouldBackfill: true };
  }

  return { profile: null, message: "입력한 정보와 일치하는 계정을 찾지 못했어요.", shouldBackfill: false };
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = ownerFindLoginIdSchema.parse(await request.json());
    const verifiedIdentity = await getVerifiedIdentityForToken({
      verificationToken: body.identityVerificationToken,
      purpose: "find-login-id",
      expectedName: body.name,
      expectedBirthDate: body.birthDate,
      expectedPhoneNumber: body.phoneNumber,
    });

    if (!verifiedIdentity) {
      return NextResponse.json({ message: "본인인증이 만료되었어요. 다시 인증해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    const result = await supabase
      .from("owner_profiles")
      .select("user_id, login_id, phone_number, ci_hash, di_hash")
      .eq("name", verifiedIdentity.name)
      .eq("birth_date", verifiedIdentity.birth_date)
      .returns<OwnerProfileLookup[]>();

    if (result.error) {
      return NextResponse.json({ message: result.error.message || "계정을 찾지 못했어요." }, { status: 400 });
    }

    const picked = pickProfileByIdentity(result.data ?? [], verifiedIdentity);
    if (!picked.profile) {
      const status = picked.message?.includes("여러 개") ? 409 : 404;
      return NextResponse.json({ message: picked.message || "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status });
    }

    const consumed = await consumeVerifiedIdentity({
      verificationId: verifiedIdentity.id,
      tokenId: verifiedIdentity.tokenId,
      action: "find-login-id",
    });

    if (!consumed) {
      return NextResponse.json({ message: "이미 사용된 본인인증입니다. 다시 인증해 주세요." }, { status: 400 });
    }

    if (picked.shouldBackfill) {
      await supabase
        .from("owner_profiles")
        .update({
          ci_hash: verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null,
          di_hash: verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", picked.profile.user_id);
    }

    return NextResponse.json({
      success: true,
      loginId: picked.profile.login_id,
      message: `가입하신 아이디는 ${picked.profile.login_id} 입니다.`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "아이디 찾기 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
