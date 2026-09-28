import { NextRequest } from "next/server";

import { uploadOwnerMediaFile } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let shopId: string | undefined;
    let mediaAssetId = "";
    let file: File;
    if (contentType.startsWith("image/")) {
      shopId = request.headers.get("x-petmanager-shop-id") ?? undefined;
      mediaAssetId = request.headers.get("x-petmanager-media-asset-id") ?? "";
      const bytes = Buffer.from(await request.arrayBuffer());
      file = new File([bytes], request.headers.get("x-petmanager-file-name") ?? "price-guide.webp", { type: contentType });
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      shopId = typeof body.shopId === "string" ? body.shopId : undefined;
      mediaAssetId = typeof body.mediaAssetId === "string" ? body.mediaAssetId : "";
      const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : "";
      const suppliedContentType = typeof body.contentType === "string" ? body.contentType : "";
      if (!fileBase64 || !suppliedContentType) throw new OwnerApiError("Media file is required.", 400);
      const bytes = Buffer.from(fileBase64, "base64");
      file = new File([bytes], typeof body.fileName === "string" ? body.fileName : "price-guide.webp", { type: suppliedContentType });
    } else {
      const form = await request.formData();
      shopId = typeof form.get("shopId") === "string" ? form.get("shopId") as string : undefined;
      mediaAssetId = typeof form.get("mediaAssetId") === "string" ? form.get("mediaAssetId") as string : "";
      const formFile = form.get("file");
      if (!(formFile instanceof File)) throw new OwnerApiError("Media file is required.", 400);
      file = formFile;
    }
    const owner = await requireOwnerShop(request, shopId);
    const result = await uploadOwnerMediaFile(owner, { mediaAssetId, file });
    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload media.";
    const status = error instanceof OwnerApiError ? error.status : 500;
    return ownerMobileCorsJson(request, { message }, { status }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
