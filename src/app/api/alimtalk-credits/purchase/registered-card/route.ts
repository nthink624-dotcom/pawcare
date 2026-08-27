import { NextRequest, NextResponse } from "next/server";
import { OwnerBillingError } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

export async function POST(request: NextRequest) {
  try {
    await requireOwnerBillingSession(request);
    return NextResponse.json(
      { message: "알림톡은 요금제에 포함되며 추가 이용권은 판매하지 않습니다." },
      { status: 503 },
    );
  } catch (error) {
    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "알림톡 추가 구매 경로를 확인하지 못했습니다." }, { status: 500 });
  }
}
