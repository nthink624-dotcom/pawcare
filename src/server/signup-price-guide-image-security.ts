import { createHash } from "node:crypto";

import sharp from "sharp";

export const SIGNUP_PRICE_GUIDE_IMAGE_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputBytes: 6 * 1024 * 1024,
  maxWidth: 8_000,
  maxHeight: 8_000,
  maxPixels: 40_000_000,
  maxFrames: 1,
  outputMaxDimension: 3_200,
  timeoutSeconds: 12,
} as const;

export type SignupPriceGuideImageCode =
  | "IMAGE_EMPTY"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_TYPE_NOT_ALLOWED"
  | "IMAGE_MIME_MISMATCH"
  | "IMAGE_TRUNCATED_OR_POLYGLOT"
  | "IMAGE_DIMENSIONS_EXCEEDED"
  | "IMAGE_ANIMATED"
  | "IMAGE_DECODE_FAILED"
  | "IMAGE_REENCODE_FAILED";

export class SignupPriceGuideImageError extends Error {
  public readonly code: SignupPriceGuideImageCode;
  public readonly status: number;

  constructor(
    code: SignupPriceGuideImageCode,
    message: string,
    status = 400,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const allowedMimeByFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type AllowedFormat = keyof typeof allowedMimeByFormat;

function detectContainer(bytes: Buffer): AllowedFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "webp";
  return null;
}

function hasExactContainerLength(bytes: Buffer, format: AllowedFormat) {
  if (format === "jpeg") {
    return bytes.length >= 4 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (format === "png") {
    return bytes.length >= 20 && bytes.subarray(bytes.length - 8, bytes.length - 4).toString("ascii") === "IEND";
  }
  return bytes.length >= 12 && bytes.readUInt32LE(4) + 8 === bytes.length;
}

export type SanitizedSignupPriceGuideImage = {
  buffer: Buffer;
  fileHash: string;
  inputFormat: AllowedFormat;
  inputWidth: number;
  inputHeight: number;
  outputMimeType: "image/jpeg";
  exifRemoved: true;
};

export async function sanitizeSignupPriceGuideImage(input: {
  bytes: Buffer;
  declaredMimeType: string;
}): Promise<SanitizedSignupPriceGuideImage> {
  const { bytes } = input;
  if (bytes.length === 0) {
    throw new SignupPriceGuideImageError("IMAGE_EMPTY", "빈 이미지 파일은 사용할 수 없습니다.");
  }
  if (bytes.length > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxInputBytes) {
    throw new SignupPriceGuideImageError("IMAGE_TOO_LARGE", "요금표 사진은 8MB 이하로 올려 주세요.", 413);
  }

  const inputFormat = detectContainer(bytes);
  if (!inputFormat) {
    throw new SignupPriceGuideImageError("IMAGE_TYPE_NOT_ALLOWED", "JPEG, PNG, WebP 이미지만 사용할 수 있습니다.");
  }
  if (allowedMimeByFormat[inputFormat] !== input.declaredMimeType) {
    throw new SignupPriceGuideImageError("IMAGE_MIME_MISMATCH", "파일 확장자와 실제 이미지 형식이 일치하지 않습니다.");
  }
  if (!hasExactContainerLength(bytes, inputFormat)) {
    throw new SignupPriceGuideImageError(
      "IMAGE_TRUNCATED_OR_POLYGLOT",
      "손상되었거나 다른 데이터가 섞인 이미지는 사용할 수 없습니다.",
    );
  }

  try {
    const decoder = sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxPixels,
      sequentialRead: true,
    }).timeout({ seconds: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.timeoutSeconds });
    const metadata = await decoder.metadata();
    if (metadata.format !== inputFormat) {
      throw new SignupPriceGuideImageError("IMAGE_MIME_MISMATCH", "실제 디코더 형식이 업로드 형식과 일치하지 않습니다.");
    }
    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    const frames = metadata.pages ?? 1;
    if (!width || !height || width > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxWidth || height > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxHeight || width * height > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxPixels) {
      throw new SignupPriceGuideImageError("IMAGE_DIMENSIONS_EXCEEDED", "이미지 가로·세로 또는 전체 픽셀 수가 허용 범위를 넘었습니다.", 413);
    }
    if (frames > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxFrames) {
      throw new SignupPriceGuideImageError("IMAGE_ANIMATED", "움직이는 이미지는 사용할 수 없습니다.");
    }

    const sanitized = await sharp(bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxPixels,
      sequentialRead: true,
    })
      .timeout({ seconds: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.timeoutSeconds })
      .rotate()
      .resize({
        width: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.outputMaxDimension,
        height: SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.outputMaxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, progressive: false, chromaSubsampling: "4:2:0" })
      .toBuffer();

    if (sanitized.length === 0 || sanitized.length > SIGNUP_PRICE_GUIDE_IMAGE_LIMITS.maxOutputBytes) {
      sanitized.fill(0);
      throw new SignupPriceGuideImageError("IMAGE_REENCODE_FAILED", "안전한 이미지로 변환하지 못했습니다.");
    }

    return {
      buffer: sanitized,
      fileHash: createHash("sha256").update(sanitized).digest("hex"),
      inputFormat,
      inputWidth: width,
      inputHeight: height,
      outputMimeType: "image/jpeg",
      exifRemoved: true,
    };
  } catch (cause) {
    if (cause instanceof SignupPriceGuideImageError) throw cause;
    throw new SignupPriceGuideImageError(
      "IMAGE_DECODE_FAILED",
      cause instanceof Error && cause.message.toLowerCase().includes("timeout")
        ? "이미지 처리 시간이 초과되었습니다. 더 작은 사진으로 다시 시도해 주세요."
        : "손상된 이미지이거나 안전하게 읽을 수 없는 파일입니다.",
    );
  }
}
