import { randomUUID } from "node:crypto";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { getOwnerPlanIncludedAlimtalkCredits } from "@/lib/billing/owner-plans";
import { buildDefaultCustomerPageSettings } from "@/lib/customer-page-settings";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import {
  buildDefaultOwnerServices,
  buildDefaultOwnerStaffMembers,
  defaultOwnerBusinessHours,
  defaultOwnerRegularClosedDays,
} from "@/lib/owner-default-setup";
import { getSupabaseServerRuntimeStage, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { resetShopAlimtalkIncludedCredits } from "@/server/alimtalk-credit-service";

export const DEVELOPMENT_TEST_OWNER_PROJECT_REF = "qefxdtmdtvnzgupmjlom";

const TEST_OWNER_DEFAULTS = {
  name: "테스트 오너",
  birthDate: "19900101",
  phoneNumber: "01000000000",
  shopName: "테스트 미용실",
  shopAddress: "서울특별시 테스트구 테스트로 1",
} as const;

const REQUIRED_PASSWORD_LENGTH = 20;
const AUTH_USERS_PAGE_SIZE = 200;
const MAX_AUTH_USER_PAGES = 100;

export type DevelopmentTestOwnerPart =
  | "auth_account"
  | "auth_credentials"
  | "email_confirmation"
  | "shop"
  | "owner_profile"
  | "subscription"
  | "owner_membership"
  | "owner_staff"
  | "default_services"
  | "notification_credits";

export type DevelopmentTestOwnerStatus = {
  ready: boolean;
  missing: DevelopmentTestOwnerPart[];
};

export type DevelopmentTestOwnerEnsureResult = DevelopmentTestOwnerStatus & {
  changed: DevelopmentTestOwnerPart[];
  shopId: string;
  session: Session;
};

type RuntimeStage = ReturnType<typeof getSupabaseServerRuntimeStage>;

type DevelopmentTestOwnerTarget = {
  hostname: string;
  runtimeStage: RuntimeStage;
  supabaseUrl: string | undefined;
  allowedDevSupabaseRefs: string;
};

type DevelopmentTestOwnerConfig = {
  email: string;
  password: string;
};

type OwnerProfileRow = {
  user_id: string;
  shop_id: string;
  login_id: string;
};

type ShopRow = {
  id: string;
  owner_user_id: string | null;
};

type TestOwnerSnapshot = {
  user: User | null;
  profile: OwnerProfileRow | null;
  shop: ShopRow | null;
  subscriptionExists: boolean;
  membershipExists: boolean;
  ownerStaffExists: boolean;
  existingServiceNames: Set<string>;
  notificationCreditsExist: boolean;
};

export class DevelopmentTestOwnerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 503,
  ) {
    super(message);
    this.name = "DevelopmentTestOwnerError";
  }
}

function fail(code: string, message: string, status = 503): never {
  throw new DevelopmentTestOwnerError(code, message, status);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getSupabaseProjectRef(value: string | undefined) {
  return value?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i)?.[1] ?? "";
}

function parseAllowedRefs(value: string) {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function isLocalHostname(value: string) {
  const hostname = value.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function assertDevelopmentTestOwnerTarget(target: DevelopmentTestOwnerTarget) {
  if (target.runtimeStage === "production") {
    fail("runtime_not_allowed", "운영 환경에서는 테스트 오너 기능을 사용할 수 없습니다.", 404);
  }

  if (target.runtimeStage === "development" && !isLocalHostname(target.hostname)) {
    fail("host_not_allowed", "PC 로컬 서버에서만 테스트 오너를 준비할 수 있습니다.", 403);
  }

  const projectRef = getSupabaseProjectRef(target.supabaseUrl);
  const allowedRefs = parseAllowedRefs(target.allowedDevSupabaseRefs);
  if (projectRef !== DEVELOPMENT_TEST_OWNER_PROJECT_REF || !allowedRefs.has(DEVELOPMENT_TEST_OWNER_PROJECT_REF)) {
    fail("project_not_allowed", "검수용 연습 DB 연결을 확인해 주세요.", 403);
  }
}

export function validateDevelopmentTestOwnerPassword(password: string) {
  return (
    password.length >= REQUIRED_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function readDevelopmentTestOwnerConfig(): DevelopmentTestOwnerConfig {
  const email = normalizeEmail(process.env.DEV_TEST_OWNER_EMAIL ?? "");
  const password = process.env.DEV_TEST_OWNER_PASSWORD ?? "";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    fail("email_not_configured", "검수용 테스트 오너 이메일 설정을 확인해 주세요.");
  }
  if (!validateDevelopmentTestOwnerPassword(password)) {
    fail("password_not_configured", "검수용 테스트 오너 비밀번호 설정을 확인해 주세요.");
  }

  return { email, password };
}

function requireAdminClient() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    fail("admin_client_unavailable", "검수용 연습 DB 연결을 확인해 주세요.");
  }
  return admin;
}

function requireAuthClient() {
  const auth = getSupabaseAuthClient();
  if (!auth) {
    fail("auth_client_unavailable", "검수용 로그인 연결을 확인해 주세요.");
  }
  return auth;
}

function assertQuery(error: { code?: string; message?: string } | null, code: string) {
  if (error) {
    fail(code, "검수용 테스트 오너 상태를 확인하지 못했습니다.");
  }
}

async function findAuthUserByEmail(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
) {
  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: AUTH_USERS_PAGE_SIZE });
    if (result.error) {
      fail("auth_list_failed", "검수용 테스트 오너 계정을 확인하지 못했습니다.");
    }

    const matched = result.data.users.find((user) => normalizeEmail(user.email ?? "") === email);
    if (matched) return matched;
    if (result.data.users.length < AUTH_USERS_PAGE_SIZE) return null;
  }

  fail("auth_list_limit", "검수용 테스트 오너 계정 검색 범위를 확인해 주세요.");
}

async function readProfileByLoginId(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
) {
  const result = await admin
    .from("owner_profiles")
    .select("user_id,shop_id,login_id")
    .eq("login_id", email)
    .maybeSingle<OwnerProfileRow>();
  assertQuery(result.error, "profile_lookup_failed");
  return result.data ?? null;
}

async function resolveAuthUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
  profile: OwnerProfileRow | null,
) {
  if (!profile?.user_id) return findAuthUserByEmail(admin, email);

  const result = await admin.auth.admin.getUserById(profile.user_id);
  if (result.error) {
    fail("profile_auth_link_failed", "검수용 테스트 오너의 계정 연결을 확인해 주세요.");
  }

  const user = result.data.user ?? null;
  if (user && normalizeEmail(user.email ?? "") !== email) {
    fail("profile_auth_email_mismatch", "검수용 테스트 오너의 계정 연결을 확인해 주세요.", 409);
  }
  return user;
}

async function readShop(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  profile: OwnerProfileRow | null,
) {
  const query = admin.from("shops").select("id,owner_user_id");
  const result = profile?.shop_id
    ? await query.eq("id", profile.shop_id).maybeSingle<ShopRow>()
    : await query.eq("owner_user_id", userId).maybeSingle<ShopRow>();
  assertQuery(result.error, "shop_lookup_failed");
  return result.data ?? null;
}

async function readSnapshot(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  config: DevelopmentTestOwnerConfig,
): Promise<TestOwnerSnapshot> {
  const profile = await readProfileByLoginId(admin, config.email);
  const user = await resolveAuthUser(admin, config.email, profile);
  if (!user) {
    return {
      user: null,
      profile: null,
      shop: null,
      subscriptionExists: false,
      membershipExists: false,
      ownerStaffExists: false,
      existingServiceNames: new Set(),
      notificationCreditsExist: false,
    };
  }

  const shop = await readShop(admin, user.id, profile);
  if (!shop) {
    return {
      user,
      profile,
      shop: null,
      subscriptionExists: false,
      membershipExists: false,
      ownerStaffExists: false,
      existingServiceNames: new Set(),
      notificationCreditsExist: false,
    };
  }

  const [subscription, membership, staff, services, credits] = await Promise.all([
    admin.from("owner_subscriptions").select("user_id").eq("user_id", user.id).maybeSingle(),
    admin
      .from("owner_shop_memberships")
      .select("owner_user_id")
      .eq("owner_user_id", user.id)
      .eq("shop_id", shop.id)
      .maybeSingle(),
    admin.from("staff_members").select("id").eq("id", `${shop.id}-staff-owner`).maybeSingle(),
    admin.from("services").select("name").eq("shop_id", shop.id),
    admin.from("shop_alimtalk_credit_balances").select("shop_id").eq("shop_id", shop.id).maybeSingle(),
  ]);

  assertQuery(subscription.error, "subscription_lookup_failed");
  assertQuery(membership.error, "membership_lookup_failed");
  assertQuery(staff.error, "staff_lookup_failed");
  assertQuery(services.error, "services_lookup_failed");
  assertQuery(credits.error, "credits_lookup_failed");

  return {
    user,
    profile,
    shop,
    subscriptionExists: Boolean(subscription.data),
    membershipExists: Boolean(membership.data),
    ownerStaffExists: Boolean(staff.data),
    existingServiceNames: new Set(
      (services.data ?? [])
        .map((row) => (typeof row.name === "string" ? row.name.trim() : ""))
        .filter(Boolean),
    ),
    notificationCreditsExist: Boolean(credits.data),
  };
}

export function getDevelopmentTestOwnerMissingParts(snapshot: TestOwnerSnapshot) {
  const missing: DevelopmentTestOwnerPart[] = [];
  if (!snapshot.user) missing.push("auth_account");
  if (snapshot.user && !snapshot.user.email_confirmed_at) missing.push("email_confirmation");
  if (!snapshot.shop) missing.push("shop");
  if (!snapshot.profile) missing.push("owner_profile");
  if (!snapshot.subscriptionExists) missing.push("subscription");
  if (!snapshot.membershipExists) missing.push("owner_membership");
  if (!snapshot.ownerStaffExists) missing.push("owner_staff");

  const expectedServiceNames = buildDefaultOwnerServices(snapshot.shop?.id ?? "pending-shop", nowIso()).map(
    (service) => service.name,
  );
  if (expectedServiceNames.some((name) => !snapshot.existingServiceNames.has(name))) {
    missing.push("default_services");
  }
  if (!snapshot.notificationCreditsExist) missing.push("notification_credits");
  return missing;
}

export function isRecoverableDevelopmentTestOwnerSignInError(error: { code?: string; message?: string } | null) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";
  return (
    code === "invalid_credentials" ||
    code === "email_not_confirmed" ||
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed")
  );
}

export function assertDevelopmentTestOwnerRequest(hostname: string) {
  assertDevelopmentTestOwnerTarget({
    hostname,
    runtimeStage: getSupabaseServerRuntimeStage(),
    supabaseUrl: serverEnv.supabaseUrl,
    allowedDevSupabaseRefs: serverEnv.allowedDevSupabaseRefs,
  });
}

export async function getDevelopmentTestOwnerStatus(): Promise<DevelopmentTestOwnerStatus> {
  const config = readDevelopmentTestOwnerConfig();
  const snapshot = await readSnapshot(requireAdminClient(), config);
  const missing = getDevelopmentTestOwnerMissingParts(snapshot);
  return { ready: missing.length === 0, missing };
}

async function insertMissingShop(
  admin: SupabaseClient,
  userId: string,
  now: string,
) {
  const shopId = `dev-shop-${randomUUID().slice(0, 12)}`;
  const result = await admin.from("shops").insert({
    id: shopId,
    owner_user_id: userId,
    name: TEST_OWNER_DEFAULTS.shopName,
    phone: TEST_OWNER_DEFAULTS.phoneNumber,
    address: TEST_OWNER_DEFAULTS.shopAddress,
    description: "",
    business_hours: defaultOwnerBusinessHours,
    regular_closed_days: defaultOwnerRegularClosedDays,
    temporary_closed_dates: [],
    concurrent_capacity: 1,
    booking_slot_interval_minutes: 15,
    booking_slot_offset_minutes: 0,
    booking_available_start_time: "10:00",
    booking_available_end_time: "17:00",
    approval_mode: "auto",
    notification_settings: defaultShopNotificationSettings,
    customer_page_settings: buildDefaultCustomerPageSettings({
      shopName: TEST_OWNER_DEFAULTS.shopName,
      description: "",
    }),
    created_at: now,
    updated_at: now,
  });
  assertQuery(result.error, "shop_insert_failed");
  return { id: shopId, owner_user_id: userId } satisfies ShopRow;
}

async function ensureCredentialSession(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  auth: NonNullable<ReturnType<typeof getSupabaseAuthClient>>,
  user: User,
  config: DevelopmentTestOwnerConfig,
  changed: DevelopmentTestOwnerPart[],
) {
  let signIn = await auth.auth.signInWithPassword(config);
  if (signIn.error && isRecoverableDevelopmentTestOwnerSignInError(signIn.error)) {
    const update = await admin.auth.admin.updateUserById(user.id, {
      password: config.password,
      ...(!user.email_confirmed_at ? { email_confirm: true } : {}),
    });
    if (update.error) {
      fail("credential_recovery_failed", "검수용 테스트 오너 로그인을 복구하지 못했습니다.");
    }
    changed.push("auth_credentials");
    if (!user.email_confirmed_at) changed.push("email_confirmation");
    signIn = await auth.auth.signInWithPassword(config);
  }

  if (signIn.error || !signIn.data.session) {
    fail("test_owner_sign_in_failed", "검수용 테스트 오너로 로그인하지 못했습니다.");
  }
  return signIn.data.session;
}

export async function ensureDevelopmentTestOwner(): Promise<DevelopmentTestOwnerEnsureResult> {
  const config = readDevelopmentTestOwnerConfig();
  const admin = requireAdminClient();
  const auth = requireAuthClient();
  const changed: DevelopmentTestOwnerPart[] = [];
  const now = nowIso();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let snapshot = await readSnapshot(admin, config);
  let user = snapshot.user;
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
      user_metadata: {
        login_id: config.email,
        name: TEST_OWNER_DEFAULTS.name,
      },
    });
    if (created.error || !created.data.user) {
      fail("auth_create_failed", "검수용 테스트 오너 계정을 만들지 못했습니다.");
    }
    user = created.data.user;
    changed.push("auth_account");
  }

  let shop = snapshot.shop;
  if (!shop) {
    shop = await insertMissingShop(admin, user.id, now);
    changed.push("shop");
  }

  if (!snapshot.profile) {
    const profileInsert = await admin.from("owner_profiles").insert({
      user_id: user.id,
      shop_id: shop.id,
      login_id: config.email,
      name: TEST_OWNER_DEFAULTS.name,
      birth_date: TEST_OWNER_DEFAULTS.birthDate,
      phone_number: TEST_OWNER_DEFAULTS.phoneNumber,
      identity_verified_at: now,
      agreements: {
        agreed_at: now,
        agreements: { service: true, privacy: true, location: false, marketing: false },
        terms_version: "dev-test-owner",
      },
      created_at: now,
      updated_at: now,
    });
    assertQuery(profileInsert.error, "profile_insert_failed");
    changed.push("owner_profile");
  }

  if (!snapshot.subscriptionExists) {
    const subscriptionInsert = await admin.from("owner_subscriptions").insert({
      user_id: user.id,
      shop_id: shop.id,
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
      portone_customer_id: `dev-owner-${user.id}`,
      featured_plan_code: "free",
      auto_renew_plan_code: "free",
      current_period_started_at: null,
      current_period_ends_at: null,
      last_schedule_id: null,
      created_at: now,
      updated_at: now,
    });
    assertQuery(subscriptionInsert.error, "subscription_insert_failed");
    changed.push("subscription");
  }

  if (!snapshot.membershipExists) {
    const membershipInsert = await admin.from("owner_shop_memberships").insert({
      owner_user_id: user.id,
      shop_id: shop.id,
      role: "owner",
      is_primary: true,
      created_at: now,
      updated_at: now,
    });
    assertQuery(membershipInsert.error, "membership_insert_failed");
    changed.push("owner_membership");
  }

  if (!snapshot.ownerStaffExists) {
    const staffInsert = await admin.from("staff_members").insert(
      buildDefaultOwnerStaffMembers({
        shopId: shop.id,
        ownerName: TEST_OWNER_DEFAULTS.name,
        ownerPhone: TEST_OWNER_DEFAULTS.phoneNumber,
        now,
      }),
    );
    assertQuery(staffInsert.error, "staff_insert_failed");
    changed.push("owner_staff");
  }

  const missingServices = buildDefaultOwnerServices(shop.id, now).filter(
    (service) => !snapshot.existingServiceNames.has(service.name),
  );
  if (missingServices.length > 0) {
    const servicesInsert = await admin.from("services").insert(missingServices);
    assertQuery(servicesInsert.error, "services_insert_failed");
    changed.push("default_services");
  }

  if (!snapshot.notificationCreditsExist) {
    await resetShopAlimtalkIncludedCredits({
      shopId: shop.id,
      includedAmount: getOwnerPlanIncludedAlimtalkCredits("free"),
      periodStartedAt: now,
      periodEndsAt: trialEndsAt,
      reason: "dev_test_owner_initial_setup",
      metadata: { source: "dev_test_owner" },
    });
    changed.push("notification_credits");
  }

  const session = await ensureCredentialSession(admin, auth, user, config, changed);
  snapshot = await readSnapshot(admin, config);
  const missing = getDevelopmentTestOwnerMissingParts(snapshot);
  if (missing.length > 0) {
    fail("ensure_incomplete", "검수용 테스트 오너의 필수 연결을 모두 확인하지 못했습니다.");
  }

  return {
    ready: true,
    missing,
    changed: [...new Set(changed)],
    shopId: shop.id,
    session,
  };
}
