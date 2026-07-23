"use client";

import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerAdminDetailPanel from "@/components/admin/owner-admin-detail-panel";
import { fetchApiJson } from "@/lib/api";
import {
  buildDraft,
  loginMethodLabels,
  loginMethodToneMap,
  statusOptions,
  statusToneMap,
  toKstIsoEndOfDay,
  usageWarningToneMap,
  type AdminAlimtalkCreditBalance,
  type AdminOwnerItem,
  type OwnerDraft,
  type TemporaryPasswordResult,
} from "@/components/admin/owner-admin-model";

async function fetchOwners() {
  return fetchApiJson<AdminOwnerItem[]>("/api/admin/owners", { cache: "no-store" });
}

export default function OwnerAdminScreen({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OwnerDraft>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [resettingPaymentMethodUserId, setResettingPaymentMethodUserId] = useState<string | null>(null);
  const [issuingTemporaryPasswordUserId, setIssuingTemporaryPasswordUserId] = useState<string | null>(null);
  const [withdrawingUserId, setWithdrawingUserId] = useState<string | null>(null);
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, TemporaryPasswordResult>>({});
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [alimtalkBalances, setAlimtalkBalances] = useState<AdminAlimtalkCreditBalance[]>([]);
  const [loadingAlimtalkCredits, setLoadingAlimtalkCredits] = useState(false);
  const [savingAlimtalkCredits, setSavingAlimtalkCredits] = useState(false);
  const [alimtalkAmount, setAlimtalkAmount] = useState("100");
  const [alimtalkBucket, setAlimtalkBucket] = useState<"purchased" | "included">("purchased");
  const [alimtalkAction, setAlimtalkAction] = useState<"grant" | "reset-included">("grant");
  const [search, setSearch] = useState("");
  const [adminSurface, setAdminSurface] = useState<"local" | "production" | "unknown">("unknown");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextOwners = await fetchOwners();
        if (!active) return;
        setOwners(nextOwners);
        setDrafts(Object.fromEntries(nextOwners.map((item) => [item.userId, buildDraft(item)])));
        setSelectedUserId((current) => current ?? nextOwners[0]?.userId ?? null);
        setError(null);
        setNotice(null);
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "오너 계정 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    if (/localhost|127\.0\.0\.1/i.test(hostname) || hostname.endsWith(".local")) {
      setAdminSurface("local");
      return;
    }
    setAdminSurface("production");
  }, []);

  useEffect(() => {
    void loadAlimtalkBalances();
  }, []);

  const filteredOwners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return owners;
    return owners.filter((item) =>
      [item.ownerName, item.shopName, item.shopAddress, item.ownerPhoneNumber, item.loginId, item.ownerEmail, item.shopId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [owners, search]);

  useEffect(() => {
    if (filteredOwners.length === 0) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId((current) =>
      current && filteredOwners.some((item) => item.userId === current) ? current : filteredOwners[0].userId,
    );
  }, [filteredOwners]);

  const selectedOwner = filteredOwners.find((item) => item.userId === selectedUserId) ?? null;
  const selectedDraft = selectedOwner ? drafts[selectedOwner.userId] : null;
  const selectedAlimtalkBalance = selectedOwner
    ? alimtalkBalances.find((balance) => balance.shopId === selectedOwner.shopId) ?? null
    : null;
  const adminSurfaceLabel =
    adminSurface === "local" ? "로컬 관리자" : adminSurface === "production" ? "운영 관리자" : "관리자";
  const adminSurfaceTone =
    adminSurface === "local"
      ? "border-[#d8e3f5] bg-[#f5f9ff] text-[#486996]"
      : adminSurface === "production"
        ? "border-[#d7e7e1] bg-[#f4faf7] text-[#1f6b5b]"
        : "border-[#e6dfd4] bg-[#fcfbf8] text-[#6f665f]";

  async function logoutAdmin() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  async function saveOwner(item: AdminOwnerItem) {
    const draft = drafts[item.userId];
    if (!draft) return;
    setSavingUserId(item.userId);
    setError(null);
    setNotice(null);

    const isFreePlan = draft.currentPlanCode === "free";
    const nextServiceEndAt = draft.currentPeriodEndsAt ? toKstIsoEndOfDay(draft.currentPeriodEndsAt) : null;

    try {
      const response = await fetchApiJson<{ success: true; owners: AdminOwnerItem[] }>("/api/admin/owners", {
        method: "PATCH",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          currentPlanCode: draft.currentPlanCode,
          serviceStartedAt: toKstIsoEndOfDay(draft.serviceStartedAt),
          trialEndsAt: isFreePlan ? nextServiceEndAt ?? toKstIsoEndOfDay(draft.trialEndsAt || draft.serviceStartedAt) : undefined,
          currentPeriodEndsAt: isFreePlan ? null : nextServiceEndAt,
          lastPaymentStatus: draft.lastPaymentStatus,
          suspended: draft.suspended,
          suspensionReason: draft.suspended ? draft.suspensionReason.trim() || "운영자에 의해 계정이 일시 정지되었습니다." : null,
        }),
        headers: { "Content-Type": "application/json" },
      });

      setOwners(response.owners);
      setDrafts(Object.fromEntries(response.owners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
      setSelectedUserId(item.userId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "오너 계정 정보를 저장하지 못했습니다.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function refundOwner(item: AdminOwnerItem, paymentId?: string) {
    const reason = refundReasons[item.userId]?.trim() || "관리자 환불 처리";
    setRefundingPaymentId(paymentId ?? item.userId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<{ success: true; message: string }>("/api/admin/owners/refund", {
        method: "POST",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          paymentId,
          reason,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const nextOwners = await fetchOwners();
      setOwners(nextOwners);
      setDrafts(Object.fromEntries(nextOwners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
      setSelectedUserId(item.userId);
      setRefundReasons((prev) => ({ ...prev, [item.userId]: reason }));
      setNotice(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "결제 취소를 처리하지 못했습니다.");
    } finally {
      setRefundingPaymentId(null);
    }
  }

  async function resetOwnerPaymentMethod(item: AdminOwnerItem) {
    setResettingPaymentMethodUserId(item.userId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<{ success: true; message: string }>("/api/admin/owners/payment-method/reset", {
        method: "POST",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          reason: "복호화 오류 또는 카드 재등록 복구",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const nextOwners = await fetchOwners();
      setOwners(nextOwners);
      setDrafts(Object.fromEntries(nextOwners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
      setSelectedUserId(item.userId);
      setNotice(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "결제수단을 초기화하지 못했습니다.");
    } finally {
      setResettingPaymentMethodUserId(null);
    }
  }

  async function loadAlimtalkBalances() {
    setLoadingAlimtalkCredits(true);
    try {
      const response = await fetchApiJson<{ ok: true; balances: AdminAlimtalkCreditBalance[] }>("/api/admin/alimtalk/credits", {
        cache: "no-store",
      });
      setAlimtalkBalances(response.balances);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "알림톡 잔액을 불러오지 못했습니다.");
    } finally {
      setLoadingAlimtalkCredits(false);
    }
  }

  async function saveOwnerAlimtalkCredits(item: AdminOwnerItem) {
    const amount = Number(alimtalkAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("알림톡 건수를 입력해 주세요.");
      return;
    }

    setSavingAlimtalkCredits(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<{ ok: true; remainingCount: number | null }>("/api/admin/alimtalk/credits", {
        method: "POST",
        body: JSON.stringify({
          action: alimtalkAction,
          shopId: item.shopId,
          amount,
          creditBucket: alimtalkBucket,
          reason: alimtalkAction === "reset-included" ? "owner_admin_included_reset" : "owner_admin_credit_grant",
        }),
        headers: { "Content-Type": "application/json" },
      });
      await loadAlimtalkBalances();
      setNotice(`${item.shopName} 알림톡 잔여 ${response.remainingCount?.toLocaleString("ko-KR") ?? "-"}건`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "알림톡 건수를 저장하지 못했습니다.");
    } finally {
      setSavingAlimtalkCredits(false);
    }
  }

  async function issueOwnerTemporaryPassword(item: AdminOwnerItem) {
    if (!item.loginId) {
      setError("로그인 아이디가 없는 오너 계정에는 임시비밀번호를 발급할 수 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${item.ownerName} 오너에게 임시비밀번호를 발급할까요?\n발급 즉시 기존 비밀번호는 사용할 수 없습니다.`,
    );
    if (!confirmed) return;

    setIssuingTemporaryPasswordUserId(item.userId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<
        TemporaryPasswordResult & {
          success: true;
          message: string;
        }
      >("/api/admin/owners/temporary-password", {
        method: "POST",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
        }),
        headers: { "Content-Type": "application/json" },
      });

      setTemporaryPasswords((prev) => ({
        ...prev,
        [item.userId]: {
          loginId: response.loginId,
          temporaryPassword: response.temporaryPassword,
          issuedAt: response.issuedAt,
        },
      }));

      const nextOwners = await fetchOwners();
      setOwners(nextOwners);
      setDrafts(Object.fromEntries(nextOwners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
      setSelectedUserId(item.userId);
      setNotice(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "임시비밀번호를 발급하지 못했습니다.");
    } finally {
      setIssuingTemporaryPasswordUserId(null);
    }
  }

  async function withdrawOwner(item: AdminOwnerItem) {
    const firstConfirmed = window.confirm(
      `${item.ownerName} 오너를 회원탈퇴 처리할까요?\n\n로그인 계정과 소유 매장 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!firstConfirmed) return;

    const typedShopName = window.prompt(
      `최종 확인입니다.\n탈퇴 후 같은 아이디·이메일·소셜 계정으로 다시 가입할 수 있습니다.\n\n계속하려면 매장명 "${item.shopName}"을 입력해 주세요.`,
    );
    if (typedShopName !== item.shopName) {
      if (typedShopName !== null) {
        setError("매장명이 일치하지 않아 회원탈퇴를 취소했습니다.");
      }
      return;
    }

    setWithdrawingUserId(item.userId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<{ success: true; message: string }>("/api/admin/owners/withdraw", {
        method: "POST",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          confirmation: item.shopId,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const nextOwners = owners.filter((owner) => owner.userId !== item.userId);
      setOwners(nextOwners);
      setDrafts(Object.fromEntries(nextOwners.map((owner) => [owner.userId, buildDraft(owner)])));
      setSelectedUserId(nextOwners[0]?.userId ?? null);
      setNotice(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "회원탈퇴를 처리하지 못했습니다.");
    } finally {
      setWithdrawingUserId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] p-1.5 text-[#172033]">
      <div className="mx-auto w-full max-w-[1700px]">
        <div className="grid gap-1.5 xl:grid-cols-[minmax(0,1.35fr)_390px]">
          <section className="flex flex-col overflow-hidden rounded-[10px] border border-[#dfe7e2] bg-white xl:h-[calc(100vh-12px)]">
            <div className="border-b border-[#edf2f7] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] text-[#1f6b5b]">운영자 모드</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] ${adminSurfaceTone}`}>
                      {adminSurfaceLabel}
                    </span>
                  </div>
                  <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.03em] text-[#0f172a]">오너 계정 관리</h1>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="px-1.5 text-right">
                    <p className="text-[10px] text-[#64748b]">현재 운영자</p>
                    <p className="text-[12px] text-[#0f172a]">{adminId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/admin" as never)}
                    className="inline-flex h-7 items-center gap-0.5 rounded-[7px] border border-[#dbe2ea] bg-white px-2 text-[11px] text-[#172033] transition hover:bg-[#f8fafc]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    관리자 메인
                  </button>
                  <button
                    type="button"
                    onClick={() => void logoutAdmin()}
                    className="inline-flex h-7 items-center rounded-[7px] border border-[#dbe2ea] bg-white px-2 text-[11px] text-[#172033] transition hover:bg-[#f8fafc]"
                  >
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <label className="relative min-w-[320px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9b9084]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="오너 이름, 상호명, 전화번호, 매장명, 로그인 계정으로 검색"
                    className="h-8 w-full rounded-[7px] border border-[#dbe2ea] bg-white pl-9 pr-3 text-[12px] text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
                <div className="inline-flex h-8 items-center rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#475569]">
                  총 {filteredOwners.length}명
                </div>
              </div>

              {error ? (
                <p className="mt-2 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] leading-5 text-[#b54b4b]">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-2 rounded-[8px] border border-[#d7e7e1] bg-[#f4faf7] px-3 py-2 text-[13px] leading-5 text-[#1f6b5b]">
                  {notice}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(140px,0.8fr)_130px_120px] border-b border-[#edf2f7] bg-[#fbfcfd] px-4 py-2 text-[12px] text-[#64748b]">
              <span>오너 / 매장</span>
              <span>로그인 수단</span>
              <span>전화번호</span>
              <span>이용 상태</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-12 text-center text-[13px] text-[#6f665f]">오너 계정을 불러오는 중이에요.</div>
              ) : filteredOwners.length === 0 ? (
                <div className="px-4 py-12 text-center text-[13px] text-[#6f665f]">검색 결과가 없습니다.</div>
              ) : (
                filteredOwners.map((item) => {
                  const selected = item.userId === selectedUserId;
                  return (
                    <button
                      key={item.userId}
                      type="button"
                      onClick={() => setSelectedUserId(item.userId)}
                      className={`grid w-full grid-cols-[minmax(0,1.25fr)_minmax(140px,0.8fr)_130px_120px] items-center gap-2 border-b border-[#f1ece4] px-4 py-2.5 text-left transition ${
                        selected ? "bg-[#f8fbf9]" : "bg-white hover:bg-[#fcfbf8]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-[#171411]">{item.ownerName}</p>
                          {item.suspended ? (
                            <span className="rounded-full bg-[#fff2f2] px-1.5 py-0.5 text-[11px] font-semibold text-[#b54b4b]">정지</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] font-medium text-[#36302b]">{item.shopName}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#8a8277]">{item.shopAddress}</p>
                        {item.usageWarnings.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.usageWarnings.slice(0, 2).map((warning) => (
                              <span
                                key={`${item.userId}-${warning.code}`}
                                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${usageWarningToneMap[warning.level]}`}
                              >
                                운영 검토 · {warning.message}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {item.loginMethods.map((method) => (
                          <span key={`${item.userId}-${method}`} className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${loginMethodToneMap[method]}`}>
                            {loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>

                      <div className="text-[12px] text-[#5e564f]">{item.ownerPhoneNumber ?? "-"}</div>

                      <div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${statusToneMap[item.status]}`}>
                          {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <OwnerAdminDetailPanel
            selectedOwner={selectedOwner}
            selectedDraft={selectedDraft}
            selectedAlimtalkBalance={selectedAlimtalkBalance}
            issuingTemporaryPasswordUserId={issuingTemporaryPasswordUserId}
            temporaryPasswords={temporaryPasswords}
            issueOwnerTemporaryPassword={issueOwnerTemporaryPassword}
            loadingAlimtalkCredits={loadingAlimtalkCredits}
            savingAlimtalkCredits={savingAlimtalkCredits}
            loadAlimtalkBalances={loadAlimtalkBalances}
            alimtalkAction={alimtalkAction}
            setAlimtalkAction={setAlimtalkAction}
            alimtalkAmount={alimtalkAmount}
            setAlimtalkAmount={setAlimtalkAmount}
            alimtalkBucket={alimtalkBucket}
            setAlimtalkBucket={setAlimtalkBucket}
            saveOwnerAlimtalkCredits={saveOwnerAlimtalkCredits}
            setDrafts={setDrafts}
            savingUserId={savingUserId}
            saveOwner={saveOwner}
            withdrawingUserId={withdrawingUserId}
            withdrawOwner={withdrawOwner}
            resettingPaymentMethodUserId={resettingPaymentMethodUserId}
            resetOwnerPaymentMethod={resetOwnerPaymentMethod}
            refundReasons={refundReasons}
            setRefundReasons={setRefundReasons}
            refundingPaymentId={refundingPaymentId}
            refundOwner={refundOwner}
          />
        </div>
      </div>
    </main>
  );
}
