import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const payload = await readFile(new URL("../src/lib/owner-push-payload.ts", import.meta.url), "utf8");
const delivery = await readFile(new URL("../src/server/owner-push-delivery.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../src/lib/push/owner-push-notifications.ts", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/components/owner/owner-app-notification-settings.tsx", import.meta.url), "utf8");
const nativeSettings = await readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerNotificationSettingsPlugin.java", import.meta.url), "utf8");
const mainActivity = await readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url), "utf8");
const price = await readFile(new URL("../src/components/auth/mobile-ai-price-guide-fixture.tsx", import.meta.url), "utf8");
const overview = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");

test("visible owner push copy is generic and lock-screen private", () => {
  assert.match(payload, /title: "펫매니저 새 예약"/);
  assert.match(payload, /body: "새 예약이 접수되었습니다\. 앱에서 확인해 주세요\."/);
  assert.doesNotMatch(payload, /body: `[^`]*(petName|guardianName|appointmentDateLabel|appointmentTime|serviceName)/);
  assert.match(delivery, /visibility: "private"/);
});

test("app and selected Android channel blocks have truthful separate recovery routes", () => {
  assert.match(runtime, /visibility: 0/);
  assert.doesNotMatch(runtime, /visibility: -1/);
  assert.match(runtime, /channels\.filter\(\(channel\) => !existing\.has\(channel\.id\)\)/);
  assert.match(runtime, /listChannels\(\)/);
  assert.match(runtime, /Number\(selected\.importance\) === 0/);
  assert.match(settings, /runtime\.channelBlocked/);
  assert.match(settings, /새 예약 알림 차단됨/);
  assert.match(settings, /기기 연결 실패/);
  assert.match(nativeSettings, /Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
  assert.match(nativeSettings, /Settings\.ACTION_CHANNEL_NOTIFICATION_SETTINGS/);
  assert.match(nativeSettings, /manager\.areNotificationsEnabled\(\)/);
  assert.match(nativeSettings, /Build\.VERSION_CODES\.N/);
  assert.match(nativeSettings, /ALLOWED_CHANNEL_IDS\.contains/);
  assert.match(nativeSettings, /resolveActivity/);
  assert.match(mainActivity, /registerPlugin\(OwnerNotificationSettingsPlugin\.class\)/);
});

test("runtime state keeps preference, app, channel, connecting, failure, and receiving truthful", () => {
  assert.match(runtime, /appNotificationsEnabled\?: boolean/);
  assert.match(runtime, /registrationFailed\?: boolean/);
  assert.match(runtime, /readOwnerAppNotificationsEnabled\(\)/);
  assert.match(settings, /!preferences\.enabled/);
  assert.match(settings, /runtime\.appNotificationsEnabled === false/);
  assert.match(settings, /runtime\.registrationFailed/);
  assert.match(settings, /연결 중/);
  assert.match(settings, /기기 연결 실패/);
  assert.match(settings, /연결 중/);
});

test("photo analysis requires a distinct just-in-time OpenAI disclosure and affirmative action", () => {
  assert.match(price, /type Mode = "choose" \| "consent"/);
  assert.match(price, /비식별 파생 이미지를 OpenAI로 전송해 서비스명·가격 초안을 생성합니다/);
  assert.match(price, /원본 사진에 고객 이름, 전화번호 등 개인정보가 보이지 않는지 다시 확인해 주세요/);
  assert.match(price, /동의하고 분석/);
  assert.match(price, /requestAnalysisConsent\(file\)/);
  assert.match(price, /onClick=\{confirmAnalysisConsent\}/);
  assert.match(price, /setMode\("manual"\)/);
  assert.ok(price.indexOf("confirmAnalysisConsent") < price.lastIndexOf("onClick={confirmAnalysisConsent}"));
});

test("back and notification switch wrappers meet 44px without overview summaries", () => {
  assert.match(ownerApp, /min-h-11[\s\S]{0,300}aria-label="설정으로 돌아가기"/);
  assert.match(settings, /htmlFor="owner-app-push-enabled" className="flex min-h-11/);
  assert.match(settings, /htmlFor="owner-booking-push-enabled" className="flex min-h-11/);
  assert.doesNotMatch(overview, /status:/);
});
