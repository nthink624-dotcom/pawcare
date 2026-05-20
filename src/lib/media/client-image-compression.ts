import {
  PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
  PETMANAGER_MEDIA_TARGET_IMAGE_BYTES,
  PETMANAGER_MEDIA_VARIANT_PROFILES,
} from "@/lib/media/media-policy";
import type { MediaVariantKey } from "@/types/domain";

export type PetmanagerImageCompressionOptions = {
  maxLongEdge?: number;
  quality?: number;
  maxBytes?: number;
  targetBytes?: number;
  outputType?: "image/webp" | "image/jpeg";
};

export type PetmanagerCompressedImage = {
  file: File;
  width: number;
  height: number;
  sourceByteSize: number;
};

export type PetmanagerCompressedImageVariant = PetmanagerCompressedImage & {
  variantKey: MediaVariantKey;
};

const DEFAULT_MAX_LONG_EDGE = 1600;
const DEFAULT_QUALITY = 0.72;
const DEFAULT_MAX_BYTES = PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES;
const DEFAULT_TARGET_BYTES = PETMANAGER_MEDIA_TARGET_IMAGE_BYTES;

function assertBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Image compression is only available in the browser.");
  }
}

function getOutputFileName(fileName: string, outputType: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "petmanager-image";
  return `${baseName}.${outputType === "image/webp" ? "webp" : "jpg"}`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function getTargetSize(width: number, height: number, maxLongEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const ratio = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function renderCompressedBlob(params: {
  image: HTMLImageElement;
  maxLongEdge: number;
  outputType: string;
  quality: number;
}) {
  const size = getTargetSize(params.image.naturalWidth, params.image.naturalHeight, params.maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Could not prepare image canvas.");
  }

  context.drawImage(params.image, 0, 0, size.width, size.height);
  const blob = await canvasToBlob(canvas, params.outputType, params.quality);

  return {
    blob,
    width: size.width,
    height: size.height,
  };
}

export async function compressImageForPetmanager(
  file: File,
  options: PetmanagerImageCompressionOptions = {},
): Promise<PetmanagerCompressedImage> {
  assertBrowser();

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be compressed.");
  }

  const image = await loadImage(file);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const targetBytes = Math.min(options.targetBytes ?? DEFAULT_TARGET_BYTES, maxBytes);
  const outputType = options.outputType ?? "image/webp";
  const attempts = [
    { maxLongEdge: options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE, quality: options.quality ?? DEFAULT_QUALITY },
    { maxLongEdge: 1440, quality: 0.66 },
    { maxLongEdge: 1280, quality: 0.58 },
    { maxLongEdge: 1080, quality: 0.52 },
    { maxLongEdge: 960, quality: 0.48 },
  ];

  let best: { blob: Blob; width: number; height: number } | null = null;

  for (const attempt of attempts) {
    const compressed = await renderCompressedBlob({
      image,
      maxLongEdge: attempt.maxLongEdge,
      outputType,
      quality: attempt.quality,
    });
    best = compressed;
    if (compressed.blob.size <= targetBytes) break;
  }

  if (!best) {
    throw new Error("Could not compress image.");
  }

  const compressedFile = new File([best.blob], getOutputFileName(file.name, outputType), {
    type: outputType,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    width: best.width,
    height: best.height,
    sourceByteSize: file.size,
  };
}

export async function compressImageVariantsForPetmanager(
  file: File,
  variantKeys: MediaVariantKey[] = ["thumbnail", "preview", "provider_ready"],
): Promise<PetmanagerCompressedImageVariant[]> {
  const uniqueVariantKeys = [...new Set(variantKeys)];
  const variants: PetmanagerCompressedImageVariant[] = [];

  for (const variantKey of uniqueVariantKeys) {
    const profile = PETMANAGER_MEDIA_VARIANT_PROFILES[variantKey];
    const compressed = await compressImageForPetmanager(file, {
      maxLongEdge: profile.maxLongEdge,
      maxBytes: profile.maxBytes,
      targetBytes: profile.targetBytes,
      outputType: profile.outputType,
    });

    variants.push({
      ...compressed,
      variantKey,
    });
  }

  return variants;
}
