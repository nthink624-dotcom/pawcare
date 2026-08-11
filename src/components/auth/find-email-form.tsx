"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { findEmailWithKcpIdentityVerification } from "@/lib/auth/find-email-identity";

type FindEmailStep = "verify" | "result";

export default function FindEmailForm() {
  const router = useRouter();
  const [step, setStep] = useState<FindEmailStep>("verify");
  const [message, setMessage] = useState<string | null>(null);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    setMessage(null);
    if (step === "result") {
      setFoundEmail(null);
      setStep("verify");
      return;
    }

    router.replace("/login");
  };

  const startIdentityVerification = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const email = await findEmailWithKcpIdentityVerification();
      setFoundEmail(email);
      setStep("result");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "본인인증을 진행하는 중 문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = step === "result" ? "이메일 확인" : "이메일 찾기";

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
      <div className="w-full max-w-[448px] rounded-[32px] bg-white px-8 pb-11 pt-9 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
        <div className="relative flex h-10 items-center justify-center">
          <MobileBackButton
            onClick={goBack}
            label={step === "verify" ? "로그인으로 이동" : "이메일 찾기로 돌아가기"}
            className="absolute left-0 h-10 w-10 border-0 bg-transparent text-[#111827] shadow-none hover:bg-[#f8fafc]"
          />
          <h1 className="text-[24px] font-extrabold leading-6 tracking-[-0.04em] text-[#101a31]">{pageTitle}</h1>
        </div>

        {step === "verify" ? (
          <section className="pt-12">
            <h2 className="text-[21px] font-bold leading-8 tracking-[-0.03em] text-[#111827]">
              본인 명의로 인증해 주세요.
            </h2>
            <p className="mt-3 break-keep text-[15px] leading-6 text-[#7184a6]">
              가입 시 등록된 이메일은 KCP 본인인증 결과를 기준으로 바로 확인할 수 있어요.
            </p>

            <div className="mt-8 rounded-[16px] border border-[#dbe5f6] bg-[#f7faff] px-5 py-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#e7effe] text-[#111a30]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[15px] font-bold text-[#111827]">KCP 본인인증</p>
                  <p className="mt-1 break-keep text-[13px] leading-5 text-[#7184a6]">
                    인증 창에서 PASS 또는 휴대폰 인증을 완료해 주세요. 이름과 휴대폰번호는 따로 입력하지 않습니다.
                  </p>
                </div>
              </div>
            </div>

            {message ? <p className="mt-4 text-[13px] leading-5 text-[#9f5b52]">{message}</p> : null}

            <button
              type="button"
              onClick={startIdentityVerification}
              disabled={loading}
              className="mt-7 flex h-[62px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#111a30] text-[17px] font-bold text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px disabled:opacity-60"
            >
              {loading ? "인증 확인 중..." : "KCP 본인인증 시작하기"}
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </section>
        ) : (
          <section className="pt-12">
            <h2 className="text-[21px] font-bold leading-8 tracking-[-0.03em] text-[#111827]">이메일을 확인했어요.</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#7184a6]">본인인증 정보와 연결된 로그인 이메일입니다.</p>

            <div className="mt-8 rounded-[16px] border border-[#dbe5f6] bg-[#f7faff] px-5 py-5">
              <p className="text-[13px] font-semibold text-[#7184a6]">로그인 이메일</p>
              <p className="mt-2 break-all text-[21px] font-bold tracking-[-0.03em] text-[#111827]">{foundEmail}</p>
            </div>

            {foundEmail ? (
              <Link
                href={`/login/reset?email=${encodeURIComponent(foundEmail)}`}
                replace
                className="mt-4 flex h-[58px] w-full items-center justify-center rounded-[12px] border border-[#dbe5f6] bg-white text-[15px] font-bold text-[#111a30] transition hover:bg-[#f1f5fb]"
              >
                비밀번호 찾기로 이동
              </Link>
            ) : null}

            <Link
              href="/login"
              replace
              className="mt-4 flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] text-[17px] font-bold text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px"
            >
              로그인으로 이동
            </Link>
          </section>
        )}

        <div className="mt-8 text-center text-[14px] text-[#7184a6]">
          비밀번호를 찾으려면{" "}
          <Link href="/login/reset" replace className="font-semibold text-[#111827] underline underline-offset-4">
            여기로 이동해 주세요
          </Link>
        </div>
      </div>
    </main>
  );
}
