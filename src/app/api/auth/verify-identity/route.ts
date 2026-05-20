import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidBirthDate8, normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";
import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { completeLocalIdentityVerification } from "@/server/owner-identity-verification";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  verificationRequestId: z.string().uuid(),
  loginId: z.string().trim().optional().default(""),
  name: z.string().trim().optional().default(""),
  birthDate: z.string().optional().default(""),
  phoneNumber: z.string().optional().default(""),
  code: z.string().length(6),
});

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

async function fillDevelopmentProfileForLocalReset(input: z.infer<typeof schema>) {
  if (
    input.purpose !== "reset-password" ||
    getSupabaseServerRuntimeStage() !== "development" ||
    (input.name && input.birthDate && input.phoneNumber)
  ) {
    return input;
  }

  const loginId = normalizeOwnerLoginId(input.loginId);
  if (!loginId) return input;

  const supabase = getSupabaseAdmin();
  if (!supabase) return input;

  const { data } = await supabase
    .from("owner_profiles")
    .select("name, birth_date, phone_number")
    .eq("login_id", loginId)
    .maybeSingle<{ name: string | null; birth_date: string | null; phone_number: string | null }>();

  if (!data?.name || !data.birth_date || !data.phone_number) return input;

  return {
    ...input,
    name: data.name,
    birthDate: data.birth_date,
    phoneNumber: normalizePhoneNumber(data.phone_number),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "인증 서버 환경이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const parsedPayload = schema.parse({
      ...body,
      loginId: normalizeOwnerLoginId(body?.loginId ?? ""),
      phoneNumber: normalizePhoneNumber(body?.phoneNumber ?? ""),
      code: String(body?.code ?? "").replace(/\D/g, "").slice(0, 6),
    });
    const payload = await fillDevelopmentProfileForLocalReset(parsedPayload);

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 숫자 8자리로 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.phoneNumber)) {
      return NextResponse.json({ message: "휴대폰번호를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const result = await completeLocalIdentityVerification(payload);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verificationToken: result.verificationToken,
      message: "본인 확인이 완료되었습니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "본인인증 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "본인 확인 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
