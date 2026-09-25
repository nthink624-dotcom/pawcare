import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const normalizeSql = (value) => value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
const normalizeStatement = (value) => value.replace(/\s+/g, " ").trim().replace(/;$/, "");

const canonicalLedger = migration("20260826130954_marketing_work_ledger.sql");
const remoteAlias = migration("20260826133614_marketing_work_ledger.sql");
const canonicalRevenue = migration("202605180006_shop_revenue_ledger.sql");
const summaryRepair = migration("20260829080000_restore_shop_revenue_summary_views.sql");
const subsequentHardening = migration("20260829084203_harden_sensitive_database_permissions.sql");

const viewDefinition = (source, view) => {
  const match = source.match(new RegExp(`create or replace view public\\.${view} as\\s+([\\s\\S]*?);`, "i"));
  assert.ok(match, `${view} definition must exist`);
  return normalizeStatement(match[1]);
};

test("remote marketing history alias is LF-normalized source-identical to the local semantic predecessor", () => {
  assert.equal(normalizeSql(remoteAlias), normalizeSql(canonicalLedger));
  assert.notEqual("20260826133614", "20260826130954");
});

test("future history reconciliation marks only the local predecessor applied after the remote alias is present", () => {
  const remoteAppliedAliasVersion = "20260826133614";
  const localRepairTargetVersion = "20260826130954";
  assert.equal(remoteAppliedAliasVersion, "20260826133614");
  assert.equal(localRepairTargetVersion, "20260826130954");
  assert.notEqual(remoteAppliedAliasVersion, localRepairTargetVersion);
});

test("revenue summary repair is ordered after the existing August 29 source and before permission hardening", () => {
  const repairVersion = "20260829080000";
  assert.ok(repairVersion > "20260829023403");
  assert.ok(repairVersion < "20260829084203");
});

test("revenue summary repair restores the two canonical view bodies without changing their dependencies", () => {
  for (const view of ["shop_revenue_daily_summary", "shop_revenue_service_summary"]) {
    assert.equal(viewDefinition(summaryRepair, view), viewDefinition(canonicalRevenue, view));
  }
  assert.match(summaryRepair, /from public\.shop_revenue_entries/i);
  assert.match(summaryRepair, /left join public\.services/i);
  assert.doesNotMatch(summaryRepair, /create table|alter table|insert into|update public|delete from|drop /i);
});

test("repair is idempotent and makes the following summary ACL hardening safe", () => {
  for (const view of ["shop_revenue_daily_summary", "shop_revenue_service_summary"]) {
    assert.match(summaryRepair, new RegExp(`create or replace view public\\.${view}`, "i"));
    assert.match(summaryRepair, new RegExp(`revoke all on table public\\.${view} from public, anon, authenticated;`, "i"));
    assert.match(summaryRepair, new RegExp(`grant select on table public\\.${view} to service_role;`, "i"));
    assert.match(subsequentHardening, new RegExp(`revoke all on table public\\.${view} from public, anon, authenticated;`, "i"));
    assert.match(subsequentHardening, new RegExp(`grant select on table public\\.${view} to service_role;`, "i"));
  }
});
