import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueVerifiedIdentityToken, readLocalChallengeToken } from "@/lib/auth/owner-identity";
import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";

const schema = z.object({
  name: z.string().trim().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
  code: z.string().length(6),
  challengeToken: z.string().min(1),
});

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = schema.parse({
      ...body,
      phoneNumber: normalizePhoneNumber(body?.phoneNumber ?? ""),
      code: String(body?.code ?? "").replace(/\D/g, "").slice(0, 6),
    });

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 8자리 숫자로 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.phoneNumber)) {
      return NextResponse.json({ message: "휴대폰 번호를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const challenge = readLocalChallengeToken(payload.challengeToken);
    if (!challenge) {
      return NextResponse.json({ message: "인증 요청이 만료되었어요. 다시 요청해 주세요." }, { status: 400 });
    }

    if (
      challenge.name !== payload.name.trim() ||
      challenge.birthDate != payload.birthDate ||
      challenge.phoneNumber !== payload.phoneNumber
    ) {
      return NextResponse.json({ message: "입력한 본인 정보와 인증 요청 정보가 일치하지 않습니다." }, { status: 400 });
    }

    if (challenge.code !== payload.code) {
      return NextResponse.json({ message: "인증번호를 다시 확인해 주세요." }, { status: 400 });
    }

    const verificationToken = issueVerifiedIdentityToken({
      name: challenge.name,
      birthDate: challenge.birthDate,
      phoneNumber: challenge.phoneNumber,
      source: "local",
    });

    return NextResponse.json({
      success: true,
      verificationToken,
      message: "본인인증이 완료되었습니다.",
    });
  } catch {
    return NextResponse.json({ message: "인증 처리 중 문제가 발생했습니다." }, { status: 400 });
  }
}
