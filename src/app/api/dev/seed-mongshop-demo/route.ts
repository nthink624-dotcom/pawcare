import { NextResponse } from "next/server";

import { isDevelopmentDemoEnvironment } from "@/lib/development-demo";
import { seedMongshopDevelopmentDemo } from "@/server/mongshop-development-demo-seed";

export async function POST() {
  if (!isDevelopmentDemoEnvironment()) {
    return NextResponse.json({ message: "개발 환경에서만 사용할 수 있습니다." }, { status: 404 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await seedMongshopDevelopmentDemo()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "멍샵몽샵 데모 시드에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
