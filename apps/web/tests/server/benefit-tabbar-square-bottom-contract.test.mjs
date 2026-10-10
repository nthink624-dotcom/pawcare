import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("benefit tab rail spans the full content column and meets the panel with a square bottom edge", () => {
  const panel = readFileSync(path.join(root, "src/components/owner-web/benefits-management-panel.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

  assert.match(panel, /flex min-w-0 flex-col items-stretch gap-2/);
  assert.match(panel, /owner-settings-tabbar benefit-management-tabbar w-full[^>]*role="tablist"/);
  assert.match(panel, /<div className="flex justify-end pb-2">\s*<button[\s\S]*?저장된 내용 불러오기/);
  assert.match(panel, /rounded-t-\[13px\] rounded-b-none[^"]*pt-3 pb-0/);
  assert.match(styles, /\.pm-owner-web \.benefit-management-tabbar\s*\{\s*border-radius: 14px 14px 0 0 !important;/);
});
