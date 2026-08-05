import { NextRequest, NextResponse } from "next/server";

import { commitDataImport } from "@/server/data-import-commit";
import { buildDataImportPreview } from "@/server/data-import-preview";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import type { DataImportSource } from "@/types/data-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function parseSource(value: FormDataEntryValue | null): DataImportSource {
  return value === "generic" ? "generic" : "teepee";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const shopId = String(formData.get("shopId") ?? "").trim();
    const mode = formData.get("mode") === "commit" ? "commit" : "preview";
    const source = parseSource(formData.get("source"));
    if (!(file instanceof File) || file.size === 0) {
      throw new OwnerApiError("이전할 엑셀 파일을 선택해 주세요.", 400);
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new OwnerApiError("이전 파일은 최대 10MB까지 올릴 수 있습니다.", 413);
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "xlsx" && extension !== "csv") {
      throw new OwnerApiError(".xlsx 또는 .csv 파일만 올릴 수 있습니다.", 400);
    }

    const owner = await requireOwnerShop(request, shopId || undefined);
    assertOwnerOrManager(owner);
    const buffer = Buffer.from(await file.arrayBuffer());

    if (mode === "commit") {
      const result = await commitDataImport({
        shopId: owner.shopId,
        userId: owner.userId,
        source,
        fileName: file.name,
        buffer,
      });
      return NextResponse.json(result);
    }

    const { preview } = await buildDataImportPreview({
      shopId: owner.shopId,
      source,
      fileName: file.name,
      buffer,
    });
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "데이터 이전 파일을 처리하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
