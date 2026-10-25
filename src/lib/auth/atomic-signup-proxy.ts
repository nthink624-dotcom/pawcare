export type AtomicSignupProxyResult = {
  status: number;
  body: string;
  contentType: string;
};

export const ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION = "SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1";
export const MAX_SIGNUP_REQUEST_BYTES = 64 * 1024;
export const MAX_SIGNUP_RESPONSE_BYTES = 64 * 1024;
export const UPSTREAM_TIMEOUT_MS = 8_000;

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

const unavailable = (): AtomicSignupProxyResult => ({
  status: 503,
  body: JSON.stringify({
    code: "ATOMIC_SIGNUP_MIGRATION_REQUIRED",
    message: "원자 가입 저장 환경을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
  }),
  contentType: JSON_CONTENT_TYPE,
});

const bodyTooLarge = (): AtomicSignupProxyResult => ({
  status: 413,
  body: JSON.stringify({ code: "SIGNUP_REQUEST_TOO_LARGE", message: "회원가입 요청 크기가 너무 큽니다." }),
  contentType: JSON_CONTENT_TYPE,
});

const invalidRequest = (): AtomicSignupProxyResult => ({
  status: 400,
  body: JSON.stringify({ code: "INVALID_SIGNUP_REQUEST", message: "회원가입 요청을 처리할 수 없습니다." }),
  contentType: JSON_CONTENT_TYPE,
});

function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

async function readBoundedStream(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) return { text: "", tooLarge: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), tooLarge: false };
}

function approvedMainOrigin(input: { origin: string | undefined; nodeEnv: string | undefined; allowLocalFixture: boolean }) {
  if (!input.origin) return null;
  try {
    const url = new URL(input.origin);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;

    const isProduction = input.nodeEnv === "production";
    const productionHosts = new Set(["www.petmanager.co.kr", "petmanager.co.kr"]);
    const isAllowedProductionOrigin = isProduction && url.protocol === "https:" && url.port === "" && productionHosts.has(url.hostname);
    const isAllowedLocalFixture = !isProduction && input.allowLocalFixture && url.origin === "http://127.0.0.1:3000";
    return isAllowedProductionOrigin || isAllowedLocalFixture ? url.origin : null;
  } catch {
    return null;
  }
}

function isJson(response: Response) {
  return response.headers.get("content-type")?.toLocaleLowerCase().includes("application/json") ?? false;
}

export async function readAtomicSignupRequest(input: {
  contentLength: string | null;
  contentType: string | null;
  body: ReadableStream<Uint8Array> | null;
}) {
  const declaredLength = input.contentLength ? Number(input.contentLength) : null;
  if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > MAX_SIGNUP_REQUEST_BYTES)) {
    return { error: bodyTooLarge() };
  }
  if (input.contentType && !input.contentType.toLocaleLowerCase().startsWith("application/json")) return { error: invalidRequest() };

  const result = await readBoundedStream(input.body, MAX_SIGNUP_REQUEST_BYTES);
  return result.tooLarge ? { error: bodyTooLarge() } : { payload: result.text };
}

export async function forwardAtomicSignupRequest(input: {
  enabled: boolean;
  mainOrigin: string | undefined;
  nodeEnv: string | undefined;
  allowLocalFixture: boolean;
  payload: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<AtomicSignupProxyResult> {
  if (!input.enabled) return unavailable();
  if (byteLength(input.payload) > MAX_SIGNUP_REQUEST_BYTES) return bodyTooLarge();

  const origin = approvedMainOrigin({ origin: input.mainOrigin, nodeEnv: input.nodeEnv, allowLocalFixture: input.allowLocalFixture });
  if (!origin) return unavailable();
  if (input.signal?.aborted) return unavailable();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const cancelUpstream = () => controller.abort();
  input.signal?.addEventListener("abort", cancelUpstream, { once: true });

  try {
    const response = await (input.fetchImpl ?? fetch)(`${origin}/api/auth/signup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-petmanager-signup-contract-version": ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
      },
      body: input.payload,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) return unavailable();
    if (response.status >= 500 || !isJson(response)) return unavailable();

    const bounded = await readBoundedStream(response.body, MAX_SIGNUP_RESPONSE_BYTES);
    if (bounded.tooLarge || !bounded.text) return unavailable();
    try {
      JSON.parse(bounded.text);
    } catch {
      return unavailable();
    }

    return { status: response.status, body: bounded.text, contentType: JSON_CONTENT_TYPE };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", cancelUpstream);
  }
}
