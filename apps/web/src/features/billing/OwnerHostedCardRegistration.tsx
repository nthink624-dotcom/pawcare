"use client";

import { IconArrowUpRight, IconLock, IconPawFilled } from "@tabler/icons-react";
import { useState } from "react";

import styles from "./owner-hosted-card-registration.module.css";

type OwnerHostedCardRegistrationProps = {
  planLabel: string;
  amountLabel: string;
  busy: boolean;
  message: string | null;
  onContinue: () => void;
};

export function OwnerHostedCardRegistration({
  planLabel,
  amountLabel,
  busy,
  message,
  onContinue,
}: OwnerHostedCardRegistrationProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <section className={styles.checkout} aria-busy={busy}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.card}>
          <div className={styles.water} />
          <div className={styles.cardFace}>
            <span className={styles.brand}>펫매니저</span>
            <span className={styles.chip} />
          </div>
          <div className={styles.pawStamp}><IconPawFilled className={styles.paw} /></div>
        </div>
      </div>

      <div className={styles.panel}>
        <h1 id="owner-billing-card-registration-title" className="text-[24px] font-semibold leading-8 tracking-[-0.025em] text-[#13213a]">정기결제 카드 등록</h1>
        <dl className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[14px] border border-[#d8e8f2] bg-white/50 px-3.5 py-3.5">
          <dt className="text-[14px] font-medium leading-5 text-[#526176]">{planLabel}</dt>
          <dd className="text-[24px] font-semibold leading-8 tracking-[-0.025em] tabular-nums text-[#13213a]">{amountLabel}</dd>
        </dl>

        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[10px] text-[14px] leading-5 text-[#334155]">
          <input type="checkbox" checked={agreed} disabled={busy} onChange={(event) => setAgreed(event.target.checked)} className="size-[18px] shrink-0 accent-[#244a78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]" />
          <span>카드 등록 후 첫 결제 및 매월 자동결제에 동의합니다.</span>
        </label>
        {message ? <p role="alert" className="mt-2 text-[14px] leading-5 text-[#a62b2b]">{message}</p> : null}
        <button
          type="button"
          disabled={!agreed || busy}
          onClick={onContinue}
          className={`${styles.action} mt-3 flex min-h-[48px]! w-full items-center justify-center gap-2 px-3 py-2 text-[16px] font-medium leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed`}
        >
          {busy ? "카드 등록 진행 중…" : "KCP에서 카드 등록하고 결제하기"}
          {!busy ? <IconArrowUpRight size={17} strokeWidth={1.8} className="shrink-0" aria-hidden="true" /> : null}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] leading-5 text-[#526176]">
          <IconLock size={14} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          <span>카드 정보는 NHN KCP 결제창에서 입력합니다.</span>
        </p>
      </div>
    </section>
  );
}
