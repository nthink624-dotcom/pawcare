import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

test("production owner mobile route renders the canonical app without loopback redirects", async () => {
  const [nextConfig, ownerMobilePage, ownerApp] = await Promise.all([
    source("next.config.ts"),
    source("src/app/owner/mobile/page.tsx"),
    source("src/components/owner/owner-app.tsx"),
  ]);

  assert.doesNotMatch(
    nextConfig,
    /source:\s*["']\/owner\/mobile["']/,
    "next.config.ts must not redirect the canonical /owner/mobile route",
  );
  assert.doesNotMatch(
    ownerMobilePage,
    /https?:\/\/(?:localhost|127\.0\.0\.1)(?::3100)?\/owner\/mobile/i,
    "the production page must not contain a loopback owner-mobile destination",
  );
  assert.doesNotMatch(
    ownerMobilePage,
    /(?:window\.)?location\.(?:assign|replace)\s*\(/,
    "the canonical page must render in place instead of navigating to another origin",
  );
  assert.doesNotMatch(ownerMobilePage, /\bredirect\s*\(/, "the canonical page must not self-redirect");

  assert.match(ownerMobilePage, /import OwnerShell from ["']@\/components\/owner\/owner-shell["']/);
  assert.match(ownerMobilePage, /return\s*\(\s*<OwnerShell\b/);
  assert.match(ownerApp, /<HomeScheduleTabs/);
  assert.match(ownerApp, /<OwnerHomeDateNavigator/);
  assert.match(ownerApp, /<TodayConfirmedContent/);
  assert.doesNotMatch(ownerApp, /MobileStatusSummary/);

  if (/function shouldUseLocalMobilePreview\(\)/.test(ownerMobilePage)) {
    assert.match(
      ownerMobilePage,
      /process\.env\.NODE_ENV === ["']production["']/,
      "any local mobile preview must be disabled explicitly in production",
    );
  }
});
