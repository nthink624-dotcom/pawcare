import sharp from "sharp";

const MAX_SOURCE_IMAGES = 5;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const OUTPUT_MAX_DIMENSION = 2_200;
const HEADER_REDACTION_RATIO = 0.18;
const FOOTER_REDACTION_RATIO = 0.18;
const SIDE_REDACTION_RATIO = 0.025;

export const PRICE_GUIDE_PRIVACY_WARNING =
  "사진 위·아래의 이름·전화번호·주소 가능 영역을 가린 뒤 분석했습니다. 잘린 요금이나 표 안의 개인정보가 없는지 확인해 주세요.";

export type PriceGuideProviderImage = {
  buffer: Buffer;
  sourceIndex: number;
  kind: "redacted_full" | "content_crop";
  cropIndex: number | null;
  width: number;
  height: number;
};

export class PriceGuideImagePrivacyError extends Error {
  constructor(
    public readonly code: "IMAGE_SOURCE_INVALID" | "IMAGE_SOURCE_TOO_LARGE" | "IMAGE_PRIVACY_PROCESSING_FAILED",
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "PriceGuideImagePrivacyError";
  }
}

function whitePanel(width: number, height: number) {
  return {
    create: {
      width,
      height,
      channels: 3 as const,
      background: "#ffffff",
    },
  };
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.map((value) => Math.max(0, Math.round(value))))];
}

async function prepareOneSource(buffer: Buffer, sourceIndex: number): Promise<PriceGuideProviderImage[]> {
  if (buffer.length === 0) {
    throw new PriceGuideImagePrivacyError("IMAGE_SOURCE_INVALID", "빈 요금표 사진은 분석할 수 없습니다.");
  }
  if (buffer.length > MAX_SOURCE_BYTES) {
    throw new PriceGuideImagePrivacyError(
      "IMAGE_SOURCE_TOO_LARGE",
      "요금표 사진을 안전한 크기로 줄이지 못했습니다. 더 작은 사진으로 다시 시도해 주세요.",
      413,
    );
  }

  let normalized: Buffer | null = null;
  try {
    const normalizedResult = await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: OUTPUT_MAX_DIMENSION,
        height: OUTPUT_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, progressive: false, chromaSubsampling: "4:4:4" })
      .toBuffer({ resolveWithObject: true });

    normalized = normalizedResult.data;
    const width = normalizedResult.info.width;
    const height = normalizedResult.info.height;
    if (width < 320 || height < 320) {
      throw new PriceGuideImagePrivacyError(
        "IMAGE_SOURCE_INVALID",
        "요금표 글자를 읽기에는 사진이 너무 작습니다. 표 전체가 선명한 사진을 선택해 주세요.",
      );
    }

    const headerHeight = Math.max(44, Math.min(Math.round(height * HEADER_REDACTION_RATIO), Math.floor(height * 0.28)));
    const footerHeight = Math.max(44, Math.min(Math.round(height * FOOTER_REDACTION_RATIO), Math.floor(height * 0.28)));
    const sideWidth = Math.max(8, Math.min(Math.round(width * SIDE_REDACTION_RATIO), Math.floor(width * 0.08)));
    const contentTop = headerHeight;
    const contentLeft = sideWidth;
    const contentWidth = width - (sideWidth * 2);
    const contentHeight = height - headerHeight - footerHeight;
    if (contentWidth < 240 || contentHeight < 180) {
      throw new PriceGuideImagePrivacyError(
        "IMAGE_SOURCE_INVALID",
        "개인정보 가능 영역을 제외한 요금표 부분이 너무 작습니다. 요금표만 보이도록 다시 촬영해 주세요.",
      );
    }

    const redactedFull = await sharp(normalized)
      .composite([
        { input: whitePanel(width, headerHeight), left: 0, top: 0 },
        { input: whitePanel(width, footerHeight), left: 0, top: height - footerHeight },
        { input: whitePanel(sideWidth, contentHeight), left: 0, top: contentTop },
        { input: whitePanel(sideWidth, contentHeight), left: width - sideWidth, top: contentTop },
      ])
      .jpeg({ quality: 88, progressive: false, chromaSubsampling: "4:4:4" })
      .toBuffer();

    const result: PriceGuideProviderImage[] = [{
      buffer: redactedFull,
      sourceIndex,
      kind: "redacted_full",
      cropIndex: null,
      width,
      height,
    }];

    const tallTable = contentHeight > contentWidth * 1.4;
    const cropHeight = tallTable
      ? Math.min(contentHeight, Math.max(360, Math.round(contentWidth * 1.25)))
      : contentHeight;
    const cropOffsets = tallTable ? uniqueNumbers([0, contentHeight - cropHeight]) : [0];

    for (const [cropIndex, offset] of cropOffsets.entries()) {
      const crop = await sharp(normalized)
        .extract({
          left: contentLeft,
          top: contentTop + offset,
          width: contentWidth,
          height: Math.min(cropHeight, contentHeight - offset),
        })
        .jpeg({ quality: 90, progressive: false, chromaSubsampling: "4:4:4" })
        .toBuffer({ resolveWithObject: true });
      result.push({
        buffer: crop.data,
        sourceIndex,
        kind: "content_crop",
        cropIndex,
        width: crop.info.width,
        height: crop.info.height,
      });
    }

    return result;
  } catch (cause) {
    if (cause instanceof PriceGuideImagePrivacyError) throw cause;
    throw new PriceGuideImagePrivacyError(
      "IMAGE_PRIVACY_PROCESSING_FAILED",
      "사진의 개인정보 가능 영역을 안전하게 가리지 못했습니다. 사진 없이 직접 입력해 주세요.",
    );
  } finally {
    normalized?.fill(0);
  }
}

export async function preparePriceGuideProviderImages(sourceBuffers: Buffer[]) {
  if (sourceBuffers.length === 0 || sourceBuffers.length > MAX_SOURCE_IMAGES) {
    throw new PriceGuideImagePrivacyError(
      "IMAGE_SOURCE_INVALID",
      "요금표 사진은 1장부터 5장까지 선택해 주세요.",
      400,
    );
  }

  const prepared: PriceGuideProviderImage[] = [];
  try {
    for (const [index, buffer] of sourceBuffers.entries()) {
      prepared.push(...await prepareOneSource(buffer, index));
    }
    return prepared;
  } catch (cause) {
    prepared.forEach((image) => image.buffer.fill(0));
    throw cause;
  }
}

export function toPriceGuideProviderDataUrl(image: Pick<PriceGuideProviderImage, "buffer">) {
  return `data:image/jpeg;base64,${image.buffer.toString("base64")}`;
}
