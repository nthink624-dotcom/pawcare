import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/lib/account-deletion/owner-account-deletion-adapter.ts", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/components/owner/owner-account-deletion-panel.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const privacy = await readFile(new URL("../src/lib/legal/privacy-policy.ts", import.meta.url), "utf8");

test("owner settings links the verified account deletion flow separately from logout", () => {
  assert.match(settings, /appRole === "owner" \? <OwnerAccountDeletionPanel/);
  assert.match(settings, /AccountActionRow icon=\{LogOut\}/);
});

test("deletion requires explicit confirmation, current password, and one idempotency key", () => {
  assert.match(panel, /계정 삭제하기/);
  assert.match(panel, /current-password/);
  assert.match(panel, /idempotencyKeyRef\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(adapter, /\/api\/owner\/account-deletion/);
  assert.match(adapter, /confirmation: input\.confirmed/);
  assert.match(adapter, /currentPassword: input\.currentPassword/);
  assert.match(adapter, /idempotencyKey: input\.idempotencyKey/);
});

test("embedded privacy copy keeps canonical parity and conservative Data Safety boundaries", () => {
  assert.match(privacy, /시행일자: 2026년 9월 10일/);
  assert.match(privacy, /https:\/\/www\.petmanager\.co\.kr\/privacy/);
  assert.match(privacy, /Android 앱은 PC·서버에서 확정된 플랜/);
  assert.match(privacy, /FCM 등록 토큰/);
  assert.match(privacy, /OpenAI Responses에 한 번 전송/);
  assert.match(privacy, /DeepSeek에 서비스명, 실제 소요 시간/);
  assert.match(privacy, /hard purge/);
  assert.match(privacy, /근거 없이 공유 없음으로 표시하지 않습니다/);
  assert.match(privacy, /전송 암호화는 별도 운영 증거 확인 전 포괄적으로 보장하지 않습니다/);
  assert.match(privacy, /https:\/\/www\.petmanager\.co\.kr\/account-deletion/);
});
