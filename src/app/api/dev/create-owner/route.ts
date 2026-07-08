import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import { getOwnerPlanIncludedAlimtalkCredits } from "@/lib/billing/owner-plans";
import { buildDefaultCustomerPageSettings } from "@/lib/customer-page-settings";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { defaultOwnerBusinessHours, defaultOwnerRegularClosedDays } from "@/lib/owner-default-setup";
import { hasSupabaseServerEnv, isUnsafeProdSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { resetShopAlimtalkIncludedCredits } from "@/server/alimtalk-credit-service";
import { seedDemoDataForShop } from "@/server/demo-seed";
import { upsertOwnerShopMembership } from "@/server/owner-shop-memberships";

const DEV_OWNER = {
  loginId: "devowner",
  password: "test1234",
  name: "테스트 오너",
  birthDate: "19900101",
  phoneNumber: "01012345678",
  shopName: "테스트 미용실",
  shopAddress: "서울특별시 강동구 테스트로 1",
};

function mapDevSetupError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (
    (normalized.includes("owner_profiles") || normalized.includes("shops")) &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  ) {
    return "개발용 Supabase에 아직 마이그레이션이 적용되지 않았어요. supabase/migrations의 SQL을 먼저 적용해 주세요.";
  }

  return message ?? "개발용 테스트 계정을 만들지 못했습니다.";
}

function buildDevSubscriptionMetadata(now: string, trialEndsAt: string) {
  return {
    subscription_status: "trialing",
    trial_started_at: now,
    trial_ends_at: trialEndsAt,
    next_billing_at: null,
    current_plan_code: "free",
    featured_plan_code: "free",
    auto_renew_plan_code: "free",
    auto_renew_enabled: false,
    cancel_at_period_end: false,
  };
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "개발 환경에서만 사용할 수 있는 기능입니다." }, { status: 404 });
  }

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ message: "Supabase 환경 변수를 먼저 확인해 주세요." }, { status: 503 });
  }

  if (isUnsafeProdSupabaseServerEnv()) {
    return NextResponse.json(
      { message: "개발용 테스트 계정 생성은 운영 Supabase를 바라보는 환경에서 실행할 수 없습니다." },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
  }

  const now = nowIso();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const authEmail = buildOwnerAuthEmail(DEV_OWNER.loginId);
  const subscriptionMetadata = buildDevSubscriptionMetadata(now, trialEndsAt);

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

  let authUser = null;
  let createdNewAuthUser = false;

  if (profilesResult.data?.user_id) {
    const existingProfileUser = await supabase.auth.admin.getUserById(profilesResult.data.user_id);
    if (existingProfileUser.error) {
      return NextResponse.json({ message: mapDevSetupError(existingProfileUser.error.message) }, { status: 400 });
    }
    authUser = existingProfileUser.data.user ?? null;
  }

  authUser = authUser ?? listedUsers.data.users.find((user) => user.email === authEmail) ?? null;

  if (!authUser) {
    const createdUser = await supabase.auth.admin.createUser({
      email: authEmail,
      password: DEV_OWNER.password,
      email_confirm: true,
      user_metadata: {
        login_id: DEV_OWNER.loginId,
        name: DEV_OWNER.name,
        ...subscriptionMetadata,
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      return NextResponse.json({ message: mapDevSetupError(createdUser.error?.message) }, { status: 400 });
    }

    authUser = createdUser.data.user;
    createdNewAuthUser = true;
  } else {
    const nextMetadata = {
      ...(authUser.user_metadata ?? {}),
      login_id: DEV_OWNER.loginId,
      name: DEV_OWNER.name,
      ...subscriptionMetadata,
    };
    const updatedUser = await supabase.auth.admin.updateUserById(authUser.id, {
      email: authEmail,
      password: DEV_OWNER.password,
      email_confirm: true,
      user_metadata: nextMetadata,
    });

    if (updatedUser.error) {
      const passwordOnlyUpdate = await supabase.auth.admin.updateUserById(authUser.id, {
        password: DEV_OWNER.password,
        email_confirm: true,
        user_metadata: nextMetadata,
      });

      if (passwordOnlyUpdate.error) {
        return NextResponse.json({ message: mapDevSetupError(passwordOnlyUpdate.error.message) }, { status: 400 });
      }

      authUser = passwordOnlyUpdate.data.user ?? authUser;
    } else {
      authUser = updatedUser.data.user ?? authUser;
    }
  }

  const shopId = profilesResult.data?.shop_id ?? `dev-shop-${randomUUID().slice(0, 8)}`;

  if (!profilesResult.data?.shop_id) {
    const shopInsert = await supabase.from("shops").insert({
      id: shopId,
      owner_user_id: authUser.id,
      name: DEV_OWNER.shopName,
      phone: DEV_OWNER.phoneNumber,
      address: DEV_OWNER.shopAddress,
      description: "",
      business_hours: defaultOwnerBusinessHours,
      regular_closed_days: defaultOwnerRegularClosedDays,
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      booking_available_start_time: "10:00",
      booking_available_end_time: "17:00",
      approval_mode: "auto",
      notification_settings: defaultShopNotificationSettings,
      customer_page_settings: buildDefaultCustomerPageSettings({
        shopName: DEV_OWNER.shopName,
        description: "",
      }),
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      return NextResponse.json({ message: mapDevSetupError(shopInsert.error.message) }, { status: 400 });
    }
  } else {
    const shopUpdate = await supabase
      .from("shops")
      .update({
        owner_user_id: authUser.id,
        name: DEV_OWNER.shopName,
        phone: DEV_OWNER.phoneNumber,
        address: DEV_OWNER.shopAddress,
        customer_page_settings: buildDefaultCustomerPageSettings({
          shopName: DEV_OWNER.shopName,
          description: "",
        }),
        updated_at: now,
      })
      .eq("id", shopId);

    if (shopUpdate.error) {
      return NextResponse.json({ message: mapDevSetupError(shopUpdate.error.message) }, { status: 400 });
    }
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

  const subscriptionUpsert = await supabase.from("owner_subscriptions").upsert(
    {
      user_id: authUser.id,
      shop_id: shopId,
      current_plan_code: "free",
      billing_cycle: "0m",
      trial_started_at: now,
      trial_ends_at: trialEndsAt,
      next_billing_at: null,
      payment_method_exists: false,
      payment_method_label: null,
      subscription_status: "trialing",
      cancel_at_period_end: false,
      last_payment_status: "none",
      last_payment_failed_at: null,
      last_payment_at: null,
      last_payment_id: null,
      billing_issue_id: null,
      portone_customer_id: `dev-owner-${authUser.id}`,
      featured_plan_code: "free",
      auto_renew_plan_code: "free",
      current_period_started_at: null,
      current_period_ends_at: null,
      last_schedule_id: null,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (subscriptionUpsert.error) {
    return NextResponse.json({ message: mapDevSetupError(subscriptionUpsert.error.message) }, { status: 400 });
  }

  try {
    await upsertOwnerShopMembership(supabase, {
      ownerUserId: authUser.id,
      shopId,
      isPrimary: true,
      now,
    });
    await resetShopAlimtalkIncludedCredits({
      shopId,
      includedAmount: getOwnerPlanIncludedAlimtalkCredits("free"),
      periodStartedAt: now,
      periodEndsAt: null,
      reason: "dev_owner_default_setup",
      metadata: {
        source: "dev_create_owner",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "매장 소유권 정보를 저장하지 못했습니다.";
    return NextResponse.json({ message: mapDevSetupError(message) }, { status: 400 });
  }

  await seedDemoDataForShop(shopId, DEV_OWNER.shopName, DEV_OWNER.shopAddress);

  return NextResponse.json({
    success: true,
    loginId: DEV_OWNER.loginId,
    password: createdNewAuthUser ? DEV_OWNER.password : null,
    shopId,
    message: createdNewAuthUser
      ? "개발용 테스트 오너 계정을 만들었습니다. 바로 로그인해 보세요."
      : "기존 개발용 테스트 오너 계정을 확인했습니다. 비밀번호와 구독 상태를 테스트 기준으로 복구했습니다.",
  });
}
