import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { hasPortoneServerEnv, hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import {
  completePortoneIdentityVerification,
  reuseCompletedPortoneIdentityVerification,
} from "@/server/owner-identity-verification";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  verificationRequestId: z.string().uuid(),
  identityVerificationId: z.string().min(1),
});

type PortoneVerificationResponse = {
  identityVerification?: Record<string, unknown>;
  message?: string;
  type?: string;
};

function getPortoneIdentityStatus(identityVerification: Record<string, unknown> | undefined) {
  return typeof identityVerification?.status === "string" ? identityVerification.status.toUpperCase() : "";
}

function isVerifiedPortoneIdentity(identityVerification: Record<string, unknown> | undefined) {
  return getPortoneIdentityStatus(identityVerification) === "VERIFIED";
}

async function readPortoneJson(response: Response): Promise<PortoneVerificationResponse> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (!payload.identityVerification && typeof payload.id === "string" && typeof payload.status === "string") {
      return { identityVerification: payload };
    }
    return payload as PortoneVerificationResponse;
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

function isAlreadyVerifiedPortoneMessage(result: PortoneVerificationResponse) {
  return [result.message, result.type]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes("already verified"));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPortoneIdentityVerification(identityVerificationId: string) {
  const endpoint = `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`;
  const headers = {
    Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
    "Content-Type": "application/json",
  };

  let lastResponse: Response | null = null;
  let lastResult: PortoneVerificationResponse = {};

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await wait(500 * attempt);
    }

    const getResponse = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });
    const getResult = await readPortoneJson(getResponse);
    lastResponse = getResponse;
    lastResult = getResult;

    if (getResponse.ok && isVerifiedPortoneIdentity(getResult.identityVerification)) {
      return { response: getResponse, result: getResult };
    }

    const confirmResponse = await fetch(`${endpoint}/confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify(serverEnv.portoneStoreId ? { storeId: serverEnv.portoneStoreId } : {}),
      cache: "no-store",
    });
    const confirmResult = await readPortoneJson(confirmResponse);
    lastResponse = confirmResponse.ok ? getResponse : confirmResponse;
    lastResult = confirmResult.identityVerification || confirmResult.message ? confirmResult : getResult;

    if (confirmResponse.ok && isVerifiedPortoneIdentity(confirmResult.identityVerification)) {
      return { response: confirmResponse, result: confirmResult };
    }

    if (isAlreadyVerifiedPortoneMessage(confirmResult)) {
      return { response: confirmResponse, result: confirmResult };
    }
  }

  return {
    response: lastResponse ?? new Response(null, { status: 400 }),
    result: lastResult,
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
      if (isAlreadyVerifiedPortoneMessage(result)) {
        const reused = await reuseCompletedPortoneIdentityVerification({
          purpose: payload.purpose,
          identityVerificationId: payload.identityVerificationId,
        });

        if (reused.ok) {
          return NextResponse.json({
            success: true,
            verificationToken: reused.verificationToken,
            identity: reused.identity,
            message: "본인 확인이 완료되었습니다.",
          });
        }

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
