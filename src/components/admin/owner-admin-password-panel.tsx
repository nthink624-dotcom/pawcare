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
    <section className="rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[#171411]">계정 접근 관리</p>
          <p className="mt-1 text-[14px] leading-5 text-[#6f665f]">
            오너가 로그인하지 못할 때 임시비밀번호를 발급합니다. 발급 즉시 기존 비밀번호는 사용할 수 없습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[#e5ddd2] bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#8a8277]">로그인 아이디</p>
            <p className="mt-1 truncate text-[16px] font-semibold text-[#171411]">{loginId ?? "-"}</p>
          </div>
          <button
            type="button"
            onClick={onIssue}
            disabled={!canIssue || issuing}
            className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[#1f6b5b] px-3 text-[14px] font-semibold text-white disabled:bg-[#c8d3cf]"
          >
            {issuing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                발급 중
              </span>
            ) : (
              "임시비밀번호 발급"
            )}
          </button>
        </div>
        {!canIssue ? (
          <p className="mt-3 rounded-[12px] bg-[#fff7ed] px-3 py-2 text-[14px] leading-5 text-[#9a5b24]">
            {ownerName} 오너 계정에 로그인 아이디가 없어 임시비밀번호를 발급할 수 없습니다.
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="mt-3 rounded-[14px] border border-[#d7e7e1] bg-[#f4faf7] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#1f6b5b]">발급된 임시비밀번호</p>
              <p className="mt-1 break-all font-mono text-[16px] font-semibold text-[#171411]">{result.temporaryPassword}</p>
              <p className="mt-2 text-[11px] text-[#6f665f]">발급 시각: {result.issuedAt.slice(0, 16).replace("T", " ")}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[10px] border border-[#cfe1da] bg-white px-2.5 text-[14px] font-semibold text-[#1f6b5b]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
