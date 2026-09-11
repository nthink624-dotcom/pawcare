"use client";

import type {
  IdentityVerificationRequest,
  IdentityVerificationResponse,
} from "@portone/browser-sdk/v2";

import { requireHttpsTransportUrl } from "@/lib/https-transport-url";

export const PORTONE_IDENTITY_CALLBACK_MESSAGE = "petmanager:portone-identity-callback";
export const PORTONE_IDENTITY_UI_TIMEOUT_MS = 120_000;
export const IDENTITY_API_TIMEOUT_MS = 10_000;

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

function createAbortWaiter(signal?: AbortSignal) {
  let dispose = () => {};
  const promise = new Promise<never>((_, reject) => {
    if (!signal) return;
    const rejectAbort = () => reject(new DOMException("본인인증 요청이 중단되었습니다.", "AbortError"));
    if (signal.aborted) {
      rejectAbort();
      return;
    }
    signal.addEventListener("abort", rejectAbort, { once: true });
    dispose = () => signal.removeEventListener("abort", rejectAbort);
  });
  return { promise, dispose };
}

export async function fetchIdentityApi(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = IDENTITY_API_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
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
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<IdentityVerificationResponse | CallbackPayload | null | undefined> {
  const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
  const callback = waitForCallback(request.identityVerificationId);
  const abortWaiter = createAbortWaiter(options.signal);
  const timeoutMs = options.timeoutMs ?? PORTONE_IDENTITY_UI_TIMEOUT_MS;
  const redirectUrl = requireHttpsTransportUrl(
    request.redirectUrl ?? buildIdentityVerificationRedirectUrl(request.identityVerificationId),
    "PortOne/PASS redirect URL",
    { allowLoopbackInDevelopment: true },
  );
  let timeoutId = 0;
  let sdkError: unknown = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new DOMException("본인인증 시간이 길어 요청을 중단했어요.", "TimeoutError")),
      timeoutMs,
    );
  });

  const sdkPromise = requestIdentityVerification({
    ...request,
    redirectUrl,
    popup: {
      center: true,
      ...request.popup,
    },
  }).catch((error: unknown) => {
    sdkError = error;
    return null;
  });

  try {
    const firstResult = await Promise.race([
      sdkPromise,
      callback.promise,
      abortWaiter.promise,
      timeoutPromise,
    ]);
    if (firstResult?.identityVerificationId) return firstResult;

    const callbackResult = await Promise.race([callback.promise, wait(1500)]);
    if (callbackResult?.identityVerificationId) return callbackResult;

    if (sdkError) throw sdkError;
    return firstResult;
  } finally {
    window.clearTimeout(timeoutId);
    abortWaiter.dispose();
    callback.dispose();
  }
}
