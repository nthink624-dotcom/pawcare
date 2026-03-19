import { NextRequest, NextResponse } from "next/server";

import { createGuardian, updateGuardianNotificationSettings } from "@/server/repositories/app-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createGuardian(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateGuardianNotificationSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객 알림 설정을 저장하지 못했습니다." }, { status: 400 });
  }
}
