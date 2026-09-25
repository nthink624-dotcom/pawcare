"use client";

import { useEffect, useRef, type ReactNode } from "react";

let openModalCount = 0;
let originalBodyOverflow = "";

export default function SetupModal({ children, label, onCancel, hideScrollbar = false }: {
  children: ReactNode;
  hideScrollbar?: boolean;
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
      className={`owner-font ${hideScrollbar ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""} fixed inset-0 m-auto max-h-[calc(100dvh-48px)] w-[calc(100%-32px)] max-w-[430px] overflow-y-auto rounded-[18px] border-0 bg-white p-0 text-[#111a30] shadow-xl backdrop:bg-black/35`}
    >
      {children}
    </dialog>
  );
}
