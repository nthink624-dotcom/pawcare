"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ownerSignupTerms, type OwnerSignupTermId } from "@/lib/auth/owner-signup-terms";

type Agreements = Record<OwnerSignupTermId, boolean>;

function ConsentModal({ children, titleId, onClose }: { children: ReactNode; titleId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[400px] overflow-hidden rounded-[18px] border-0 bg-white p-0 text-[#111827] shadow-xl backdrop:bg-black/35"
    >
      {children}
    </dialog>
  );
}

export default function SignupConsentDialog({ agreements, allAgreed, requiredAgreed, onAllChange, onAgreementChange, onClose, onContinue, message, primaryClassName, secondaryClassName }: {
  agreements: Agreements;
  allAgreed: boolean;
  requiredAgreed: boolean;
  onAllChange: (checked: boolean) => void;
  onAgreementChange: (id: OwnerSignupTermId, checked: boolean) => void;
  onClose: () => void;
  onContinue: () => void;
  message: string | null;
  primaryClassName: string;
  secondaryClassName: string;
}) {
  const [activeTerm, setActiveTerm] = useState<OwnerSignupTermId | null>(null);
  const titleId = useId();
  const documentTitleId = useId();
  const term = ownerSignupTerms.find((item) => item.id === activeTerm);

  return (
    <>
      <ConsentModal titleId={titleId} onClose={onClose}>
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <div className="min-h-0 overflow-y-auto px-5 pt-5" data-signup-sheet-body="consent">
            <h2 id={titleId} className="m-0 text-[20px] font-semibold leading-7">약관 동의</h2>
            <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] bg-[#f3f5f7] px-3">
              <input type="checkbox" checked={allAgreed} onChange={(event) => onAllChange(event.target.checked)} className="h-[18px] w-[18px] shrink-0 accent-[#111a30]" />
              <span className="auth-type-control">전체 동의하기</span>
            </label>
            <div className="mt-2">
              {ownerSignupTerms.map((item) => (
                <div key={item.id} className="flex items-center gap-1">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1 pl-3">
                    <input type="checkbox" checked={agreements[item.id]} onChange={(event) => onAgreementChange(item.id, event.target.checked)} className="h-[18px] w-[18px] shrink-0 accent-[#111a30]" />
                    <span className="text-[14px] font-medium leading-5 break-keep">[{item.required ? "필수" : "선택"}] {item.title}</span>
                  </label>
                  <button type="button" onClick={() => setActiveTerm(item.id)} aria-label={`${item.title} 보기`} className="min-h-11 min-w-11 shrink-0 text-[13px] text-[#64748b] underline underline-offset-2">보기</button>
                </div>
              ))}
            </div>
            {message ? <p role="alert" className="mt-2 text-[14px] leading-5 text-red-600">{message}</p> : null}
          </div>
          <footer className="grid shrink-0 grid-cols-2 gap-3 p-5 pt-4" data-signup-stage-footer="consent">
            <button type="button" onClick={onClose} className={secondaryClassName}>닫기</button>
            <button type="button" onClick={onContinue} disabled={!requiredAgreed} className={primaryClassName}>계속하기</button>
          </footer>
        </div>
      </ConsentModal>
      {term ? (
        <ConsentModal titleId={documentTitleId} onClose={() => setActiveTerm(null)}>
          <div className="flex max-h-[calc(100dvh-32px)] flex-col p-5">
            <h2 id={documentTitleId} className="m-0 shrink-0 text-[20px] font-semibold leading-7">{term.title}</h2>
            <div tabIndex={0} role="region" aria-labelledby={documentTitleId} className="my-4 min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-[14px] leading-6">{term.content}</div>
            <button type="button" onClick={() => setActiveTerm(null)} className={`${secondaryClassName} shrink-0`}>닫기</button>
          </div>
        </ConsentModal>
      ) : null}
    </>
  );
}
