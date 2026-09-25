import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createMediaUploadIntent } from "@/server/owner-media-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    const result = await createMediaUploadIntent(
      { shopId: owner.shopId, userId: owner.userId },
      {
        originalFileName: body?.originalFileName,
        contentType: body?.contentType,
        byteSize: Number(body?.byteSize ?? 0),
        sourceByteSize: body?.sourceByteSize ?? null,
        width: body?.width ?? null,
        height: body?.height ?? null,
        mediaKind: body?.mediaKind,
        visibility: body?.visibility,
        retentionPolicy: body?.retentionPolicy,
        uploadedFrom: body?.uploadedFrom,
        guardianId: body?.guardianId ?? null,
        petId: body?.petId ?? null,
        appointmentId: body?.appointmentId ?? null,
        groomingRecordId: body?.groomingRecordId ?? null,
        metadata: body?.metadata ?? {},
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 업로드를 준비하지 못했습니다." }, { status: 500 });
  }
}
