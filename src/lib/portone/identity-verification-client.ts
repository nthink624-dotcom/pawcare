"use client";

import type {
  IdentityVerificationRequest,
  IdentityVerificationResponse,
} from "@portone/browser-sdk/v2";

export const PORTONE_IDENTITY_CALLBACK_MESSAGE = "petmanager:portone-identity-callback";

type CallbackMessage = {
  type?: string;
  payload?: Partial<IdentityVerificationResponse>;
};

type CallbackPayload = Partial<IdentityVerificationResponse> & {
  transactionType?: "IDENTITY_VERIFICATION";
};

function buildIdentityVerificationRedirectUrl(identityVerificationId: string) {
  const url = new URL("/auth/identity-verification/callback", window.location.origin);
  url.searchParams.set("expectedIdentityVerificationId", identityVerificationId);
  return url.toString();
}

function wait(ms: number) {
  return new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), ms);
  });
}

function waitForCallback(identityVerificationId: string) {
  let dispose = () => {};

  const promise = new Promise<CallbackPayload>((resolve) => {
    const handleMessage = (event: MessageEvent<CallbackMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== PORTONE_IDENTITY_CALLBACK_MESSAGE) return;

      const payload = event.data.payload ?? {};
      const returnedId = payload.identityVerificationId;
      if (returnedId && returnedId !== identityVerificationId) return;

      resolve({
        transactionType: "IDENTITY_VERIFICATION",
        ...payload,
        identityVerificationId: returnedId ?? identityVerificationId,
      });
    };

    window.addEventListener("message", handleMessage);
    dispose = () => window.removeEventListener("message", handleMessage);
  });

  return { promise, dispose };
}

export async function requestPortoneIdentityVerification(
  request: IdentityVerificationRequest,
): Promise<IdentityVerificationResponse | CallbackPayload | null | undefined> {
  const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
  const callback = waitForCallback(request.identityVerificationId);
  let sdkError: unknown = null;

  const sdkPromise = requestIdentityVerification({
    ...request,
    redirectUrl: request.redirectUrl ?? buildIdentityVerificationRedirectUrl(request.identityVerificationId),
    popup: {
      center: true,
      ...request.popup,
    },
  }).catch((error: unknown) => {
    sdkError = error;
    return null;
  });

  try {
    const firstResult = await Promise.race([sdkPromise, callback.promise]);
    if (firstResult?.identityVerificationId) return firstResult;

    const callbackResult = await Promise.race([callback.promise, wait(1500)]);
    if (callbackResult?.identityVerificationId) return callbackResult;

    if (sdkError) throw sdkError;
    return firstResult;
  } finally {
    callback.dispose();
  }
}
