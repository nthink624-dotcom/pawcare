"use client";

import { Bell, Camera, Mic } from "lucide-react";
import { useEffect, useState } from "react";

import {
  canManageOwnerAndroidPermissions,
  openOwnerAppPermissionSettings,
  readOwnerAppPermissionStates,
  requestOwnerAppPermission,
  type OwnerAppPermission,
  type OwnerAppPermissionState,
  type OwnerAppPermissionStates,
} from "@/lib/permissions/owner-app-permissions";

const rows = [
  { key: "camera", title: "카메라", description: "미용 전후 사진을 촬영할 때 사용합니다.", icon: Camera },
  { key: "microphone", title: "마이크", description: "케어리포트를 음성으로 입력할 때 사용합니다.", icon: Mic },
  { key: "notifications", title: "알림", description: "새 예약과 필요한 업무 알림을 받을 때 사용합니다.", icon: Bell },
] as const;

const labels: Record<OwnerAppPermissionState, string> = {
  granted: "허용됨",
  prompt: "허용 전",
  denied: "거부됨",
  permanently_denied: "휴대폰 설정 필요",
  unsupported: "확인할 수 없음",
};

const initialStates: OwnerAppPermissionStates = { camera: "unsupported", microphone: "unsupported", notifications: "unsupported" };

export default function OwnerAppPermissionsSettings() {
  const [states, setStates] = useState(initialStates);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<OwnerAppPermission | null>(null);
  const [error, setError] = useState("");
  const supported = canManageOwnerAndroidPermissions();

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setStates(await readOwnerAppPermissionStates());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "권한 상태를 확인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const handleVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, []);

  async function handleAction(permission: OwnerAppPermission) {
    setPending(permission);
    setError("");
    try {
      if (states[permission] === "permanently_denied") {
        await openOwnerAppPermissionSettings();
        return;
      }
      const state = await requestOwnerAppPermission(permission);
      setStates((current) => ({ ...current, [permission]: state }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "권한 요청을 완료하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="bg-white">
      <p className="px-4 pb-3 pt-4 text-[13px] font-normal leading-5 text-[#64748b]">
        권한은 필요한 기능을 사용할 때 개별적으로 요청합니다.
      </p>
      <div className="divide-y divide-[#e7ebf0] border-y border-[#e7ebf0]">
        {rows.map(({ key, title, description, icon: Icon }) => {
          const state = states[key];
          const canRequest = supported && state !== "granted" && state !== "unsupported";
          return (
            <div key={key} className="flex min-h-[76px] items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9] text-[#334155]"><Icon className="size-[18px]" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium leading-6 text-[#0f172a]">{title}</span>
                <span className="block text-[13px] font-normal leading-5 text-[#64748b]">{description}</span>
                <span className="mt-0.5 block text-[13px] font-medium leading-5 text-[#475569]">{loading ? "확인 중" : labels[state]}</span>
              </span>
              {canRequest ? (
                <button type="button" disabled={pending !== null || loading} onClick={() => void handleAction(key)} className="min-h-11 shrink-0 rounded-[10px] border border-[#cfd9e6] bg-white px-3 text-[14px] font-medium leading-5 text-[#334155] disabled:opacity-50">
                  {pending === key ? "처리 중" : state === "permanently_denied" ? "설정 열기" : "허용하기"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {!supported ? <p className="px-4 py-3 text-[13px] leading-5 text-[#64748b]">Android 앱에서 실제 권한 상태를 확인할 수 있습니다.</p> : null}
      {error ? <p role="alert" className="mx-4 mt-3 rounded-[10px] border border-[#ead8d4] bg-[#fff8f6] px-3 py-2 text-[13px] leading-5 text-[#9a5e4e]">{error}</p> : null}
    </section>
  );
}
