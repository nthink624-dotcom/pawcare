import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

test("mobile owner layout declares iPhone viewport and safe-area contracts", async () => {
  const [layout, globals, ownerApp] = await Promise.all([
    source("src/app/layout.tsx"),
    source("src/app/globals.css"),
    source("src/components/owner/owner-app.tsx"),
  ]);

  assert.match(layout, /viewportFit:\s*["']cover["']/);
  assert.match(globals, /--pm-native-safe-top:\s*0px/);
  assert.match(globals, /--pm-safe-top:\s*max\(env\(safe-area-inset-top\), var\(--pm-native-safe-top\)\)/);
  assert.match(globals, /--pm-safe-bottom:\s*max\(env\(safe-area-inset-bottom\), var\(--pm-native-safe-bottom\)\)/);
  assert.match(ownerApp, /pt-\[calc\(var\(--pm-safe-top\)\+12px\)\]/);
  assert.match(ownerApp, /pb-\[calc\(var\(--pm-safe-bottom\)\+2px\)\]/);
  assert.match(ownerApp, /pb-\[calc\(var\(--pm-safe-bottom\)\+128px\)\]/);
});
