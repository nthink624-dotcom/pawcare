import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createPet, updatePet } from "@/server/owner-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    const result = await createPet(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "반려동물 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request);
    const result = await updatePet(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "반려동물 수정에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
