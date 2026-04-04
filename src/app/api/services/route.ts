import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { upsertService } from "@/server/owner-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    const result = await upsertService(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "서비스 저장 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
