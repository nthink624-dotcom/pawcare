import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";
import { issueVerifiedIdentityToken } from "@/lib/auth/owner-identity";
import { serverEnv, hasPortoneServerEnv } from "@/lib/server-env";

const schema = z.object({
  identityVerificationId: z.string().min(1),
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
    if (!hasPortoneServerEnv()) {
      return NextResponse.json({ message: "포트원 본인인증 환경 변수가 아직 설정되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const payload = schema.parse({
      ...body,
      phoneNumber: normalizePhoneNumber(body?.phoneNumber ?? ""),
    });

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 8자리 숫자로 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.phoneNumber)) {
      return NextResponse.json({ message: "휴대폰 번호를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const verificationResponse = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(payload.identityVerificationId)}`,
      {
        headers: {
          Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    const result = (await verificationResponse.json()) as {
      identityVerification?: { status?: string };
      type?: string;
      message?: string;
    };

    if (!verificationResponse.ok) {
      return NextResponse.json({ message: result.message ?? "PASS 인증 확인에 실패했습니다." }, { status: 400 });
    }

    const status = result.identityVerification?.status;
    if (status && status !== "VERIFIED") {
      return NextResponse.json({ message: "PASS 본인인증이 완료되지 않았습니다." }, { status: 400 });
    }

    const verificationToken = issueVerifiedIdentityToken({
      name: payload.name.trim(),
      birthDate: payload.birthDate,
      phoneNumber: payload.phoneNumber,
      source: "portone",
      identityVerificationId: payload.identityVerificationId,
    });

    return NextResponse.json({
      success: true,
      verificationToken,
      message: "PASS 본인인증이 완료되었습니다.",
    });
  } catch {
    return NextResponse.json({ message: "PASS 인증 처리 중 문제가 발생했습니다." }, { status: 400 });
  }
}
