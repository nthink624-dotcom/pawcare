"use client";

import { env, hasPortoneBrowserEnv } from "@/lib/env";
import { requestPortoneIdentityVerification } from "@/lib/portone/identity-verification-client";

type ApiMessage = {
  email?: string | null;
  message?: string;
  verificationRequestId?: string | null;
  verificationToken?: string | null;
};

async function readApiMessage(response: Response) {
  return (await response.json().catch(() => ({}))) as ApiMessage;
}

export async function findEmailWithKcpIdentityVerification() {
  if (!hasPortoneBrowserEnv() || !env.portoneStoreId || !env.portoneIdentityKcpChannelKey) {
    throw new Error("KCP 본인인증 채널이 아직 연결되지 않았어요.");
  }

  const requestResponse = await fetch("/api/auth/request-verification-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: "find-email",
      method: "portone",
    }),
  });
  const requestResult = await readApiMessage(requestResponse);

  if (!requestResponse.ok || !requestResult.verificationRequestId) {
    throw new Error(requestResult.message ?? "본인인증 요청을 준비하지 못했어요. 다시 시도해 주세요.");
  }

  const identityVerificationId = `findemail${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const identityResult = await requestPortoneIdentityVerification({
    storeId: env.portoneStoreId,
    channelKey: env.portoneIdentityKcpChannelKey,
    identityVerificationId,
    windowType: { pc: "POPUP", mobile: "POPUP" },
  });

  if (!identityResult?.identityVerificationId) {
    throw new Error("KCP 본인인증이 완료되지 않았어요.");
  }

  const verifyResponse = await fetch("/api/auth/verify-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: "find-email",
      verificationRequestId: requestResult.verificationRequestId,
      identityVerificationId: identityResult.identityVerificationId,
    }),
  });
  const verifyResult = await readApiMessage(verifyResponse);

  if (!verifyResponse.ok || !verifyResult.verificationToken) {
    throw new Error(verifyResult.message ?? "KCP 본인인증 결과를 확인하지 못했어요.");
  }

  const lookupResponse = await fetch("/api/auth/find-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityVerificationToken: verifyResult.verificationToken }),
  });
  const lookupResult = await readApiMessage(lookupResponse);

  if (!lookupResponse.ok || !lookupResult.email) {
    throw new Error(lookupResult.message ?? "본인인증 정보와 연결된 이메일을 찾지 못했어요.");
  }

  return lookupResult.email;
}
