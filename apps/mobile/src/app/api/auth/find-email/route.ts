import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { hashIdentityStableValue } from "@/lib/auth/owner-identity";
import { isValidOwnerEmail } from "@/lib/auth/owner-credentials";
import { ownerFindEmailSchema } from "@/lib/auth/owner-find-email";
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
  if (!verifiedIdentity) return null;

  const ciHash = verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null;
  const diHash = verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null;
  const profilesWithStoredIdentity = profiles.filter((profile) => Boolean(profile.ci_hash || profile.di_hash));
  const strongMatches = profilesWithStoredIdentity.filter(
    (profile) => (ciHash && profile.ci_hash === ciHash) || (diHash && profile.di_hash === diHash),
  );

  if (strongMatches.length === 1) return strongMatches[0];
  if (profilesWithStoredIdentity.length > 0) return null;

  const phoneMatches = profiles.filter(
    (profile) => normalizePhoneNumber(profile.phone_number) === normalizePhoneNumber(verifiedIdentity.phone_number),
  );
  return phoneMatches.length === 1 ? phoneMatches[0] : null;
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "이메일 찾기 환경이 준비되지 않았습니다." }, { status: 503 });
    }

    const body = ownerFindEmailSchema.parse(await request.json());
    const verifiedIdentity = await getVerifiedIdentityForToken({
      verificationToken: body.identityVerificationToken,
      purpose: "find-email",
      expectedName: body.name,
      expectedBirthDate: body.birthDate,
      expectedPhoneNumber: body.phoneNumber,
    });
    if (!verifiedIdentity) {
      return NextResponse.json({ message: "본인 인증이 만료되었습니다. 다시 인증해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "이메일 찾기 환경이 준비되지 않았습니다." }, { status: 503 });
    }

    const result = await supabase
      .from("owner_profiles")
      .select("user_id, login_id, phone_number, ci_hash, di_hash")
      .eq("name", verifiedIdentity.name)
      .eq("birth_date", verifiedIdentity.birth_date)
      .returns<OwnerProfileLookup[]>();
    if (result.error) {
      return NextResponse.json({ message: "가입 정보를 찾지 못했습니다." }, { status: 400 });
    }

    const profile = pickProfileByIdentity(result.data ?? [], verifiedIdentity);
    if (!profile || !isValidOwnerEmail(profile.login_id)) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했습니다." }, { status: 404 });
    }

    const consumed = await consumeVerifiedIdentity({
      verificationId: verifiedIdentity.id,
      tokenId: verifiedIdentity.tokenId,
      action: "find-email",
    });
    if (!consumed) {
      return NextResponse.json({ message: "이미 사용된 본인인증입니다. 다시 인증해 주세요." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      email: profile.login_id,
      message: `가입하신 이메일은 ${profile.login_id}입니다.`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "이메일 찾기 중 문제가 발생했습니다." }, { status: 400 });
  }
}
