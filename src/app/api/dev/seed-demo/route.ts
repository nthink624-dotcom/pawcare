import { NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { seedDemoDataForShop } from "@/server/demo-seed";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "개발 환경에서만 사용할 수 있습니다." }, { status: 404 });
  }

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase 관리자 연결을 확인할 수 없습니다." }, { status: 503 });
  }

  const shopsResult = await supabase.from("shops").select("id, name, address").order("created_at");
  if (shopsResult.error) {
    return NextResponse.json({ message: shopsResult.error.message }, { status: 500 });
  }

  for (const shop of shopsResult.data ?? []) {
    await seedDemoDataForShop(
      shop.id,
      shop.name || "테스트 매장",
      shop.address || "서울시 강남구 테스트로 1",
    );
  }

  return NextResponse.json({
    ok: true,
    count: shopsResult.data?.length ?? 0,
    message: "테스트 예약 데이터를 채웠습니다.",
  });
}
