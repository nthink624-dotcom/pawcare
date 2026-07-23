"use client";

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

type TemporaryPasswordResult = {
  loginId: string;
  temporaryPassword: string;
  issuedAt: string;
};

export default function OwnerAdminPasswordPanel({
  ownerName,
  loginId,
  issuing,
  result,
  onIssue,
}: {
  ownerName: string;
  loginId: string | null;
  issuing: boolean;
  result: TemporaryPasswordResult | null;
  onIssue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const canIssue = Boolean(loginId);

  async function copyPassword() {
    if (!result?.temporaryPassword) return;
    await navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-[#0f172a]">계정 접근 관리</p>
          <p className="mt-0.5 text-[12px] leading-4 text-[#64748b]">
            오너가 로그인하지 못할 때 임시비밀번호를 발급합니다. 발급 즉시 기존 비밀번호는 사용할 수 없습니다.
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-[#64748b]">로그인 아이디</p>
            <p className="mt-1 truncate text-[13px] text-[#0f172a]">{loginId ?? "-"}</p>
          </div>
          <button
            type="button"
            onClick={onIssue}
            disabled={!canIssue || issuing}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] bg-[#1f6b5b] px-2.5 text-[12px] text-white disabled:bg-[#c8d3cf]"
          >
            {issuing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                발급 중
              </span>
            ) : (
              "임시비밀번호 발급"
            )}
          </button>
        </div>
        {!canIssue ? (
          <p className="mt-2 rounded-[8px] bg-[#fff7ed] px-2.5 py-2 text-[12px] leading-4 text-[#9a5b24]">
            {ownerName} 오너 계정에 로그인 아이디가 없어 임시비밀번호를 발급할 수 없습니다.
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="mt-2 rounded-[8px] border border-[#d7e7e1] bg-[#f4faf7] px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-[#1f6b5b]">발급된 임시비밀번호</p>
              <p className="mt-1 break-all font-mono text-[13px] text-[#0f172a]">{result.temporaryPassword}</p>
              <p className="mt-2 text-[13px] text-[#64748b]">발급 시각: {result.issuedAt.slice(0, 16).replace("T", " ")}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] border border-[#cfe1da] bg-white px-2 text-[12px] text-[#1f6b5b]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
