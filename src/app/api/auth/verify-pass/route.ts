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

async function fetchPortoneIdentityVerification(identityVerificationId: string) {
  const endpoint = `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`;
  const headers = {
    Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
    "Content-Type": "application/json",
  };

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

  const getResponse = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });
  const getResult = await readPortoneJson(getResponse);
  if (getResponse.ok && getResult.identityVerification) {
    return { response: getResponse, result: getResult };
  }

  return {
    response: getResponse.ok ? confirmResponse : getResponse,
    result: getResult.message ? getResult : confirmResult,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "본인인증 요청 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "본인확인 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
