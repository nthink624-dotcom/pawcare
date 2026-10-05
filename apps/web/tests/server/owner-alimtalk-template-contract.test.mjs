import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("owner template requests are shop scoped, owner authenticated, and reviewed through the server relay", async () => {
  const [route, migration, resolver, dispatch] = await Promise.all([
    read("../../src/app/api/owner/alimtalk-templates/route.ts"),
    read("../../../../supabase/migrations/20261003095820_shop_alimtalk_template_requests.sql"),
    read("../../src/server/alimtalk-approved-template.ts"),
    read("../../src/server/notification-dispatch.ts"),
  ]);

  assert.match(route, /requireOwnerShop\(request, payload\.shopId\)/);
  assert.match(route, /assertOwnerOrManager\(owner\)/);
  assert.match(route, /\.eq\("shop_id", owner\.shopId\)/);
  assert.match(route, /requestReview: true/);
  assert.match(route, /inspection_status: "unknown"/);
  assert.match(migration, /grant all on table public\.shop_alimtalk_template_requests to service_role/i);
  assert.match(migration, /shop_id text not null references public\.shops\(id\)/i);
  assert.match(migration, /one_active_review_idx[\s\S]*?where inspection_status in \('submitting', 'requested', 'reviewing', 'unknown'\)/i);
  assert.match(resolver, /getShopApprovedTemplateCodes\(shopId, \[type\]\)/);
  assert.match(dispatch, /input\.shopId,\s*\);/);
});

test("owner template form exposes draft, review, status, and compact preview actions", async () => {
  const [editor, settings] = await Promise.all([
    read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx"),
    read("../../src/components/owner-web/settings-alerts-panel.tsx"),
  ]);

  assert.match(editor, /임시 저장/);
  assert.match(editor, /"검수 요청"/);
  assert.match(editor, /검수가 완료되면 이 매장의/);
  assert.match(editor, /aria-label="카카오 미리보기"/);
  assert.match(settings, /<OwnerAlimtalkTemplateEditor/);
});
