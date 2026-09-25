"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import SignupReviewStep from "@/components/auth/signup-review-step";

type Stage = "account" | "review" | "complete";

type PreviewAccount = {
  ownerName: string;
  email: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  requiredConsent: boolean;
};

const initialAccount: PreviewAccount = {
  ownerName: "김미용",
  email: "signup-preview@example.com",
  shopName: "펫매니저 테스트 미용실",
  shopPhone: "0212345678",
  shopAddress: "서울시 테스트로 10",
  requiredConsent: true,
};

function PreviewAccountStep({
  account,
  onChange,
  onBack,
  onNext,
}: {
  account: PreviewAccount;
  onChange: (account: PreviewAccount) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fields: Array<{ key: Exclude<keyof PreviewAccount, "requiredConsent">; label: string; type?: string }> = [
    { key: "ownerName", label: "대표자 이름" },
    { key: "email", label: "이메일", type: "email" },
    { key: "shopName", label: "매장명" },
    { key: "shopPhone", label: "매장 연락처", type: "tel" },
    { key: "shopAddress", label: "매장 주소" },
  ];
  const valid = fields.every(({ key }) => account[key].trim()) && account.requiredConsent;
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f1f3f7] px-3 py-7 text-[#172033] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-[820px] rounded-[18px] border border-[#d9e3ef] bg-white p-4 sm:p-7">
        <p className="text-[12px] font-medium tracking-[0.1em] text-[#1d3557]">DB-FREE PREVIEW · ACCOUNT</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.035em]">가입 정보를 확인해 주세요</h1>
        <p className="mt-2 text-[14px] font-normal leading-6 text-[#66748b]">중복 가입 검사나 본인인증 없이 화면 흐름만 반복 테스트합니다.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, type }) => <label key={key} htmlFor={`preview-${key}`} className="text-[13px] font-medium text-[#526174]">{label}<input id={`preview-${key}`} type={type ?? "text"} value={account[key]} onChange={(event) => onChange({ ...account, [key]: event.target.value })} className="mt-1.5 h-11 w-full min-w-0 rounded-[10px] border border-[#d7e0eb] px-3 text-[14px] font-normal outline-none focus-visible:border-[#1d3557] focus-visible:ring-2 focus-visible:ring-[#1d3557]/15" /></label>)}
        </div>
        <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-[#dce5ef] bg-[#f8fafc] px-4 py-3 text-[13px] font-normal text-[#526174]"><input type="checkbox" checked={account.requiredConsent} onChange={(event) => onChange({ ...account, requiredConsent: event.target.checked })} className="h-5 w-5 accent-[#1d3557]" />필수 약관 동의 테스트</label>
        <div className="mt-6 grid gap-3 sm:grid-cols-[0.42fr_1fr]"><button type="button" onClick={onBack} className="flex h-12 items-center justify-center gap-1 rounded-[10px] border border-[#ced8e5] text-[13px] font-medium text-[#526174]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />이전</button><button type="button" disabled={!valid} onClick={onNext} className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#17243c] text-[14px] font-medium text-white disabled:bg-[#c4ccd8]">최종 확인<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>
      </section>
    </main>
  );
}

function PreviewCompleteStep({ onRestart }: { onRestart: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f1f3f7] p-4 text-[#172033]">
      <section className="w-full max-w-[620px] rounded-[18px] border border-[#d9e3ef] bg-white p-5 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#edf7f2] text-[#177856]"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.035em]">회원가입 화면 테스트 완료</h1>
        <p className="mt-2 text-[14px] font-normal leading-6 text-[#607080]">가입 정보만 마지막 화면까지 전달했습니다. 요금표는 가입 후 초기 설정에서 만듭니다.</p>
        <p className="mt-5 rounded-[10px] bg-[#edf7f2] px-4 py-3 text-[13px] font-medium text-[#177856]"><ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />DB · Auth · Storage 저장 0건</p>
        <button type="button" onClick={onRestart} className="mt-5 h-12 w-full rounded-[10px] bg-[#17243c] text-[14px] font-medium text-white">처음부터 다시 테스트</button>
      </section>
    </main>
  );
}

export default function SignupAndInitialSetupPreviewClient() {
  const [stage, setStage] = useState<Stage>("account");
  const [account, setAccount] = useState<PreviewAccount>(initialAccount);

  if (stage === "account") return <PreviewAccountStep account={account} onChange={setAccount} onBack={() => setAccount(initialAccount)} onNext={() => setStage("review")} />;
  if (stage === "review") return <SignupReviewStep ownerName={account.ownerName} email={account.email} shopName={account.shopName} shopPhone={account.shopPhone} shopAddress={account.shopAddress} loading={false} message={null} onBack={() => setStage("account")} onSubmit={() => setStage("complete")} />;
  return <PreviewCompleteStep onRestart={() => { setAccount(initialAccount); setStage("account"); }} />;
}
