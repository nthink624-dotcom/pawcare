import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("admin audit log is authenticated, bounded, filterable, and payload-redacted", async () => {
  const route = await read("src/app/api/admin/audit-events/route.ts");
  const page = await read("src/app/admin/audit/page.tsx");
  const screen = await read("src/components/admin/admin-audit-log-screen.tsx");
  const nav = await read("src/components/admin/admin-section-nav.tsx");

  assert.match(route, /requireAdminSession/);
  assert.match(route, /owner_activity_events/);
  assert.match(route, /limit\(limit\)/);
  assert.match(route, /MAX_LIMIT = 100/);
  assert.match(route, /action_source/);
  assert.match(route, /entity_type/);
  assert.match(route, /created_at/);
  assert.match(route, /function safeEvent/);
  assert.doesNotMatch(route, /previous_payload|next_payload|user_agent/);
  assert.match(page, /getServerAdminSession/);
  assert.match(page, /\/admin\/login\?next=%2Fadmin%2Faudit/);
  assert.match(screen, /\/api\/admin\/audit-events/);
  assert.match(nav, /\/admin\/audit/);
});
