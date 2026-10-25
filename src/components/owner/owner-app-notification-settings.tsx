"use client";

import { ChevronRight, Smartphone, Vibrate, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  OWNER_PUSH_STATE_CHANGED_EVENT,
  getOwnerPushPreferences,
  getOwnerPushRuntimeState,
  getOwnerPushAndroidChannelId,
  syncOwnerPushNotifications,
  updateOwnerPushPreferences,
  type OwnerPushAlertMode,
  type OwnerPushPreferences,
  type OwnerPushRegistrationContext,
  type OwnerPushRuntimeState,
} from "@/lib/push/owner-push-notifications";
import { openOwnerAppNotificationSettings, openOwnerChannelNotificationSettings } from "@/lib/push/owner-notification-settings";

const alertModeOptions: Array<{
  value: OwnerPushAlertMode;
  label: string;
  icon: typeof Volume2;
}> = [
  { value: "sound", label: "소리", icon: Volume2 },
  { value: "vibrate", label: "진동", icon: Vibrate },
  { value: "silent", label: "무음", icon: VolumeX },
];

export default function OwnerAppNotificationSettings({
  shopId,
  staffMemberId,
  appRole,
  onBack,
}: OwnerPushRegistrationContext & { onBack: () => void }) {
  const context = useMemo<OwnerPushRegistrationContext>(
    () => ({ shopId, staffMemberId, appRole }),
    [appRole, shopId, staffMemberId],
  );
  const [preferences, setPreferences] = useState<OwnerPushPreferences>(() => getOwnerPushPreferences());
  const [runtime, setRuntime] = useState<OwnerPushRuntimeState>(() => getOwnerPushRuntimeState());
  const [saving, setSaving] = useState(false);
  const [showPermissionPrimer, setShowPermissionPrimer] = useState(false);

  useEffect(() => {
    const handleStateChange = (event: Event) => {
      setRuntime((event as CustomEvent<OwnerPushRuntimeState>).detail);
    };

    window.addEventListener(OWNER_PUSH_STATE_CHANGED_EVENT, handleStateChange);
    void syncOwnerPushNotifications(context).catch(() => {
      setRuntime({
        supported: true,
        permission: "prompt",
        registered: false,
        registrationFailed: true,
        message: "알림 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    });

    return () => window.removeEventListener(OWNER_PUSH_STATE_CHANGED_EVENT, handleStateChange);
  }, [context]);

  useEffect(() => {
    const handleOwnerMobileBackRequest = (event: Event) => {
      event.preventDefault();
      onBack();
    };

    window.addEventListener("owner-mobile-back-request", handleOwnerMobileBackRequest);
    return () => window.removeEventListener("owner-mobile-back-request", handleOwnerMobileBackRequest);
  }, [onBack]);

  const savePreferences = async (next: OwnerPushPreferences) => {
    setPreferences(next);
    setSaving(true);
    try {
      await updateOwnerPushPreferences(next, context);
    } catch {
      setRuntime((current) => ({
        ...current,
        registered: false,
        message: "앱 알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      }));
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryToggle = (enabled: boolean) => {
    if (enabled) {
      setShowPermissionPrimer(true);
      return;
    }
    setShowPermissionPrimer(false);
    void savePreferences({ ...preferences, enabled: false });
  };

  const openDeviceNotificationSettings = async () => {
    if (runtime.appNotificationsEnabled !== false && runtime.channelBlocked) {
      await openOwnerChannelNotificationSettings(getOwnerPushAndroidChannelId(preferences.alertMode));
      return;
    }
    await openOwnerAppNotificationSettings();
  };
  const appBlocked = runtime.appNotificationsEnabled === false || runtime.permission === "denied";
  const runtimeIssue = !runtime.supported
    ? "앱에서 설정"
    : !preferences.enabled
      ? "알림 꺼짐"
      : appBlocked
    ? "권한 차단됨"
    : runtime.channelBlocked
      ? "새 예약 알림 차단됨"
    : runtime.registrationFailed
      ? "기기 연결 실패"
      : runtime.registered
        ? "기기 연결됨"
        : "연결 중";

  return (
    <div className="bg-white px-4 text-[var(--text)]">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-3">
        <span className="flex items-center gap-2 text-[14px] font-medium leading-5">
          <Smartphone aria-hidden="true" className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.8} />
          이 휴대폰
        </span>
        <span role="status" className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-medium leading-4 text-[#475569]">
          {saving ? "저장 중" : runtimeIssue}
        </span>
      </div>
      <label htmlFor="owner-app-push-enabled" className="flex min-h-11 items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-6 text-[var(--text)]">앱 알림 받기</p>
        </div>
        <Switch
          id="owner-app-push-enabled"
          checked={preferences.enabled}
          disabled={!runtime.supported || saving}
          aria-label="앱 알림 받기"
          className="before:absolute before:-inset-y-3 before:inset-x-0"
          onCheckedChange={handlePrimaryToggle}
        />
      </label>

      {showPermissionPrimer && !preferences.enabled ? (
        <div className="mb-3 space-y-3 rounded-[10px] bg-[#f8fafc] p-3">
          <div>
            <p className="text-[14px] font-medium leading-5 text-[var(--text)]">휴대폰 알림 권한</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShowPermissionPrimer(false)} className="min-h-11 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[14px] font-medium text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[#2563eb]">취소</button>
            <button type="button" onClick={() => { setShowPermissionPrimer(false); void savePreferences({ ...preferences, enabled: true }); }} className="min-h-11 rounded-[10px] bg-[#111a30] px-3 text-[14px] font-medium text-white focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">알림 켜기</button>
          </div>
        </div>
      ) : null}

      <label htmlFor="owner-booking-push-enabled" className="flex min-h-11 items-center justify-between gap-4 border-t border-[var(--border)] py-4">
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-6 text-[var(--text)]">새 예약 알림</p>
        </div>
        <Switch
          id="owner-booking-push-enabled"
          checked={preferences.bookingRequestedEnabled}
          disabled={!preferences.enabled || saving}
          aria-label="새 예약 접수 알림"
          className="before:absolute before:-inset-y-3 before:inset-x-0"
          onCheckedChange={(bookingRequestedEnabled) =>
            void savePreferences({ ...preferences, bookingRequestedEnabled })
          }
        />
      </label>

      <div className="border-t border-[var(--border)] py-4">
        <p className="text-[16px] font-medium leading-6 text-[var(--text)]">알림 방식</p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-[14px] bg-[#f1f5f9] p-1" role="radiogroup" aria-label="알림 방식">
          {alertModeOptions.map((option) => {
            const Icon = option.icon;
            const selected = preferences.alertMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!preferences.enabled || saving}
                onClick={() => void savePreferences({ ...preferences, alertMode: option.value })}
                className={`flex min-h-11 flex-wrap items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-[14px] font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-45 ${
                  selected
                    ? "bg-[#111a30] text-white"
                    : "text-[#475569]"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {runtime.supported && preferences.enabled && (runtime.channelBlocked || appBlocked) ? (
        <button
          type="button"
          onClick={() => void openDeviceNotificationSettings()}
          className="flex min-h-14 w-full items-center justify-between gap-3 border-t border-[var(--border)] py-3 text-left text-[14px] font-medium text-[#334155] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]"
        >
          휴대폰 알림 설정
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </button>
      ) : null}
      {runtime.supported && preferences.enabled && runtime.registrationFailed && !runtime.channelBlocked && !appBlocked ? (
        <button
          type="button"
          onClick={() => void syncOwnerPushNotifications(context, { userInitiated: true })}
          className="flex min-h-14 w-full items-center justify-between gap-3 border-t border-[var(--border)] py-3 text-left text-[14px] font-medium text-[#334155] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]"
        >
          기기 다시 연결
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
