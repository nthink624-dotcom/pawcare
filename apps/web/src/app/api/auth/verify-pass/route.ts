import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { hasPortoneServerEnv, hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import {
  completePortoneIdentityVerification,
  reuseCompletedPortoneIdentityVerification,
  validatePortoneIdentityVerificationBinding,
} from "@/server/owner-identity-verification";
import {
  PORTONE_REQUEST_STATE_MAX_LENGTH,
  PORTONE_REQUEST_STATE_MIN_LENGTH,
} from "@/lib/auth/owner-identity-binding";
import { recordSignupIdentityVerified } from "@/server/marketing-acquisition";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  verificationRequestId: z.string().uuid(),
  identityVerificationId: z.string().regex(/^[A-Za-z0-9]{1,40}$/),
  verificationState: z.string().min(PORTONE_REQUEST_STATE_MIN_LENGTH).max(PORTONE_REQUEST_STATE_MAX_LENGTH),
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

  if (
    normalized.includes("permission denied") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "본인인증 결과 조회 권한을 확인하지 못했어요. PortOne 서버 API 설정을 확인해 주세요.";
  }

  return normalized ? "본인인증 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." : undefined;
}

function isAlreadyVerifiedPortoneMessage(result: PortoneVerificationResponse) {
  return [result.message, result.type]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes("already verified"));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPortoneIdentityVerificationUrls(identityVerificationId: string) {
  const encodedId = encodeURIComponent(identityVerificationId);
  const getEndpoint = new URL(`/identity-verifications/${encodedId}`, "https://api.portone.io");

  if (serverEnv.portoneStoreId) {
    getEndpoint.searchParams.set("storeId", serverEnv.portoneStoreId);
  }

  return getEndpoint.toString();
}

async function fetchPortoneIdentityVerification(identityVerificationId: string) {
  const getEndpoint = buildPortoneIdentityVerificationUrls(identityVerificationId);
  const headers = {
    Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
    "Content-Type": "application/json",
  };

  let lastResponse: Response | null = null;
  let lastResult: PortoneVerificationResponse = {};

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await wait(700 * attempt);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4_000);
    let getResponse: Response;
    try {
      getResponse = await fetch(getEndpoint, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          response: new Response(null, { status: 504 }),
          result: { message: "본인인증 결과 확인 시간이 길어 요청을 중단했어요. 다시 시도해 주세요." },
        };
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    const getResult = await readPortoneJson(getResponse);
    lastResponse = getResponse;
    lastResult = getResult;

    if (getResponse.ok && isVerifiedPortoneIdentity(getResult.identityVerification)) {
      return { response: getResponse, result: getResult };
    }

    if (getResponse.status === 401 || getResponse.status === 403) {
      break;
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

    const binding = await validatePortoneIdentityVerificationBinding({
      verificationRequestId: payload.verificationRequestId,
      purpose: payload.purpose,
      identityVerificationId: payload.identityVerificationId,
      verificationState: payload.verificationState,
      allowedStatuses: ["requested", "verified"],
    });
    if (!binding.ok) {
      return NextResponse.json({ message: binding.message }, { status: 400 });
    }

    if (binding.status === "verified") {
      const reused = await reuseCompletedPortoneIdentityVerification({
        verificationRequestId: payload.verificationRequestId,
        purpose: payload.purpose,
        identityVerificationId: payload.identityVerificationId,
        verificationState: payload.verificationState,
      });
      if (!reused.ok) {
        return NextResponse.json({ message: reused.message }, { status: 400 });
      }
      if (payload.purpose === "signup") {
        await recordSignupIdentityVerified({ request, verificationRequestId: payload.verificationRequestId });
      }
      return NextResponse.json({
        success: true,
        verificationToken: reused.verificationToken,
        identity: reused.identity,
        message: "본인 확인이 완료되었습니다.",
      });
    }

    const { response: verificationResponse, result } = await fetchPortoneIdentityVerification(payload.identityVerificationId);
    if (!verificationResponse.ok || !result.identityVerification) {
      if (isAlreadyVerifiedPortoneMessage(result)) {
        const reused = await reuseCompletedPortoneIdentityVerification({
          verificationRequestId: payload.verificationRequestId,
          purpose: payload.purpose,
          identityVerificationId: payload.identityVerificationId,
          verificationState: payload.verificationState,
        });

        if (reused.ok) {
          if (payload.purpose === "signup") {
            await recordSignupIdentityVerified({ request, verificationRequestId: payload.verificationRequestId });
          }
          return NextResponse.json({
            success: true,
            verificationToken: reused.verificationToken,
            identity: reused.identity,
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
      verificationState: payload.verificationState,
      identityVerification: result.identityVerification,
    });

    if (!completed.ok) {
      return NextResponse.json({ message: completed.message }, { status: 400 });
    }

    if (payload.purpose === "signup") {
      await recordSignupIdentityVerified({ request, verificationRequestId: payload.verificationRequestId });
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
