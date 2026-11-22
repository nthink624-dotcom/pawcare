"use client";

import { useEffect, useRef, type ReactNode } from "react";

let openModalCount = 0;
let originalBodyOverflow = "";

export default function SetupModal({ children, label, onCancel, hideScrollbar = false, fullScreen = false, contained = false, reference = false }: {
  children: ReactNode;
  hideScrollbar?: boolean;
  fullScreen?: boolean;
  contained?: boolean;
  reference?: boolean;
  label: string;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (openModalCount === 0) originalBodyOverflow = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = originalBodyOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onCancel(); }}
      style={contained ? { maxHeight: reference ? "calc(100dvh - var(--setup-modal-margin, 64px) - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : "calc(100dvh - 64px - env(safe-area-inset-top) - env(safe-area-inset-bottom))" } : undefined}
      className={`owner-font ${hideScrollbar ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""} fixed inset-0 ${fullScreen ? "m-0 h-dvh max-h-dvh w-full max-w-none overflow-hidden rounded-none sm:m-auto sm:h-[min(900px,calc(100dvh-48px))] sm:max-w-[560px] sm:rounded-[18px]" : contained ? `m-auto ${reference ? "w-[calc(100%-16px)] max-w-[372px]" : "w-[calc(100%-24px)] max-w-[480px]"} overflow-hidden rounded-[18px]` : "m-auto max-h-[calc(100dvh-48px)] w-[calc(100%-32px)] max-w-[430px] overflow-y-auto rounded-[18px]"} ${reference ? "border border-[#e5e7eb] shadow-none [--setup-modal-margin:64px]" : "border-0 shadow-xl"} bg-white p-0 text-[#111a30] backdrop:bg-black/35`}
    >
      {children}
    </dialog>
  );
}
