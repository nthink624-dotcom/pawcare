export const MAX_ATOMIC_SIGNUP_JSON_BYTES = 64 * 1024;

export class SignupJsonBodyError extends Error {
  constructor(
    public readonly code: "SIGNUP_BODY_TOO_LARGE" | "SIGNUP_BODY_INVALID" | "SIGNUP_CONTENT_TYPE_INVALID" | "SIGNUP_CONTENT_ENCODING_UNSUPPORTED",
    message: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "SignupJsonBodyError";
  }
}

export async function parseBoundedAtomicSignupJson(
  request: Pick<Request, "headers" | "body">,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new SignupJsonBodyError(
      "SIGNUP_CONTENT_TYPE_INVALID",
      "회원가입 요청 형식이 올바르지 않습니다.",
      415,
    );
  }
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    throw new SignupJsonBodyError(
      "SIGNUP_CONTENT_ENCODING_UNSUPPORTED",
      "압축된 회원가입 요청은 지원하지 않습니다.",
      415,
    );
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null) {
    if (!/^\d+$/.test(lengthHeader)) {
      throw new SignupJsonBodyError("SIGNUP_BODY_INVALID", "회원가입 요청을 확인해 주세요.", 400);
    }
    const declaredLength = Number(lengthHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > MAX_ATOMIC_SIGNUP_JSON_BYTES) {
      throw new SignupJsonBodyError(
        "SIGNUP_BODY_TOO_LARGE",
        "회원가입 요청 크기를 줄인 뒤 다시 시도해 주세요.",
        413,
      );
    }
  }

  if (!request.body) {
    throw new SignupJsonBodyError("SIGNUP_BODY_INVALID", "회원가입 요청을 확인해 주세요.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ATOMIC_SIGNUP_JSON_BYTES) {
        await reader.cancel("signup body limit exceeded").catch(() => undefined);
        throw new SignupJsonBodyError(
          "SIGNUP_BODY_TOO_LARGE",
          "회원가입 요청 크기를 줄인 뒤 다시 시도해 주세요.",
          413,
        );
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text) as unknown;
    } catch {
      throw new SignupJsonBodyError("SIGNUP_BODY_INVALID", "회원가입 요청을 확인해 주세요.", 400);
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    if (error instanceof SignupJsonBodyError) throw error;
    throw new SignupJsonBodyError("SIGNUP_BODY_INVALID", "회원가입 요청을 확인해 주세요.", 400);
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    reader.releaseLock();
  }
}
