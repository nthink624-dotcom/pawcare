import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

test("Tailwind scans only deterministic product source roots", () => {
  assert.match(globals, /@import "tailwindcss" source\(none\);/);
  assert.match(globals, /@source "\.\/";/);
  assert.match(globals, /@source "\.\.\/components";/);
  assert.match(globals, /@source "\.\.\/features";/);
  assert.match(globals, /@source "\.\.\/lib";/);
  assert.match(globals, /@source "\.\.\/server";/);
  assert.doesNotMatch(globals, /@source "\.\.";/);
  assert.doesNotMatch(globals, /@import "tailwindcss";$/m);
});
