import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { nowIso } from "@/lib/utils";
import { seedDemoDataForShop } from "@/server/demo-seed";

const DEV_OWNER = {
  loginId: "devowner",
  password: "test1234",
  name: "테스트 오너",
  birthDate: "19900101",
  phoneNumber: "01012345678",
  shopName: "테스트 살롱",
  shopAddress: "서울시 성동구 테스트로 1",
};

function mapDevSetupError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (
    (normalized.includes("owner_profiles") || normalized.includes("shops")) &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  ) {
    return "새 개발용 Supabase에 아직 마이그레이션이 적용되지 않았어요. SQL Editor에서 supabase/migrations의 SQL을 먼저 적용해 주세요.";
  }

  return message ?? "개발용 테스트 계정을 만들지 못했습니다.";
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "개발 환경에서만 사용할 수 있는 기능입니다." }, { status: 404 });
  }

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ message: "Supabase 환경 변수를 먼저 확인해 주세요." }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
  }

  const authEmail = buildOwnerAuthEmail(DEV_OWNER.loginId);
  const profilesResult = await supabase
    .from("owner_profiles")
    .select("user_id, shop_id")
    .eq("login_id", DEV_OWNER.loginId)
    .maybeSingle();

  if (profilesResult.error) {
    return NextResponse.json({ message: mapDevSetupError(profilesResult.error.message) }, { status: 400 });
  }

  const listedUsers = await supabase.auth.admin.listUsers();
  if (listedUsers.error) {
    return NextResponse.json({ message: mapDevSetupError(listedUsers.error.message) }, { status: 400 });
  }

  let authUser = listedUsers.data.users.find((user) => user.email === authEmail) ?? null;

  if (!authUser) {
    const createdUser = await supabase.auth.admin.createUser({
      email: authEmail,
      password: DEV_OWNER.password,
      email_confirm: true,
      user_metadata: {
        login_id: DEV_OWNER.loginId,
        name: DEV_OWNER.name,
        subscription_status: "trialing",
        current_plan_code: "trial",
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      return NextResponse.json({ message: mapDevSetupError(createdUser.error?.message) }, { status: 400 });
    }

    authUser = createdUser.data.user;
  } else {
    const updatedUser = await supabase.auth.admin.updateUserById(authUser.id, { password: DEV_OWNER.password });
    if (updatedUser.error) {
      return NextResponse.json({ message: mapDevSetupError(updatedUser.error.message) }, { status: 400 });
    }
  }

  const now = nowIso();
  const shopId = profilesResult.data?.shop_id ?? `dev-shop-${randomUUID().slice(0, 8)}`;

  if (!profilesResult.data?.shop_id) {
    const shopInsert = await supabase.from("shops").insert({
      id: shopId,
      owner_user_id: authUser.id,
      name: DEV_OWNER.shopName,
      phone: DEV_OWNER.phoneNumber,
      address: DEV_OWNER.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 2,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      approval_mode: "manual",
      notification_settings: defaultShopNotificationSettings,
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      return NextResponse.json({ message: mapDevSetupError(shopInsert.error.message) }, { status: 400 });
    }
  } else {
    await supabase
      .from("shops")
      .update({
        owner_user_id: authUser.id,
        name: DEV_OWNER.shopName,
        phone: DEV_OWNER.phoneNumber,
        address: DEV_OWNER.shopAddress,
        updated_at: now,
      })
      .eq("id", shopId);
  }

  const profileUpsert = await supabase.from("owner_profiles").upsert({
    user_id: authUser.id,
    shop_id: shopId,
    login_id: DEV_OWNER.loginId,
    name: DEV_OWNER.name,
    birth_date: DEV_OWNER.birthDate,
    phone_number: DEV_OWNER.phoneNumber,
    identity_verified_at: now,
    agreements: {
      agreed_at: now,
      agreements: { service: true, privacy: true, location: false, marketing: false },
      terms_version: "dev-seed",
    },
    created_at: now,
    updated_at: now,
  });

  if (profileUpsert.error) {
    return NextResponse.json({ message: mapDevSetupError(profileUpsert.error.message) }, { status: 400 });
  }

  await seedDemoDataForShop(shopId, DEV_OWNER.shopName, DEV_OWNER.shopAddress);

  return NextResponse.json({
    success: true,
    loginId: DEV_OWNER.loginId,
    password: DEV_OWNER.password,
    shopId,
    message: "개발용 테스트 오너 계정을 준비했어요. 바로 로그인해 보세요.",
  });
}
