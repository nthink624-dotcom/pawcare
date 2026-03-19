import { NextRequest, NextResponse } from "next/server";

import { submitLandingFeedback } from "@/server/repositories/app-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await submitLandingFeedback(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "피드백을 저장하지 못했습니다." }, { status: 400 });
  }
}
