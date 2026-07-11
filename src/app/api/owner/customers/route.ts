import { NextRequest, NextResponse } from "next/server";

import { createGuardian, createPet } from "@/server/owner-mutations";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    const guardian = await createGuardian({
      shopId: owner.shopId,
      name: body?.name,
      phone: body?.phone,
      memo: body?.memo ?? "",
      enabled: body?.enabled,
    });
    const pet = await createPet({
      shopId: owner.shopId,
      guardianId: guardian.id,
      name: body?.pet?.name,
      breed: body?.pet?.breed,
      birthday: body?.pet?.birthday ?? null,
      weight: body?.pet?.weight ?? null,
      notes: body?.pet?.notes ?? "",
      biteLevel: body?.pet?.biteLevel ?? "none",
      groomingCycleWeeks: body?.pet?.groomingCycleWeeks ?? 4,
    });

    return NextResponse.json({ guardian, pet });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "고객 추가에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
