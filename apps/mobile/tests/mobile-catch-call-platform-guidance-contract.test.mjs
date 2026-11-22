import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(projectRoot, "src/components/owner/owner-catch-call-panel.tsx"), "utf8");

test("CatchCall guidance distinguishes iPhone limitations from Android app setup", () => {
  assert.match(source, /Capacitor\.getPlatform\(\)/);
  // Wording follows the restored CatchCall notification flow (e3463181).
  assert.match(source, /iPhone에서는 일반 전화 위에 캐치콜 알림을 띄울 수 없습니다\./);
  assert.match(source, /Android 앱에서 캐치콜 알림을 설정할 수 있습니다\./);
  assert.match(source, /if \(capacitorPlatform === "android"\) return "android";/);
  assert.match(source, /if \(capacitorPlatform === "ios"\) return "ios";/);
  // iPhone gets the limitation notice; every other device gets the Android setup guidance.
  assert.match(source, /devicePlatform === "ios" \? \([\s\S]*?일반 전화 위에 캐치콜 알림을 띄울 수 없습니다[\s\S]*?\) : \([\s\S]*?Android 앱에서 캐치콜 알림을 설정할 수 있습니다/);
});
