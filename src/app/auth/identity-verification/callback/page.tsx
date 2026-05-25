"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { PORTONE_IDENTITY_CALLBACK_MESSAGE } from "@/lib/portone/identity-verification-client";

const CALLBACK_FIELDS = [
  "transactionType",
  "identityVerificationId",
  "identityVerificationTxId",
  "code",
  "message",
  "pgCode",
  "pgMessage",
] as const;

function readPayload(searchParams: URLSearchParams) {
  const payload: Record<string, string> = {};

  for (const key of CALLBACK_FIELDS) {
    const value = searchParams.get(key);
    if (value) payload[key] = value;
  }

  if (!payload.identityVerificationId) {
    const expectedId = searchParams.get("expectedIdentityVerificationId");
    if (expectedId) payload.identityVerificationId = expectedId;
  }

  if (!payload.transactionType) {
    payload.transactionType = "IDENTITY_VERIFICATION";
  }

  return payload;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const payload = useMemo(() => readPayload(searchParams), [searchParams]);

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: PORTONE_IDENTITY_CALLBACK_MESSAGE,
          payload,
        },
        window.location.origin,
      );
      window.setTimeout(() => window.close(), 300);
    }
  }, [payload]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-[#111111]">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[20px] font-bold">본인확인이 완료되었습니다</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#64748b]">잠시 후 회원가입 화면으로 돌아갑니다.</p>
      </div>
    </main>
  );
}

export default function IdentityVerificationCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-[#111111]">
          <div className="w-full max-w-[320px]">
            <h1 className="text-[20px] font-bold">본인확인을 처리하고 있습니다</h1>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
