import { NextResponse } from "next/server";

import {
  MongshopMobileEmbedError,
  getMongshopMobileBookings,
} from "@/server/mongshop-mobile";

export const dynamic = "force-dynamic";

// No X-Frame-Options or frame-ancestors header is set here: PC dashboard embeds this read-only view.
export async function GET() {
  try {
    const payload = await getMongshopMobileBookings();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const status = error instanceof MongshopMobileEmbedError ? error.status : 500;
    const message =
      error instanceof MongshopMobileEmbedError
        ? error.message
        : "예약 목록을 불러오는 중 문제가 발생했습니다.";

    return NextResponse.json(
      { message },
      {
        status,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
