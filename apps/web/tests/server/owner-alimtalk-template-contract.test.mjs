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
  assert.match(route, /getApprovedSsodaaTemplateDetails\(aliases, owner\.shopId\)/);
  assert.match(dispatch, /getApprovedSsodaaNotificationTemplate\(\s*input\.type,\s*notificationTemplateValues,\s*templateAlias,\s*input\.shopId,\s*\)/);
});

test("owner template form exposes draft, review, status, and compact preview actions", async () => {
  const [editor, settings] = await Promise.all([
    read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx"),
    read("../../src/components/owner-web/settings-alerts-panel.tsx"),
  ]);

  assert.match(editor, /내 문안 등록하기/);
  assert.match(editor, /"검수 요청"/);
  assert.match(editor, /내 문안을 등록한 뒤 검수 요청/);
  assert.match(editor, /aria-label="카카오톡 알림톡 수신 화면"/);
  assert.match(settings, /<OwnerAlimtalkTemplateEditor/);
});

test("owner template editor distinguishes relay category failure from an empty provider category list", async () => {
  const [route, editor] = await Promise.all([
    read("../../src/app/api/owner/alimtalk-templates/route.ts"),
    read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx"),
  ]);
  assert.match(route, /알림톡 분류 서버에 연결하지 못했습니다/);
  assert.match(route, /쏘다에서 사용할 수 있는 알림 분류가 없습니다/);
  assert.match(route, /categories, categoriesError/);
  assert.match(editor, /categoriesError\)warnings\.push\(templatesResult\.value\.categoriesError\)/);
});

test("owner copy editor hides metadata while retaining review payload and policy guidance", async () => {
  const editor = await read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx");
  assert.doesNotMatch(editor, />템플릿 이름<|>카테고리</);
  assert.match(editor, /templateName:templateName\.trim\(\)/);
  assert.match(editor, /currentTemplate\?\.category_code\|\|categories\[0\]\?\.code/);
  assert.match(editor, /templateContent,categoryCode,action/);
  assert.match(editor, /value=\{button\.linkMobile\} readOnly/);
  assert.match(editor, /승인되면 현재 사용 문안에서 선택할 수 있습니다/);
  assert.match(editor, /placeholder="원하는 문안을 적어주세요\./);
  assert.match(editor, /<details><summary/);
  assert.doesNotMatch(editor, /이 알림에 사용할 매장 전용 문구/);
  assert.match(editor, /getNotificationDraftBodyByAlias\(selectedAlias\)/);
  assert.match(editor, /editedContentKey\.current!==draftKey/);
  assert.match(editor, /<optgroup label="승인된 문안">[\s\S]*?<option value="" disabled>[\s\S]*?승인 문안을 선택해 주세요\./);
  assert.doesNotMatch(editor, /펫매니저 기본 · 미적용/);
});

test("owner template editor uses compact variable chips and an explicitly labeled example appointment time", async () => {
  const [editor, settings, previewApi, sampleHelper] = await Promise.all([
    read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx"),
    read("../../src/components/owner-web/settings-alerts-panel.tsx"),
    read("../../src/app/api/owner/alimtalk-template-previews/route.ts"),
    read("../../src/lib/alimtalk-preview-sample.ts"),
  ]);

  assert.match(editor, /templateVariables\.map/);
  assert.match(editor, /insertTemplateVariable\(token\)/);
  assert.match(editor, /data-template-content-meta/);
  assert.match(editor, /getAlimtalkPreviewAppointmentTime\(\)/);
  assert.match(previewApi, /usesExampleValues: !appointment/);
  assert.match(settings, /OwnerAlimtalkTemplateEditor/);
  assert.match(sampleHelper, /Asia\/Seoul/);
  assert.match(sampleHelper, /오후 2:30/);
});

test("owner template actions remain in content-sized mobile rows and new drafts are not labeled live", async () => {
  const [editor,route]=await Promise.all([
    read("../../src/components/owner-web/owner-alimtalk-template-editor.tsx"),
    read("../../src/app/api/owner/alimtalk-templates/route.ts"),
  ]);
  assert.match(editor,/auto-rows-max[^"]*xl:auto-rows-auto/);
  assert.match(editor,/view!=="current"[\s\S]*?"작성 중인 문안"/);
  assert.match(editor,/문안을 고르는 것만으로는 바뀌지 않습니다/);
  assert.match(editor,/const displayedCurrent = selection && !selection\.blocked \? activeTemplate : null/);
  assert.match(editor,/view==="approved"&&candidate[\s\S]*?선택한 문안 미리보기/);
  assert.match(editor,/option\.source==="petmanager"\?"기본 문안":option\.name/);
  assert.match(editor,/displayTemplate\?\.source==="petmanager"[\s\S]*?selectedButtonDefaults\.map\(button=>button\.buttonName\)/);
  assert.match(editor,/setApprovalPromptOpen\(true\)/);
  assert.match(editor,/role="dialog" aria-modal="true"[\s\S]*?요청하신 문안이 승인됐어요[\s\S]*?이 문안 사용하기/);
  assert.match(editor,/value=\{button\.buttonName\} readOnly/);
  assert.match(route,/function providerTemplateName\(templateCode: string\)[\s\S]*?return `PM_\$\{templateCode\}`/);
});
