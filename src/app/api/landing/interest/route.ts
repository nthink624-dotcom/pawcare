import { NextRequest, NextResponse } from "next/server";

import { submitLandingInterest } from "@/server/repositories/app-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await submitLandingInterest(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "신청을 저장하지 못했습니다." }, { status: 400 });
  }
}
