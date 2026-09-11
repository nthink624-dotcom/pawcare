import sharp from "sharp";

const REQUIRED_SOURCE_IMAGE_COUNT = 1;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const OUTPUT_MAX_DIMENSION = 2_200;
const MAX_READABILITY_SCALE = 2;

export const PRICE_GUIDE_PRIVACY_WARNING =
  "사진 파일의 위치 정보 등 메타데이터를 제거한 뒤 표 전체를 분석했습니다. 이름·전화번호·주소가 없는 사진인지 다시 확인해 주세요.";

export type PriceGuideProviderImage = {
  buffer: Buffer;
  sourceIndex: number;
  kind: "privacy_normalized_full";
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
    const sourceMetadata = await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
    const sourceWidth = sourceMetadata.width ?? 0;
    const sourceHeight = sourceMetadata.height ?? 0;
    if (sourceWidth < 320 || sourceHeight < 320) {
      throw new PriceGuideImagePrivacyError(
        "IMAGE_SOURCE_INVALID",
        "요금표 글자를 읽기에는 사진이 너무 작습니다. 표 전체가 선명한 사진을 선택해 주세요.",
      );
    }
    const swapsAxes = [5, 6, 7, 8].includes(sourceMetadata.orientation ?? 1);
    const orientedWidth = swapsAxes ? sourceHeight : sourceWidth;
    const orientedHeight = swapsAxes ? sourceWidth : sourceHeight;
    const scale = Math.min(
      MAX_READABILITY_SCALE,
      OUTPUT_MAX_DIMENSION / Math.max(orientedWidth, orientedHeight),
    );
    const targetWidth = Math.max(1, Math.round(orientedWidth * scale));
    const targetHeight = Math.max(1, Math.round(orientedHeight * scale));

    const normalizedResult = await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: "inside",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      })
      .flatten({ background: "#ffffff" })
      .sharpen({ sigma: 0.8 })
      .webp({ lossless: true, effort: 4 })
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

    // The owner confirms that the table itself contains no PII before this
    // server-only step. Re-encoding strips EXIF/location metadata while keeping
    // every photographed table edge. Small full-table images are enlarged at
    // most 2x and lightly sharpened before lossless WebP encoding so compact
    // price digits remain distinguishable. Fixed masks/crops are intentionally
    // avoided because they can remove headings or duplicate table cells.
    const result: PriceGuideProviderImage[] = [{
      buffer: Buffer.from(normalized),
      sourceIndex,
      kind: "privacy_normalized_full",
      cropIndex: null,
      width,
      height,
    }];
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
  if (sourceBuffers.length !== REQUIRED_SOURCE_IMAGE_COUNT) {
    throw new PriceGuideImagePrivacyError(
      "IMAGE_SOURCE_INVALID",
      "요금표 사진은 한 장만 선택해 주세요.",
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
  return `data:image/webp;base64,${image.buffer.toString("base64")}`;
}
