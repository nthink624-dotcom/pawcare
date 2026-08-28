export const SIGNUP_PRICE_GUIDE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const SIGNUP_PRICE_GUIDE_MULTIPART_OVERHEAD_BYTES = 512 * 1024;
export const SIGNUP_PRICE_GUIDE_MULTIPART_MAX_BYTES =
  SIGNUP_PRICE_GUIDE_IMAGE_MAX_BYTES + SIGNUP_PRICE_GUIDE_MULTIPART_OVERHEAD_BYTES;
export const SIGNUP_PRICE_GUIDE_BODY_TIMEOUT_MS = 15_000;

export type SignupPriceGuideMultipartCode =
  | "MULTIPART_REQUIRED"
  | "CONTENT_LENGTH_INVALID"
  | "REQUEST_BODY_TOO_LARGE"
  | "REQUEST_BODY_TIMEOUT"
  | "REQUEST_BODY_UNAVAILABLE"
  | "MULTIPART_INVALID";

export class SignupPriceGuideMultipartError extends Error {
  public readonly code: SignupPriceGuideMultipartCode;
  public readonly status: number;

  constructor(code: SignupPriceGuideMultipartCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function parseDeclaredLength(value: string | null) {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) {
    throw new SignupPriceGuideMultipartError("CONTENT_LENGTH_INVALID", "업로드 크기 정보를 확인할 수 없습니다.", 400);
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new SignupPriceGuideMultipartError("CONTENT_LENGTH_INVALID", "업로드 크기 정보를 확인할 수 없습니다.", 400);
  }
  return length;
}

async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadlineMs: number,
) {
  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) {
    throw new SignupPriceGuideMultipartError("REQUEST_BODY_TIMEOUT", "사진 업로드 시간이 초과되었습니다. 다시 시도해 주세요.", 408);
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new SignupPriceGuideMultipartError("REQUEST_BODY_TIMEOUT", "사진 업로드 시간이 초과되었습니다. 다시 시도해 주세요.", 408)),
          remainingMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function readBoundedSignupPriceGuideBody(
  request: Request,
  options: { maxBytes?: number; timeoutMs?: number; nowMs?: number } = {},
) {
  const maxBytes = options.maxBytes ?? SIGNUP_PRICE_GUIDE_MULTIPART_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? SIGNUP_PRICE_GUIDE_BODY_TIMEOUT_MS;
  const declaredLength = parseDeclaredLength(request.headers.get("content-length"));
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new SignupPriceGuideMultipartError("REQUEST_BODY_TOO_LARGE", "사진 요청 전체 크기는 8.5MB를 넘을 수 없습니다.", 413);
  }
  if (!request.body) {
    throw new SignupPriceGuideMultipartError("REQUEST_BODY_UNAVAILABLE", "사진 업로드 본문이 없습니다.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  const deadlineMs = (options.nowMs ?? Date.now()) + timeoutMs;
  let totalBytes = 0;
  let output: Buffer | null = null;
  try {
    while (true) {
      const { done, value } = await readWithDeadline(reader, deadlineMs);
      if (done) break;
      if (!value?.byteLength) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        throw new SignupPriceGuideMultipartError("REQUEST_BODY_TOO_LARGE", "사진 요청 전체 크기는 8.5MB를 넘을 수 없습니다.", 413);
      }
      chunks.push(value);
    }
    output = Buffer.allocUnsafe(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } catch (cause) {
    await reader.cancel("request body rejected").catch(() => undefined);
    output?.fill(0);
    throw cause;
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    reader.releaseLock();
  }
}

export async function parseBoundedSignupPriceGuideMultipart(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/boundary=/i.test(contentType)) {
    throw new SignupPriceGuideMultipartError("MULTIPART_REQUIRED", "사진 업로드 형식이 올바르지 않습니다.", 415);
  }
  const bytes = await readBoundedSignupPriceGuideBody(request);
  try {
    const response = new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } });
    return await response.formData();
  } catch {
    throw new SignupPriceGuideMultipartError("MULTIPART_INVALID", "사진 업로드 내용을 읽지 못했습니다.", 400);
  } finally {
    bytes.fill(0);
  }
}
