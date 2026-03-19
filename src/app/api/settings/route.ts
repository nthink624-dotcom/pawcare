import { NextRequest, NextResponse } from "next/server";

import { updateShopSettings } from "@/server/repositories/app-repository";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateShopSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "설정을 저장하지 못했습니다." }, { status: 400 });
  }
}
