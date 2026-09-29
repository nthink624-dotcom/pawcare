import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("admin notification failure screen is linked, authenticated, and redacts message data", async () => {
  const page = await read("src/app/admin/notifications/page.tsx");
  const screen = await read("src/components/admin/admin-notification-failure-screen.tsx");
  const nav = await read("src/components/admin/admin-section-nav.tsx");
  const home = await read("src/components/admin/admin-home.tsx");

  assert.match(page, /getServerAdminSession/);
  assert.match(page, /redirect\("\/admin\/login\?next=%2Fadmin%2Fnotifications"/);
  assert.match(nav, /\/admin\/notifications/);
  assert.match(home, /\/admin\/notifications/);
  assert.match(screen, /\/api\/admin\/notifications\/failures/);
  assert.match(screen, /method: "POST"/);
  assert.match(screen, /개인정보와 메시지 원문은 표시하지 않습니다/);
  assert.doesNotMatch(screen, /recipient_phone|message:/);
});
