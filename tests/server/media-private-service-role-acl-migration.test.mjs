import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const migrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260904183118_grant_service_role_private_media_integrity.sql",
);
const originalIntegrityMigrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260903003614_booking_payment_tenant_integrity.sql",
);

function normalizeSql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

test("media tenant guards grant only the required private access to service_role", async () => {
  const sql = normalizeSql(await readFile(migrationPath, "utf8"));
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  assert.deepEqual(statements, [
    "grant usage on schema private to service_role",
    "grant execute on function private.assert_linked_row_shop(text, uuid, uuid, uuid) to service_role",
    "grant execute on function private.assert_media_asset_tenant_integrity() to service_role",
  ]);

  assert.doesNotMatch(sql, /\bto\s+(public|anon|authenticated)\b/);
  assert.doesNotMatch(sql, /\bsecurity\s+(definer|invoker)\b/);
  assert.doesNotMatch(
    sql,
    /\b(alter\s+table|create\s+(?:or\s+replace\s+)?function|create\s+trigger|drop\s+trigger|create\s+policy|drop\s+policy|revoke)\b/,
  );
});

test("original migration keeps both guards revoked from client roles", async () => {
  const sql = normalizeSql(
    await readFile(originalIntegrityMigrationPath, "utf8"),
  );

  for (const signature of [
    "private.assert_linked_row_shop(text, uuid, uuid, uuid)",
    "private.assert_media_asset_tenant_integrity()",
  ]) {
    assert.ok(
      sql.includes(
        `revoke all on function ${signature} from public, anon, authenticated`,
      ),
      `${signature} must remain revoked from client roles`,
    );
  }
});
