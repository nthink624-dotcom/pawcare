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

  const response = await fetch(getEndpoint, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await readPortoneJson(response);
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
