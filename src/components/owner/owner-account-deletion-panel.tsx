"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { ApiRequestError } from "@/lib/api";
import { deleteOwnerAccount, type OwnerAccountDeletionAdapter } from "@/lib/account-deletion/owner-account-deletion-adapter";

export default function OwnerAccountDeletionPanel({
  onDeleted,
  deleteAccount = deleteOwnerAccount,
}: {
  onDeleted: () => void | Promise<void>;
  deleteAccount?: OwnerAccountDeletionAdapter;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!confirmed) return setError("계정 삭제 내용을 확인해 주세요.");
    if (!currentPassword) return setError("현재 비밀번호를 입력해 주세요.");

    setSubmitting(true);
    setError("");
    idempotencyKeyRef.current ??= crypto.randomUUID();
    try {
      const result = await deleteAccount({ currentPassword, confirmed: true, idempotencyKey: idempotencyKeyRef.current });
      if (result.status !== "completed") return setError(result.message);
      setCurrentPassword("");
      await onDeleted();
    } catch (cause) {
      setError(cause instanceof ApiRequestError || cause instanceof Error
        ? cause.message
        : "계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-[#9a4e45] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
        <span className="flex min-w-0 items-center gap-3"><Trash2 className="size-[18px] shrink-0" strokeWidth={1.9} /><span className="text-[16px] font-medium leading-6">계정 삭제</span></span>
        <span aria-hidden className="text-[20px] leading-none text-[#64748b]">›</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-3" aria-label="계정 삭제 확인">
      <div className="space-y-2">
        <h3 className="text-[20px] font-semibold leading-7 text-[#101a31]">계정을 삭제할까요?</h3>
        <p className="text-[14px] font-normal leading-5 text-[#475569]">계정과 매장 운영 정보는 삭제됩니다. 법령상 보존이 필요한 결제 기록은 정해진 기간 동안 분리 보관 후 삭제됩니다.</p>
      </div>
      <label className="flex min-h-[52px] items-start gap-3 rounded-[10px] border border-[#e2e8f0] bg-white px-3 py-3">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-5 accent-[#9a4e45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]" />
        <span className="text-[14px] font-medium leading-5 text-[#1e293b]">삭제 후 계정과 운영 정보를 복구할 수 없음을 확인했습니다.</span>
      </label>
      <label className="block space-y-2">
        <span className="text-[14px] font-medium leading-5 text-[#1e293b]">현재 비밀번호</span>
        <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="min-h-[48px] w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-normal leading-6 text-[#101a31] outline-none placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbeafe]" placeholder="현재 비밀번호를 입력해 주세요" />
      </label>
      {error ? <p role="alert" className="text-[14px] font-normal leading-5 text-[#9a4e45]">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setOpen(false); setError(""); setCurrentPassword(""); setConfirmed(false); }} disabled={submitting} className="min-h-[48px] rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-medium leading-6 text-[#334155] focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50">취소</button>
        <button type="submit" disabled={submitting} className="min-h-[48px] rounded-[10px] bg-[#9a4e45] px-3 text-[16px] font-medium leading-6 text-white focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50">{submitting ? "삭제 중..." : "계정 삭제하기"}</button>
      </div>
    </form>
  );
}
