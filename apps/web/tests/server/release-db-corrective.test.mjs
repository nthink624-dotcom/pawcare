import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("release corrective keeps nullable legacy checks and validates only resulting writes", async () => {
  const sql = await source("ops/db-release-corrective.sql");
  assert.match(sql, /after insert or update on public\.owner_subscriptions/);
  assert.match(sql, /after insert or update on public\.owner_payment_ledger/);
  assert.match(sql, /new\.current_plan_code is not distinct from 'single_monthly_v1'/);
  assert.match(sql, /v_is_current_contract is not true/);
  assert.match(sql, /old\.current_plan_code is distinct from new\.current_plan_code/);
  assert.match(sql, /old\.plan_code is distinct from new\.plan_code/);
  assert.match(sql, /plan_code is distinct from 'single_monthly_v1'/);
  assert.match(sql, /NULL plan_code is the existing server contract/);
  assert.match(sql, /price_snapshot_amount is not distinct from 29000/);
  assert.doesNotMatch(sql, /PM_LEGACY_(?:SUBSCRIPTION|PAYMENT)_IS_READ_ONLY/);
  assert.match(sql, /old\.price_snapshot_amount is distinct from new\.price_snapshot_amount/);
});

test("release corrective leaves no direct legacy signup or consent RPC grant", async () => {
  const sql = await source("ops/db-release-corrective.sql");
  for (const name of [
    "complete_owner_signup_v1", "claim_owner_signup_v2", "mark_owner_signup_auth_created_v2",
    "complete_owner_signup_v2", "claim_owner_signup_v4", "complete_owner_signup_v4",
    "complete_owner_signup_v5",
    "record_owner_marketing_consent_v1",
  ]) assert.match(sql, new RegExp(`revoke all on function (?:public|pm_signup_private)\\.${name}\\(`));
  assert.match(sql, /grant execute on function public\.complete_owner_signup_v6\([\s\S]*?to service_role/);
  assert.match(sql, /grant execute on function pm_signup_private\.complete_owner_signup_v6\([\s\S]*?to service_role/);
  assert.match(sql, /grant execute on function public\.claim_owner_signup_v5\([\s\S]*?to service_role/);
  assert.match(sql, /grant execute on function public\.mark_owner_signup_auth_created_v5\([\s\S]*?to service_role/);
  assert.doesNotMatch(sql, /grant execute on function (?:public|pm_signup_private)\.record_owner_marketing_consent_v1/);
});
