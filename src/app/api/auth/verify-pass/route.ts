import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { hasPortoneServerEnv, hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import { completePortoneIdentityVerification } from "@/server/owner-identity-verification";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  verificationRequestId: z.string().uuid(),
  identityVerificationId: z.string().min(1),
});

type PortoneVerificationResponse = {
  identityVerification?: Record<string, unknown>;
  message?: string;
};

async function readPortoneJson(response: Response): Promise<PortoneVerificationResponse> {
  try {
    return (await response.json()) as PortoneVerificationResponse;
  } catch {
    return {};
  }
}

function toKoreanPortoneIdentityMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("already verified")) {
    return "이미 완료된 본인인증 요청입니다. 창을 닫고 다시 인증해 주세요.";
  }

  return message;
}

function isAlreadyVerifiedPortoneMessage(message?: string) {
  return (message ?? "").toLowerCase().includes("already verified");
}

async function fetchPortoneIdentityVerification(identityVerificationId: string) {
  const endpoint = `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`;
  const headers = {
    Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
    "Content-Type": "application/json",
  };

  const getResponse = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });
  const getResult = await readPortoneJson(getResponse);
  if (getResponse.ok && getResult.identityVerification) {
    return { response: getResponse, result: getResult };
  }

  const confirmResponse = await fetch(`${endpoint}/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify(serverEnv.portoneStoreId ? { storeId: serverEnv.portoneStoreId } : {}),
    cache: "no-store",
  });
  const confirmResult = await readPortoneJson(confirmResponse);
  if (confirmResponse.ok && confirmResult.identityVerification) {
    return { response: confirmResponse, result: confirmResult };
  }

  return {
    response: confirmResponse.ok ? getResponse : confirmResponse,
    result: confirmResult.message ? confirmResult : getResult,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "인증 서버 환경이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    if (!hasPortoneServerEnv()) {
      return NextResponse.json({ message: "PASS 본인인증 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const body = await request.json();
    const payload = schema.parse(body);

    const { response: verificationResponse, result } = await fetchPortoneIdentityVerification(payload.identityVerificationId);
    if (!verificationResponse.ok || !result.identityVerification) {
      if (isAlreadyVerifiedPortoneMessage(result.message)) {
        const completed = await completePortoneIdentityVerification({
          verificationRequestId: payload.verificationRequestId,
          purpose: payload.purpose,
          identityVerificationId: payload.identityVerificationId,
          identityVerification: undefined,
        });

        if (completed.ok) {
          return NextResponse.json({
            success: true,
            verificationToken: completed.verificationToken,
            identity: completed.identity,
            message: "본인 확인이 완료되었습니다.",
          });
        }
      }

      result.message = toKoreanPortoneIdentityMessage(result.message);
      return NextResponse.json(
        { message: result.message ?? "본인확인 결과를 조회하지 못했습니다." },
        { status: verificationResponse.ok ? 400 : verificationResponse.status || 400 },
      );
    }

    const completed = await completePortoneIdentityVerification({
      verificationRequestId: payload.verificationRequestId,
      purpose: payload.purpose,
      identityVerificationId: payload.identityVerificationId,
      identityVerification: result.identityVerification,
    });

    if (!completed.ok) {
      return NextResponse.json({ message: completed.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verificationToken: completed.verificationToken,
      identity: completed.identity,
      message: "본인 확인이 완료되었습니다.",
    });
  } catch (error) {
    if (!(error instanceof z.ZodError) && error instanceof Error) {
      const mappedMessage = toKoreanPortoneIdentityMessage(error.message);
      if (mappedMessage && mappedMessage !== error.message) {
        return NextResponse.json({ message: mappedMessage }, { status: 400 });
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "본인인증 요청 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "본인확인 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
