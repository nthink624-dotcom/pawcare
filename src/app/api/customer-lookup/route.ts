import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/repositories/app-repository";
import { phoneNormalize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") || undefined;
    const phone = phoneNormalize(searchParams.get("phone") || "");
    const data = await getBootstrap(shopId);
    const guardians = data.guardians.filter((item) => phoneNormalize(item.phone) === phone);
    const guardianIds = new Set(guardians.map((item) => item.id));
    const pets = data.pets.filter((item) => guardianIds.has(item.guardian_id));
    const petIds = new Set(pets.map((item) => item.id));
    const appointments = data.appointments.filter((item) => petIds.has(item.pet_id));
    const groomingRecords = data.groomingRecords.filter((item) => petIds.has(item.pet_id));
    return NextResponse.json({ guardians, pets, appointments, groomingRecords });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "조회에 실패했습니다." }, { status: 400 });
  }
}
