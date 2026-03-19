import { NextRequest, NextResponse } from "next/server";

import { createPet, updatePet } from "@/server/repositories/app-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createPet(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "반려견을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updatePet(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "??? ??? ???? ?????." }, { status: 400 });
  }
}
