import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = process.cwd();

test("same-shop background refresh never reinitializes owner navigation", async () => {
  const sourcePath = path.join(root, "src/lib/owner-web-navigation-state.ts");
  const tempPath = path.join(root, ".tmp", `owner-web-navigation-state-${process.pid}.ts`);
  await fs.mkdir(path.dirname(tempPath), { recursive: true });
  await fs.copyFile(sourcePath, tempPath);
  try {
    const { shouldInitializeOwnerWebNavigation } = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
    assert.equal(shouldInitializeOwnerWebNavigation(null, "shop-a"), true);
    assert.equal(shouldInitializeOwnerWebNavigation("shop-a", "shop-a"), false);
    assert.equal(shouldInitializeOwnerWebNavigation("shop-a", "shop-b"), true);
  } finally {
    await fs.rm(tempPath, { force: true });
  }

  const preview = await fs.readFile(path.join(root, "src/components/owner-web/owner-web-preview.tsx"), "utf8");
  assert.match(preview, /navigationInitializedShopIdRef/);
  assert.match(preview, /shouldInitializeOwnerWebNavigation\(navigationInitializedShopIdRef\.current, ownerData\.shop\.id\)/);
});

test("route error escape actions stay in owner, demo, admin, or neutral public context", async () => {
  const sourcePath = path.join(root, "src/lib/app-error-context.ts");
  const tempPath = path.join(root, ".tmp", `app-error-context-${process.pid}.ts`);
  await fs.mkdir(path.dirname(tempPath), { recursive: true });
  await fs.copyFile(sourcePath, tempPath);
  try {
    const { getAppErrorEscapeContext } = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
    assert.deepEqual(getAppErrorEscapeContext("/owner/settings"), { href: "/owner", label: "오너 홈" });
    assert.deepEqual(getAppErrorEscapeContext("/demo/owner-web"), { href: "/demo/owner-web", label: "오너 홈" });
    assert.deepEqual(getAppErrorEscapeContext("/admin/owners"), { href: "/admin", label: "관리자 메인" });
    assert.deepEqual(getAppErrorEscapeContext("/book/shop-a"), { href: "/", label: "처음으로" });
  } finally {
    await fs.rm(tempPath, { force: true });
  }

  const boundary = await fs.readFile(path.join(root, "src/app/error.tsx"), "utf8");
  assert.match(boundary, /onClick=\{reset\}/);
  assert.match(boundary, /입력한 내용은 그대로 두고 화면만 다시 불러옵니다/);
  assert.match(boundary, /console\.error\("\[petmanager-ui\]/);
});
