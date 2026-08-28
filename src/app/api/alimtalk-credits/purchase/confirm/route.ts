import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { message: "알림톡 추가 발송 이용권 판매가 종료되었습니다." },
    { status: 410 },
  );
}
