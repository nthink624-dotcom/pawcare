import { createHmac } from "node:crypto";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const paymentId = process.argv[2];
const reason = process.argv[3] || "관리자 환불 처리";

if (!paymentId) {
  console.error("Usage: node scripts/admin-refund-payment.mjs <paymentId> [reason]");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET;

if (!supabaseUrl || !serviceRoleKey || !adminSessionSecret) {
  console.error("Missing required env: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SESSION_SECRET");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createAdminSessionToken(input) {
  const payload = {
    accountId: input.accountId,
    loginId: input.loginId,
    exp: Date.now() + 1000 * 60 * 10,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", adminSessionSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

async function main() {
  const { data: adminAccount, error: adminError } = await supabase
    .from("admin_accounts")
    .select("id, login_id, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (adminError || !adminAccount) {
    throw new Error(`Failed to load admin account: ${adminError?.message ?? "not found"}`);
  }

  let userId = null;
  let shopId = null;

  const { data: ledgerRow, error: ledgerError } = await supabase
    .from("owner_payment_ledger")
    .select("user_id, shop_id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!ledgerError && ledgerRow) {
    userId = ledgerRow.user_id;
    shopId = ledgerRow.shop_id;
  } else {
    const { data: eventRow, error: eventError } = await supabase
      .from("owner_billing_events")
      .select("user_id, shop_id")
      .eq("payment_id", paymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!eventError && eventRow) {
      userId = eventRow.user_id;
      shopId = eventRow.shop_id;
    }
  }

  if (!userId || !shopId) {
    throw new Error(`Could not resolve user/shop for paymentId: ${paymentId}`);
  }

  const token = createAdminSessionToken({
    accountId: adminAccount.id,
    loginId: adminAccount.login_id,
  });

  const response = await fetch("http://127.0.0.1:3000/api/admin/owners/refund", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `petmanager_admin_session=${token}`,
    },
    body: JSON.stringify({
      userId,
      shopId,
      paymentId,
      reason,
    }),
  });

  const text = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log(text);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
