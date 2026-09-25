import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");

test("notification setting failures use compact recovery copy instead of raw route or auth errors", () => {
  assert.match(settings, /function getNotificationSettingsSaveFailureMessage\(error: unknown\)/);
  assert.match(settings, /error\.status === 401 \|\| error\.status === 403/);
  assert.match(settings, /error\.status === 404 \|\| error\.status === 405/);
  assert.match(settings, /error\.status === 409/);
  assert.match(settings, /error\.status === 400 \|\| error\.status === 422/);
  assert.match(settings, /error instanceof TypeError/);
  assert.match(settings, /errorFallbackMessage: "알림톡 설정을 저장하지 못했어요\."/);
  assert.doesNotMatch(settings, /message: error instanceof Error \? error\.message : "알림톡 설정을 저장하지 못했습니다\."/);
});

test("failed latest notification save rolls the switch back to bootstrap truth without clobbering a newer request", () => {
  assert.match(settings, /const notificationSaveSequenceRef = useRef\(0\)/);
  assert.match(settings, /const saveSequence = notificationSaveSequenceRef\.current \+ 1/);
  assert.match(settings, /notificationSaveSequenceRef\.current === saveSequence/);
  assert.match(settings, /setNotificationSettings\(mapShopNotificationSettingsState\(data\.shop\.notification_settings\)\)/);
  assert.match(settings, /setIsNotificationSettingsDirty\(false\)/);
});

test("the owner mutation boundary suppresses raw transport text only for the notification save fallback", () => {
  assert.match(ownerApp, /async function handleRequestError\(error: unknown, fallbackMessage: string, forceFallback = false\)/);
  assert.match(ownerApp, /!forceFallback && rawMessage && !isLikelyCorruptedMessage\(rawMessage\)/);
  assert.match(ownerApp, /options\?\.errorFallbackMessage \?\? "저장에 실패했습니다\."/);
  assert.match(ownerApp, /errorFallbackMessage: options\?\.errorFallbackMessage/);
});
