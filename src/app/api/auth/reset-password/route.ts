import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { buildOwnerAuthEmailCandidates } from "@/lib/auth/owner-credentials";
import { hashIdentityStableValue } from "@/lib/auth/owner-identity";
import { ownerPasswordResetSchema } from "@/lib/auth/owner-password-reset";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { consumeVerifiedIdentity, getVerifiedIdentityForToken } from "@/server/owner-identity-verification";

type OwnerPasswordResetProfile = {
  user_id: string;
  phone_number: string | null;
  ci_hash: string | null;
  di_hash: string | null;
};

function isMissingIdentityHashColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    message.includes("owner_profiles.ci_hash") ||
    message.includes("owner_profiles.di_hash") ||
    message.includes("ci_hash does not exist") ||
    message.includes("di_hash does not exist")
  );
}

function normalizePhoneNumber(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 11);
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = ownerPasswordResetSchema.parse(await request.json());
    const verifiedIdentity = await getVerifiedIdentityForToken({
      verificationToken: body.identityVerificationToken,
      purpose: "reset-password",
      expectedName: body.name,
      expectedBirthDate: body.birthDate,
      expectedPhoneNumber: body.phoneNumber,
    });

    if (!verifiedIdentity) {
      return NextResponse.json({ message: "본인인증이 만료되었습니다. 다시 인증해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    let canUseIdentityHashColumns = true;
    let profileData: OwnerPasswordResetProfile | null = null;
    const profile = await supabase
      .from("owner_profiles")
      .select("user_id, phone_number, ci_hash, di_hash")
      .eq("login_id", body.loginId)
      .eq("name", verifiedIdentity.name)
      .eq("birth_date", verifiedIdentity.birth_date)
      .maybeSingle<OwnerPasswordResetProfile>();

    if (profile.error && isMissingIdentityHashColumnError(profile.error)) {
      canUseIdentityHashColumns = false;
      const fallbackProfile = await supabase
        .from("owner_profiles")
        .select("user_id, phone_number")
        .eq("login_id", body.loginId)
        .eq("name", verifiedIdentity.name)
        .eq("birth_date", verifiedIdentity.birth_date)
        .maybeSingle<Omit<OwnerPasswordResetProfile, "ci_hash" | "di_hash">>();

      if (fallbackProfile.error) {
        return NextResponse.json(
          { message: fallbackProfile.error.message || "입력한 정보와 일치하는 계정을 찾지 못했어요." },
          { status: 400 },
        );
      }

      profileData = fallbackProfile.data ? { ...fallbackProfile.data, ci_hash: null, di_hash: null } : null;
    } else if (profile.error) {
      return NextResponse.json(
        { message: profile.error.message || "입력한 정보와 일치하는 계정을 찾지 못했어요." },
        { status: 400 },
      );
    } else {
      profileData = profile.data;
    }

    if (!profileData?.user_id) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status: 404 });
    }

    const ciHash = verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null;
    const diHash = verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null;
    const hasStoredIdentityHash = Boolean(profileData.ci_hash || profileData.di_hash);
    const hasVerifiedIdentityHash = Boolean(ciHash || diHash);
    const strongIdentityMatch = Boolean(
      (ciHash && profileData.ci_hash === ciHash) || (diHash && profileData.di_hash === diHash),
    );
    const legacyPhoneMatch =
      normalizePhoneNumber(profileData.phone_number) === normalizePhoneNumber(verifiedIdentity.phone_number);

    if (hasStoredIdentityHash) {
      if (!strongIdentityMatch) {
        return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status: 404 });
      }
    } else if (!legacyPhoneMatch) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status: 404 });
    }

    const authClient = getSupabaseAuthClient();
    if (!authClient) {
      return NextResponse.json({ message: "Supabase 인증 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    const existingAuthUser = await supabase.auth.admin.getUserById(profileData.user_id);
    for (const email of buildOwnerAuthEmailCandidates(body.loginId, existingAuthUser.data.user?.email)) {
      const currentPasswordCheck = await authClient.auth.signInWithPassword({
        email,
        password: body.password,
      });

      if (!currentPasswordCheck.error && currentPasswordCheck.data.user?.id === profileData.user_id) {
        return NextResponse.json(
          { message: "직전에 사용한 비밀번호는 다시 사용할 수 없습니다. 다른 비밀번호를 입력해 주세요." },
          { status: 400 },
        );
      }
    }

    const consumed = await consumeVerifiedIdentity({
      verificationId: verifiedIdentity.id,
      tokenId: verifiedIdentity.tokenId,
      action: "reset-password",
    });

    if (!consumed) {
      return NextResponse.json({ message: "이미 사용한 본인인증입니다. 다시 인증해 주세요." }, { status: 400 });
    }

    const updated = await supabase.auth.admin.updateUserById(profileData.user_id, { password: body.password });
    if (updated.error) {
      return NextResponse.json(
        { message: updated.error.message || "비밀번호를 변경하지 못했어요." },
        { status: 400 },
      );
    }

    if (canUseIdentityHashColumns && !hasStoredIdentityHash && hasVerifiedIdentityHash) {
      await supabase
        .from("owner_profiles")
        .update({
          ci_hash: ciHash,
          di_hash: diHash,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", profileData.user_id);
    }

    return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "비밀번호 재설정 중 문제가 발생했습니다." }, { status: 400 });
  }
}
