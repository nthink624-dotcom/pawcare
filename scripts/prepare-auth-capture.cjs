const fs = require("fs");
const path = require("path");
const { randomBytes, scryptSync } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function readEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const entries = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    entries[key] = value;
  }
  return entries;
}

function hashAdminPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildOwnerAuthEmail(loginId) {
  return `${loginId.trim().toLowerCase()}@owner.pawcare.local`;
}

async function main() {
  const env = readEnvFile(path.join(process.cwd(), ".env.local"));
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role environment is not configured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ownerLoginId = "captureowner";
  const ownerPassword = "CaptureOwner!2026";
  const ownerEmail = buildOwnerAuthEmail(ownerLoginId);
  const ownerName = "캡처용 오너";
  const ownerPhone = "01077778888";
  const shopId = "shop-capture01";
  const shopName = "캡처 테스트샵";
  const shopAddress = "서울시 강남구 테스트로 12";
  const adminLoginId = "capture-admin";
  const adminPassword = "CaptureAdmin!2026";

  const usersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) {
    throw usersResult.error;
  }

  let ownerUser = usersResult.data.users.find((user) => user.email === ownerEmail) || null;

  if (!ownerUser) {
    const createOwnerResult = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        login_id: ownerLoginId,
        name: ownerName,
        subscription_status: "active",
        current_plan_code: "monthly",
        featured_plan_code: "yearly",
      },
    });

    if (createOwnerResult.error || !createOwnerResult.data.user) {
      throw createOwnerResult.error || new Error("Failed to create capture owner.");
    }
    ownerUser = createOwnerResult.data.user;
  } else {
    const updateOwnerResult = await supabase.auth.admin.updateUserById(ownerUser.id, {
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        ...(ownerUser.user_metadata || {}),
        login_id: ownerLoginId,
        name: ownerName,
        subscription_status: "active",
        current_plan_code: "monthly",
        featured_plan_code: "yearly",
      },
    });

    if (updateOwnerResult.error || !updateOwnerResult.data.user) {
      throw updateOwnerResult.error || new Error("Failed to update capture owner.");
    }
    ownerUser = updateOwnerResult.data.user;
  }

  const currentTime = nowIso();
  const serviceEndAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const trialEndAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const shopPayload = {
    id: shopId,
    owner_user_id: ownerUser.id,
    name: shopName,
    phone: ownerPhone,
    address: shopAddress,
    description: "캡처용 테스트 매장",
    business_hours: {
      mon: [{ start: "10:00", end: "19:00" }],
      tue: [{ start: "10:00", end: "19:00" }],
      wed: [{ start: "10:00", end: "19:00" }],
      thu: [{ start: "10:00", end: "19:00" }],
      fri: [{ start: "10:00", end: "19:00" }],
    },
    regular_closed_days: [],
    temporary_closed_dates: [],
    concurrent_capacity: 1,
    approval_mode: "manual",
    created_at: currentTime,
    updated_at: currentTime,
  };

  const shopUpsert = await supabase.from("shops").upsert(shopPayload, { onConflict: "id" });
  if (shopUpsert.error) {
    throw shopUpsert.error;
  }

  const profileUpsert = await supabase.from("owner_profiles").upsert(
    {
      user_id: ownerUser.id,
      shop_id: shopId,
      login_id: ownerLoginId,
      name: ownerName,
      birth_date: "19900101",
      phone_number: ownerPhone,
      identity_verified_at: currentTime,
      agreements: {
        agreed_at: currentTime,
        terms_version: "capture",
        agreements: {
          service: true,
          privacy: true,
          location: false,
          marketing: false,
        },
      },
      created_at: currentTime,
      updated_at: currentTime,
    },
    { onConflict: "user_id" },
  );
  if (profileUpsert.error) {
    throw profileUpsert.error;
  }

  const subscriptionUpsert = await supabase.from("owner_subscriptions").upsert(
    {
      user_id: ownerUser.id,
      shop_id: shopId,
      current_plan_code: "monthly",
      billing_cycle: "1m",
      trial_started_at: currentTime,
      trial_ends_at: trialEndAt,
      next_billing_at: null,
      payment_method_exists: false,
      payment_method_label: null,
      subscription_status: "active",
      cancel_at_period_end: false,
      last_payment_status: "paid",
      last_payment_failed_at: null,
      last_payment_at: currentTime,
      last_payment_id: "capture-payment",
      billing_key: null,
      billing_issue_id: null,
      portone_customer_id: `capture-owner-${ownerUser.id}`,
      featured_plan_code: "yearly",
      auto_renew_plan_code: "monthly",
      current_period_started_at: currentTime,
      current_period_ends_at: serviceEndAt,
      last_schedule_id: null,
      created_at: currentTime,
      updated_at: currentTime,
    },
    { onConflict: "user_id" },
  );
  if (subscriptionUpsert.error) {
    throw subscriptionUpsert.error;
  }

  const adminSelect = await supabase
    .from("admin_accounts")
    .select("id")
    .eq("login_id", adminLoginId)
    .maybeSingle();

  if (adminSelect.error) {
    throw adminSelect.error;
  }

  const adminPayload = {
    full_name: "캡처용 관리자",
    email: "capture-admin@petmanager.local",
    phone_number: "01099990000",
    login_id: adminLoginId,
    password_hash: hashAdminPassword(adminPassword),
    is_super_admin: false,
    is_active: true,
    updated_at: currentTime,
  };

  let adminResult;
  if (adminSelect.data?.id) {
    adminResult = await supabase.from("admin_accounts").update(adminPayload).eq("id", adminSelect.data.id);
  } else {
    adminResult = await supabase.from("admin_accounts").insert({
      ...adminPayload,
      created_at: currentTime,
    });
  }
  if (adminResult.error) {
    throw adminResult.error;
  }

  const outputPath = path.join(process.cwd(), "artifacts", "screenshots", "auth-accounts.json");
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(
    outputPath,
    JSON.stringify(
      {
        owner: { loginId: ownerLoginId, password: ownerPassword, email: ownerEmail },
        admin: { loginId: adminLoginId, password: adminPassword },
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
