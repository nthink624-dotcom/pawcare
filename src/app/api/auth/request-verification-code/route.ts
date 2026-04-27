import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";
import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import {
  createLocalIdentityVerificationRequest,
  createProviderIdentityVerificationRequest,
} from "@/server/owner-identity-verification";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  method: z.enum(["local", "portone"]).default("local"),
  name: z.string().trim().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
});

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "인증 서버 환경이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const payload = schema.parse({
      ...body,
      phoneNumber: normalizePhoneNumber(body?.phoneNumber ?? ""),
    });

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 숫자 8자리로 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.phoneNumber)) {
      return NextResponse.json({ message: "휴대폰번호를 올바르게 입력해 주세요." }, { status: 400 });
    }

    if (payload.method === "local" && getSupabaseServerRuntimeStage() === "production") {
      return NextResponse.json(
        { message: "운영 환경에서는 인증번호 방식 본인확인을 사용할 수 없습니다." },
        { status: 403 },
      );
    }

    const result =
      payload.method === "portone"
        ? await createProviderIdentityVerificationRequest(payload)
        : await createLocalIdentityVerificationRequest(payload);

    return NextResponse.json({
      success: true,
      verificationRequestId: result.verificationRequestId,
      devVerificationCode: "devVerificationCode" in result ? result.devVerificationCode ?? null : null,
      message:
        payload.method === "portone"
          ? "본인확인 요청을 준비했습니다."
          : "인증번호를 전송했어요. 문자 메시지를 확인해 주세요.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "이름, 생년월일, 휴대폰번호를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "인증번호 요청 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
