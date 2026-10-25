import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const overview = await readFile(new URL("../src/components/owner/owner-settings-overview.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const notifications = await readFile(new URL("../src/components/owner/owner-app-notification-settings.tsx", import.meta.url), "utf8");

test("settings overview uses the approved three-group information architecture", () => {
  const orderedLabels = [
    "매장 운영", "매장 기본 정보", "영업·예약 시간", "서비스·요금 설정", "직원 관리",
    "알림·고객 응대", "고객 알림톡", "내 앱 알림", "문의·도움",
    "계정·정책", "계정", "약관 및 정책",
  ];
  let cursor = -1;
  for (const label of orderedLabels) {
    const next = settings.indexOf(label, cursor + 1);
    assert.ok(next > cursor, `${label} must appear in approved order`);
    cursor = next;
  }
  assert.doesNotMatch(settings, /매장명·연락처·고객 안내|영업시간·휴무일·예약 간격|사진 분석 또는 직접 입력|예약·미용 상태를 고객에게 안내|새 예약을 이 휴대폰에서 받기|문의 접수와 답변 확인|비밀번호·로그아웃·계정 삭제|이용약관과 개인정보처리방침/);
  assert.doesNotMatch(overview, /item\.subtitle|subtitle: string/);
});

test("overview is presentational and preserves compact accessible geometry", () => {
  assert.doesNotMatch(overview, /useEffect|fetch\(|requestPermissions|syncOwnerPushNotifications/);
  assert.match(overview, /min-h-\[76px\]/);
  assert.match(overview, /min-h-\[56px\]/);
  assert.match(overview, /text-\[16px\].*font-medium.*leading-6/);
  assert.doesNotMatch(overview, /item\.status|max-w-\[88px\]/);
  assert.match(overview, /focus-visible:ring-2/);
  assert.match(overview, /safe-area-inset-bottom/);
  assert.match(overview, /testerEmphasis/);
  assert.match(settings, /onOpenFeedback/);
  assert.match(settings, /feedbackTriggerRef/);
});

test("business-hours and app-notification copy follow the compact readable settings policy", () => {
  assert.match(settings, /text-\[20px\].*leading-7[^\n]*>전체 시간 설정/);
  assert.match(settings, /text-\[16px\].*leading-6[^\n]*>\{businessHoursSummary\}/);
  assert.match(settings, /text-\[14px\].*leading-5[^\n]*>시작 시간/);
  assert.match(settings, /text-\[14px\].*leading-5[^\n]*>마감 시간/);
  assert.match(settings, /min-h-11[\s\S]{0,240}text-\[16px\][\s\S]{0,80}>\s*일괄 적용/);
  assert.doesNotMatch(notifications, /BellRing|새 예약 접수 알림을 이 휴대폰에서 받아요|고객이 예약을 접수하면 바로 알려드려요/);
  assert.match(notifications, /알림 권한은 켜져 있지만 기기 연결에 실패했어요/);
});

test("alimtalk settings remove balance marketing and keep sender truth in the existing help", () => {
  assert.doesNotMatch(settings, /data\.alimtalkCreditSummary|남은 알림톡|알림톡 잔여 정보를 불러오지 못했어요|알림톡 추가 구매는 PC 웹에서만 가능해요/);
  assert.doesNotMatch(settings, /included_remaining|purchased_remaining|remaining_total/);
  assert.match(settings, /label="알림톡 발송"/);
  assert.match(settings, /<InfoTip ariaLabel="알림톡 설정 안내"[^>]*>[\s\S]*알림톡은 \{PETMANAGER_SERVICE_NAME\} 공통 발신 프로필로 발송됩니다\. 메시지 본문에는 매장명이 표시됩니다\.[\s\S]*<\/InfoTip>/);
  assert.equal((settings.match(/공통 발신 프로필로 발송됩니다/g) ?? []).length, 1);
  assert.match(settings, /label="알림톡 전체 사용"/);
  assert.match(settings, /savingNotificationSettings \? "자동 저장 중\.\.\." : notificationSettingsFeedback\.message/);
});

test("all seven business-hour weekdays reuse the time-value weight token", () => {
  assert.match(settings, /const businessHoursRowValueWeightClass = "font-medium";/);
  assert.match(settings, /businessHoursWeekOrder = \[1, 2, 3, 4, 5, 6, 0\]/);
  assert.equal(settings.match(/\$\{businessHoursRowValueWeightClass\}/g)?.length, 2);
  assert.match(settings, /\{weekdayLabels\[day\]\}요일/);
  assert.match(settings, /\{formatBusinessHoursRange\(hours\)\}/);
  assert.doesNotMatch(settings, /weekdayLabels\[day\][\s\S]{0,160}font-semibold/);
});

test("root statuses use source state without permission, token, or network side effects", () => {
  assert.match(notifications, /getOwnerPushPreferences\(\)/);
  assert.match(notifications, /getOwnerPushRuntimeState\(\)/);
  assert.match(notifications, /"앱을 설치한 휴대폰에서 설정할 수 있어요\."[\s\S]*"앱 알림이 꺼져 있어요\."[\s\S]*"앱 알림 권한이 차단되어 있어요\."[\s\S]*"알림 권한은 켜져 있지만 기기 연결에 실패했어요\."[\s\S]*"알림 연결 중이에요\."/);
  assert.doesNotMatch(overview, /localStorage|fetchApiJsonWithAuth|PushNotifications/);
  assert.match(notifications, /showPermissionPrimer/);
  assert.match(notifications, /휴대폰 알림 권한을 요청할게요/);
  assert.match(notifications, /휴대폰 알림 설정 열기/);
  assert.doesNotMatch(settings, /status: businessHoursSummary|status: `\$\{data\.staffMembers\.length\}명`|status: notificationSettings\.enabled|status: appNotificationStatus|status: isTesterFeedback/);
});

test("existing price and account policy boundaries stay connected", () => {
  assert.match(settings, /setIsPriceGuideOpen\(true\)/);
  assert.match(settings, /<MobileAiPriceGuideFixture/);
  assert.match(settings, /<OwnerAccountDeletionPanel onDeleted=\{onLogout\}/);
});
