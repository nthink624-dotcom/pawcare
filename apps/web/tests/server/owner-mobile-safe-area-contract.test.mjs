import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner mobile keeps iPhone notch and home-indicator space in the web and native shells", async () => {
  const [layout, globals, ownerApp, bridge] = await Promise.all([
    source("src/app/layout.tsx"),
    source("src/app/globals.css"),
    source("src/components/owner/owner-app.tsx"),
    readFile(new URL("../../../owner-mobile/ios/App/App/OwnerBridgeViewController.swift", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" \/>/);
  assert.match(globals, /--pm-native-safe-top: 0px;/);
  assert.match(globals, /--pm-safe-top: max\(env\(safe-area-inset-top, 0px\), var\(--pm-native-safe-top\)\)/);
  assert.match(globals, /\.pm-mobile-owner \{[\s\S]*padding-top: var\(--pm-safe-top\);[\s\S]*padding-bottom: var\(--pm-safe-bottom\);/);
  assert.match(ownerApp, /pm-mobile-owner mx-auto flex w-full max-w-\[430px\]/);
  assert.match(ownerApp, /<header className="sticky top-0/);
  assert.match(ownerApp, /fixed bottom-0 left-1\/2 z-20 w-full max-w-\[430px\]/);
  assert.match(bridge, /contentInsetAdjustmentBehavior = \.never/);
  assert.match(bridge, /pm-ios-safe-area-style/);
  assert.match(bridge, /--pm-safe-top/);
  assert.ok(bridge.includes("padding-top: \\(top)px !important"));
  assert.ok(bridge.includes("padding-bottom: calc(\\(bottom)px + 2px) !important"));
});
