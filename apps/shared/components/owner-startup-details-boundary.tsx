"use client";

import type { ReactNode } from "react";

/** Partial booking snapshots must not initialize editors for omitted fields. */
export function OwnerStartupDetailsBoundary({ pending, title, children, onClose, embedded = false, modal = true }: {
  pending: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  embedded?: boolean;
  modal?: boolean;
}) {
  if (!pending) return children;
  return (
    <div
      role={modal ? "dialog" : "region"}
      aria-modal={modal || undefined}
      aria-label={`${title} 확인 중`}
      className={embedded ? "w-full" : "fixed inset-0 z-[85] flex items-center justify-center bg-[#15213b]/30 px-4"}
      onKeyDown={event => {
        if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); }
        if (event.key === "Tab" && modal && onClose) { event.preventDefault(); event.currentTarget.querySelector("button")?.focus(); }
      }}
    >
      <section className="owner-font mx-auto w-full max-w-[430px] rounded-[14px] border border-[#e5e9ef] bg-white p-5 text-[#15213b] shadow-sm">
        <h2 className="text-[18px] font-semibold leading-6">{title}</h2>
        <p role="status" className="mt-3 text-[14px] leading-6 text-[#64748b]">최신 상세 정보를 확인하고 있습니다.</p>
        {onClose ? <button type="button" autoFocus onClick={onClose} className="mt-5 min-h-11 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">닫기</button> : null}
      </section>
    </div>
  );
}
