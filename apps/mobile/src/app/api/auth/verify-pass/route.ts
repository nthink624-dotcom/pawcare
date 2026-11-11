import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { identityVerificationPurposeSchema } from "@/lib/auth/owner-identity";
import { hasPortoneServerEnv, hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import {
  completePortoneIdentityVerification,
  validatePortoneIdentityVerificationRequest,
} from "@/server/owner-identity-verification";

const schema = z.object({
  purpose: identityVerificationPurposeSchema,
  verificationRequestId: z.string().uuid(),
  identityVerificationId: z.string().min(1).max(128),
  verificationState: z.string().regex(/^[a-f0-9]{64}$/),
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

  // The SDK callback can arrive before the provider's read API settles. Retry
  // only this read, within the client's 15-second wait. Never resend an identity
  // request or extend its server-side binding lifetime.
  const deadline = Date.now() + 8_000;
  let response = new Response(null, { status: 503 });
  let result: PortoneVerificationResponse = {};
  let failure: "transport" | "timeout" | "response" = "response";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      const delay = 350 * attempt;
      if (Date.now() + delay >= deadline) break;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      response = await fetch(getEndpoint, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(2_500, remaining)),
      });
      result = await readPortoneJson(response);
      failure = "response";
    } catch (error: unknown) {
      const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
      response = new Response(null, { status: timeout ? 504 : 503 });
      result = {};
      failure = timeout ? "timeout" : "transport";
    }
    const status = getPortoneIdentityStatus(result.identityVerification);
    if (response.ok && status === "VERIFIED") return { response, result };
    if (status === "FAILED" || [400, 401, 403, 422].includes(response.status)) break;
  }
  const status = getPortoneIdentityStatus(result.identityVerification);
  // Fixed labels only: no request IDs, URLs, provider messages, customer data,
  // credentials, or binding values in operational logs.
  console.warn("owner_identity_verification_lookup_failed", {
    failure,
    httpStatus: response.status,
    providerStatus: ["READY", "PENDING", "FAILED"].includes(status) ? status : "UNKNOWN",
  });
  return { response, result };
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

    if (!(await validatePortoneIdentityVerificationRequest(payload))) {
      return NextResponse.json({ code: "IDENTITY_BINDING_INVALID", message: "인증 요청이 만료되었거나 이미 사용되었습니다. 다시 인증해 주세요." }, { status: 400 });
    }
    const { response: verificationResponse, result } = await fetchPortoneIdentityVerification(payload.identityVerificationId);
    if (!verificationResponse.ok || !isVerifiedPortoneIdentity(result.identityVerification)) {
      return NextResponse.json(
        { code: "IDENTITY_PROVIDER_UNAVAILABLE", message: "본인확인 결과를 확인하지 못했습니다. 인증 창을 닫고 다시 시도해 주세요." },
        { status: 502 },
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

    return NextResponse.json({ code: "IDENTITY_VERIFY_FAILED", message: "본인확인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
