import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("benefit tabs span the full settings surface above the form and phone preview", () => {
  const panel = readFileSync(path.join(root, "src/components/owner-web/benefits-management-panel.tsx"), "utf8");
  const layout = readFileSync(path.join(root, "src/components/owner-web/customer-page-phone-preview.tsx"), "utf8");
  const settings = readFileSync(path.join(root, "src/components/owner-web/settings-management-screen.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

  assert.match(panel, /owner-settings-tabbar benefit-management-tabbar min-w-0 w-full/);
  const header = readFileSync(path.join(root, "src/components/owner-web/owner-settings-tab-header.ts"), "utf8");
  assert.match(header, /rounded-t-\[13px\] rounded-b-none/);
  assert.match(panel, /OWNER_SETTINGS_TAB_HEADER_CLASS, "!pt-3 !pb-0"/);
  assert.match(styles, /\.pm-owner-web \.benefit-management-tabbar\s*\{\s*border-radius: 14px 14px 0 0 !important;/);
  assert.match(layout, /topContent \? <div className="col-span-full min-w-0">\{topContent\}<\/div>/);
  assert.match(settings, /topContent=\{\([\s\S]*?<BenefitsManagementToolbar/);
});
