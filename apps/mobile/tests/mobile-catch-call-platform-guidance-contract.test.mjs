import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(projectRoot, "src/components/owner/owner-catch-call-panel.tsx"), "utf8");

test("CatchCall guidance distinguishes iPhone limitations from Android app setup", () => {
  assert.match(source, /Capacitor\.getPlatform\(\)/);
  assert.match(source, /iPhone에서는 일반 전화 화면에 펫매니저 버튼을 띄울 수 없어요\./);
  assert.match(source, /통화 후 펫매니저에서 예약을 등록하거나/);
  assert.match(source, /자동 통화 확인은 PetManager Android 앱에서 설정할 수 있습니다\./);
  assert.match(source, /devicePlatform === "ios"/);
  assert.match(source, /devicePlatform === "android"/);
});
