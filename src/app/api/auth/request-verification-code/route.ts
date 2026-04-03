import { randomInt } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";
import { issueLocalChallengeToken } from "@/lib/auth/owner-identity";

const schema = z.object({
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

    const code = String(randomInt(100000, 1000000));
    const challengeToken = issueLocalChallengeToken({
      name: payload.name.trim(),
      birthDate: payload.birthDate,
      phoneNumber: payload.phoneNumber,
      code,
    });

    return NextResponse.json({
      success: true,
      challengeToken,
      devVerificationCode: code,
      message: "인증번호를 준비했어요.",
    });
  } catch {
    return NextResponse.json({ message: "인증번호 요청 중 문제가 발생했습니다." }, { status: 400 });
  }
}
