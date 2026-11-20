"use client";

import { IconX } from "@tabler/icons-react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

export const calendarFieldClass = "min-h-11 w-full min-w-0 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-blue-600";
export const calendarSecondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";
export const calendarPrimaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-blue-600 px-4 text-[14px] font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

export function CalendarDialog({ title, busy, onClose, children }: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[460px] overflow-y-auto rounded-[14px] border border-[#e8edf3] bg-white p-0 text-[#172033] shadow-xl backdrop:bg-[#111827]/40"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#e8edf3] px-4 py-2.5">
        <h2 id={titleId} className="text-[20px] font-semibold leading-7">{title}</h2>
        <button type="button" disabled={busy} aria-label="닫기" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
          <IconX size={20} stroke={1.75} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
