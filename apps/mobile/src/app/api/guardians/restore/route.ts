import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { restoreGuardians } from "@/server/owner-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request);
    const result = await restoreGuardians(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "고객 복구에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
