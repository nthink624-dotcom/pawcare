"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import { ApiResponseError, fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerAuthHandoff, clearOwnerAuthTokenCache, readOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";
import { PUBLIC_ACCOUNT_DELETION_PATH } from "@/lib/legal/legal-info";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthState = "checking" | "anonymous" | "authenticated";

const LOGIN_PATH = `/login?next=${encodeURIComponent(PUBLIC_ACCOUNT_DELETION_PATH)}` as Route;

export default function AccountDeletionRequest() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const readSession = async () => {
      if (readOwnerAuthTokenCache()) {
        if (active) setAuthState("authenticated");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) setAuthState("anonymous");
        return;
      }

      const result = await supabase.auth.getSession().catch(() => null);
      if (active) {
        setAuthState(result?.data.session?.access_token ? "authenticated" : "anonymous");
      }
    };

    void readSession();
    return () => {
      active = false;
    };
  }, []);

  const submitDeletion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !confirmed || !currentPassword) return;

    setSubmitting(true);
    setMessage(null);
    idempotencyKeyRef.current ??= window.crypto.randomUUID();

    try {
      await fetchApiJsonWithAuth<{ success: true }>("/api/owner/account-deletion", {
        method: "POST",
        body: JSON.stringify({
          confirmation: true,
          currentPassword,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      clearOwnerAuthHandoff();
      clearOwnerAuthTokenCache();
      await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" }).catch(() => undefined);
      setCurrentPassword("");
      setCompleted(true);
    } catch (error) {
      setCurrentPassword("");
      if (error instanceof ApiResponseError && error.status === 401) {
        setMessage(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "계정 삭제 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <section aria-live="polite" className="rounded-[14px] border border-[#dbe2ea] bg-white p-5 sm:p-6">
        <h2 className="text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[#15213b]">계정 삭제가 완료되었습니다</h2>
        <p className="mt-2 text-[16px] leading-6 font-normal text-[#64748b]">로그인 세션이 종료되었습니다.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#111a30] px-5 text-[16px] leading-6 font-medium tracking-[-0.005em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        >
          펫매니저 홈으로 이동
        </Link>
      </section>
    );
  }

  if (authState === "checking") {
    return (
      <section aria-live="polite" aria-busy="true" className="rounded-[14px] border border-[#dbe2ea] bg-white p-5 sm:p-6">
        <p className="text-[16px] leading-6 font-normal text-[#64748b]">로그인 상태를 확인하고 있습니다.</p>
      </section>
    );
  }

  if (authState === "anonymous") {
    return (
      <section className="rounded-[14px] border border-[#dbe2ea] bg-white p-5 sm:p-6">
        <p className="text-[16px] leading-6 font-normal text-[#64748b]">
          본인 계정으로 로그인한 뒤 현재 비밀번호를 다시 확인해야 삭제를 요청할 수 있습니다.
        </p>
        <Link
          href={LOGIN_PATH}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#111a30] px-5 text-center text-[16px] leading-6 font-medium tracking-[-0.005em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:w-auto"
        >
          로그인하고 계정 삭제 요청
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-[#dbe2ea] bg-white p-5 sm:p-6">
      <h2 className="text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[#15213b]">본인 확인 후 삭제 요청</h2>
      <form className="mt-5 space-y-5" onSubmit={submitDeletion}>
        <div>
          <label htmlFor="account-deletion-password" className="text-[14px] leading-5 font-medium tracking-[-0.005em] text-[#15213b]">
            현재 비밀번호
          </label>
          <input
            id="account-deletion-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6 font-normal text-[#15213b] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
            required
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border border-[#dbe2ea] px-3 py-3 text-[14px] leading-5 font-medium tracking-[-0.005em] text-[#15213b]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#111a30]"
          />
          <span>계정과 소유 매장의 삭제 대상 데이터가 복구되지 않는다는 내용을 확인했습니다.</span>
        </label>

        {message ? (
          <p role="alert" className="text-[13px] leading-5 font-medium text-[#9a5e4e]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !confirmed || !currentPassword}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#9a5e4e] px-5 text-[16px] leading-6 font-medium tracking-[-0.005em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {submitting ? "삭제 요청 처리 중" : "계정 삭제 요청"}
        </button>
      </form>
    </section>
  );
}
