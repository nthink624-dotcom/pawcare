"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  completeOwnerPlayFlexibleUpdate,
  dismissOwnerPlayUpdateInstallNotice,
  dismissOwnerPlayUpdatePrompt,
  getOwnerPlayUpdateServerSnapshot,
  getOwnerPlayUpdateSnapshot,
  startOwnerPlayFlexibleUpdate,
  startOwnerPlayUpdateCoordinator,
  subscribeOwnerPlayUpdate,
} from "@/lib/updates/owner-play-update";

export function useOwnerPlayUpdateSnapshot() {
  return useSyncExternalStore(
    subscribeOwnerPlayUpdate,
    getOwnerPlayUpdateSnapshot,
    getOwnerPlayUpdateServerSnapshot,
  );
}

export function runOwnerPlayUpdateAction() {
  const state = getOwnerPlayUpdateSnapshot();
  return state.downloaded
    ? completeOwnerPlayFlexibleUpdate()
    : startOwnerPlayFlexibleUpdate();
}

export default function OwnerAppUpdateCoordinator() {
  const state = useOwnerPlayUpdateSnapshot();

  useEffect(() => startOwnerPlayUpdateCoordinator(), []);

  useEffect(() => {
    const targetVersionCode = state.installNoticeTargetVersionCode;
    if (targetVersionCode === null) return;
    const timer = window.setTimeout(
      () => dismissOwnerPlayUpdateInstallNotice(targetVersionCode),
      10_000,
    );
    return () => window.clearTimeout(timer);
  }, [state.installNoticeTargetVersionCode]);

  return (
    <>
      {state.promptTargetVersionCode !== null ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/25 px-5" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-app-update-title"
            className="w-full max-w-[360px] rounded-[16px] border border-[#dfe5ec] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
          >
            <h2 id="owner-app-update-title" className="text-[18px] font-semibold leading-7 text-[#0f172a]">
              새 버전이 준비됐어요
            </h2>
            <p className="mt-1 text-[16px] leading-6 text-[#475569]">
              지금 업데이트하거나 설정에서 나중에 진행할 수 있어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-[10px] border border-[#d8e0ea] bg-white px-4 text-[16px] font-medium text-[#334155]"
                onClick={() => dismissOwnerPlayUpdatePrompt(state.promptTargetVersionCode!)}
              >
                나중에
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[10px] bg-[#2563eb] px-4 text-[16px] font-medium text-white disabled:opacity-50"
                disabled={state.starting}
                onClick={() => void startOwnerPlayFlexibleUpdate()}
              >
                업데이트
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {state.installNoticeTargetVersionCode !== null ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[85] mx-auto flex min-h-14 max-w-[398px] items-center justify-between gap-3 rounded-[12px] border border-[#d7e2ef] bg-white px-4 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.16)]"
        >
          <p className="text-[16px] font-medium leading-6 text-[#0f172a]">업데이트 설치 준비가 끝났어요.</p>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-[10px] px-3 text-[16px] font-semibold text-[#2563eb] disabled:opacity-50"
            disabled={state.starting}
            onClick={() => void completeOwnerPlayFlexibleUpdate()}
          >
            설치
          </button>
        </div>
      ) : null}
    </>
  );
}
