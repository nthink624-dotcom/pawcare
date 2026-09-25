"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

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
  const promptRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (state.promptTargetVersionCode !== null && !promptRef.current?.open) promptRef.current?.showModal();
  }, [state.promptTargetVersionCode]);

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
        <dialog ref={promptRef} aria-labelledby="owner-app-update-title"
          onCancel={(event) => { event.preventDefault(); dismissOwnerPlayUpdatePrompt(state.promptTargetVersionCode!); }}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-[360px] overflow-y-auto rounded-[14px] border-0 bg-white p-0 text-[#0f172a] backdrop:bg-slate-950/25">
          <section
            className="w-full rounded-[14px] border border-[#dfe5ec] bg-white p-5"
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
                className="min-h-11 rounded-[10px] border border-[#d8e0ea] bg-white px-4 py-2 text-[16px] font-medium text-[#334155] focus-visible:outline-2 focus-visible:outline-[#2563eb]"
                onClick={() => dismissOwnerPlayUpdatePrompt(state.promptTargetVersionCode!)}
              >
                나중에
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[10px] bg-[#111a30] px-4 py-2 text-[16px] font-medium text-white focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
                disabled={state.starting}
                onClick={() => void startOwnerPlayFlexibleUpdate()}
              >
                업데이트
              </button>
            </div>
          </section>
        </dialog>
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
