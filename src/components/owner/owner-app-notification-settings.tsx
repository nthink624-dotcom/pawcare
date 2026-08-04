"use client";

import { BellRing, Smartphone, Vibrate, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  OWNER_PUSH_STATE_CHANGED_EVENT,
  getOwnerPushPreferences,
  getOwnerPushRuntimeState,
  syncOwnerPushNotifications,
  updateOwnerPushPreferences,
  type OwnerPushAlertMode,
  type OwnerPushPreferences,
  type OwnerPushRegistrationContext,
  type OwnerPushRuntimeState,
} from "@/lib/push/owner-push-notifications";

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
}: OwnerPushRegistrationContext) {
  const context = useMemo<OwnerPushRegistrationContext>(
    () => ({ shopId, staffMemberId, appRole }),
    [appRole, shopId, staffMemberId],
  );
  const [preferences, setPreferences] = useState<OwnerPushPreferences>(() => getOwnerPushPreferences());
  const [runtime, setRuntime] = useState<OwnerPushRuntimeState>(() => getOwnerPushRuntimeState());
  const [saving, setSaving] = useState(false);

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
        message: "알림 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    });

    return () => window.removeEventListener(OWNER_PUSH_STATE_CHANGED_EVENT, handleStateChange);
  }, [context]);

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

  return (
    <div className="divide-y divide-[var(--border)]">
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={1.9} />
          <div className="min-w-0">
            <p className="text-[16px] font-medium text-[var(--text)]">앱 알림 받기</p>
            <p className="mt-1 text-[14px] leading-5 text-[var(--muted)]">새 예약 접수 알림을 이 휴대폰에서 받아요.</p>
          </div>
        </div>
        <Switch
          checked={preferences.enabled}
          disabled={!runtime.supported || saving}
          aria-label="앱 알림 받기"
          onCheckedChange={(enabled) => void savePreferences({ ...preferences, enabled })}
        />
      </div>

      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[16px] font-medium text-[var(--text)]">새 예약 접수</p>
          <p className="mt-1 text-[14px] leading-5 text-[var(--muted)]">고객이 예약을 접수하면 바로 알려드려요.</p>
        </div>
        <Switch
          checked={preferences.bookingRequestedEnabled}
          disabled={!preferences.enabled || saving}
          aria-label="새 예약 접수 알림"
          onCheckedChange={(bookingRequestedEnabled) =>
            void savePreferences({ ...preferences, bookingRequestedEnabled })
          }
        />
      </div>

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
            {runtime.message}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
            휴대폰의 무음 모드·방해금지·알림 채널 설정이 앱 설정보다 우선할 수 있어요.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">변경사항은 자동으로 저장됩니다.</p>
        </div>
      </div>
    </div>
  );
}
