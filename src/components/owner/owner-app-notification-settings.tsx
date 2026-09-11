"use client";

import { Smartphone, Vibrate, Volume2, VolumeX } from "lucide-react";
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
    ? "앱을 설치한 휴대폰에서 설정할 수 있어요."
    : !preferences.enabled
      ? "앱 알림이 꺼져 있어요."
      : appBlocked
    ? "앱 알림 권한이 차단되어 있어요."
    : runtime.channelBlocked
      ? "새 예약 알림 채널이 차단되어 있어요."
    : runtime.registrationFailed
      ? "알림 권한은 켜져 있지만 기기 연결에 실패했어요."
      : runtime.registered
        ? "앱 알림을 받고 있어요. 채널별 차단은 휴대폰 알림 설정에서 확인할 수 있어요."
        : "알림 연결 중이에요.";

  return (
    <div className="divide-y divide-[var(--border)]">
      <label htmlFor="owner-app-push-enabled" className="flex min-h-11 items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-6 text-[var(--text)]">앱 알림 받기</p>
        </div>
        <Switch
          id="owner-app-push-enabled"
          checked={preferences.enabled}
          disabled={!runtime.supported || saving}
          aria-label="앱 알림 받기"
          onCheckedChange={handlePrimaryToggle}
        />
      </label>

      {showPermissionPrimer && !preferences.enabled ? (
        <div className="space-y-3 bg-[#f8fafc] px-4 py-4">
          <div>
            <p className="text-[16px] font-medium leading-6 text-[var(--text)]">휴대폰 알림 권한을 요청할게요</p>
            <p className="mt-1 text-[14px] font-normal leading-5 text-[var(--muted)]">허용하면 새 예약 알림을 이 휴대폰으로 받을 수 있어요.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShowPermissionPrimer(false)} className="min-h-11 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[14px] font-medium text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[#2563eb]">취소</button>
            <button type="button" onClick={() => { setShowPermissionPrimer(false); void savePreferences({ ...preferences, enabled: true }); }} className="min-h-11 rounded-[10px] bg-[#2563eb] px-3 text-[14px] font-medium text-white focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">알림 켜기</button>
          </div>
        </div>
      ) : null}

      <label htmlFor="owner-booking-push-enabled" className="flex min-h-11 items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-6 text-[var(--text)]">새 예약 알림</p>
        </div>
        <Switch
          id="owner-booking-push-enabled"
          checked={preferences.bookingRequestedEnabled}
          disabled={!preferences.enabled || saving}
          aria-label="새 예약 접수 알림"
          onCheckedChange={(bookingRequestedEnabled) =>
            void savePreferences({ ...preferences, bookingRequestedEnabled })
          }
        />
      </label>

      <div className="px-4 py-4">
        <p className="text-[16px] font-medium text-[var(--text)]">알림 방식</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="알림 방식">
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
                className={`flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-[8px] border px-2 text-[14px] font-medium transition disabled:opacity-45 ${
                  selected
                    ? "border-[var(--accent)] bg-[#f1f7f4] text-[var(--accent)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.9} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[var(--muted)]" strokeWidth={1.8} />
        <div className="min-w-0">
          <p className={`text-[14px] leading-5 ${runtime.registered ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
            {runtimeIssue}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
            휴대폰의 무음 모드·방해금지·알림 채널 설정이 앱 설정보다 우선할 수 있어요.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">변경사항은 자동으로 저장됩니다.</p>
          {runtime.supported && preferences.enabled && (runtime.channelBlocked || appBlocked) ? (
            <button
              type="button"
              onClick={() => void openDeviceNotificationSettings()}
              className="mt-3 min-h-11 rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#334155] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              휴대폰 알림 설정 열기
            </button>
          ) : null}
          {runtime.supported && preferences.enabled && runtime.registrationFailed && !runtime.channelBlocked && !appBlocked ? (
            <button
              type="button"
              onClick={() => void syncOwnerPushNotifications(context, { userInitiated: true })}
              className="mt-3 min-h-11 rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#334155] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              기기 다시 연결
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
