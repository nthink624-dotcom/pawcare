"use client";

import { ChevronLeft, Loader2, RotateCcw, Search, ShieldAlert, Store } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { fetchApiJson } from "@/lib/api";

type OwnerSubscriptionStatus = "trialing" | "trial_will_end" | "active" | "past_due" | "canceled" | "expired";
type OwnerPlanCode = "free" | "monthly" | "quarterly" | "halfyearly" | "yearly";
type OwnerLastPaymentStatus = "none" | "scheduled" | "paid" | "failed" | "cancelled";
type AdminOwnerEventType =
  | "trial_extended"
  | "service_extended"
  | "plan_changed"
  | "status_changed"
  | "payment_status_changed"
  | "suspended"
  | "restored";
type AdminLoginMethod = "id" | "google" | "kakao" | "naver";

type AdminOwnerHistoryItem = {
  id: string;
  type: AdminOwnerEventType;
  adminEmail: string;
  note: string | null;
  previousPayload: Record<string, unknown>;
  nextPayload: Record<string, unknown>;
  createdAt: string;
};

type AdminOwnerPaymentStatus = "PAID" | "FAILED" | "CANCELLED" | "REQUESTED" | "SCHEDULED" | null;

type AdminOwnerPaymentItem = {
  id: string;
  paymentId: string;
  amount: number | null;
  status: AdminOwnerPaymentStatus;
  planCode: OwnerPlanCode | null;
  createdAt: string;
  refundable: boolean;
};

type AdminOwnerItem = {
  userId: string;
  ownerName: string;
  loginId: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  loginMethods: AdminLoginMethod[];
  shopId: string;
  shopName: string;
  shopAddress: string;
  joinedAt: string;
  serviceStartedAt: string;
  status: OwnerSubscriptionStatus;
  currentPlanCode: OwnerPlanCode;
  currentPlanName: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  lastPaymentStatus: OwnerLastPaymentStatus;
  paymentMethodExists: boolean;
  paymentMethodLabel: string | null;
  suspended: boolean;
  suspensionReason: string | null;
  recentEvents: AdminOwnerHistoryItem[];
  recentPayments: AdminOwnerPaymentItem[];
};

type OwnerDraft = {
  currentPlanCode: OwnerPlanCode;
  serviceStartedAt: string;
  currentPeriodEndsAt: string;
  trialEndsAt: string;
  lastPaymentStatus: OwnerLastPaymentStatus;
  suspended: boolean;
  suspensionReason: string;
};

const planOptions = [
  { value: "free", label: "체험 플랜" },
  { value: "monthly", label: "한 달 플랜" },
  { value: "quarterly", label: "세 달 플랜" },
  { value: "halfyearly", label: "여섯 달 플랜" },
  { value: "yearly", label: "일 년 플랜" },
] as const satisfies Array<{ value: OwnerPlanCode; label: string }>;

const statusOptions = [
  { value: "trialing", label: "체험 플랜 이용 중" },
  { value: "trial_will_end", label: "체험 플랜 종료 임박" },
  { value: "active", label: "이용 중" },
  { value: "past_due", label: "결제 확인 필요" },
  { value: "canceled", label: "해지" },
  { value: "expired", label: "만료" },
] as const satisfies Array<{ value: OwnerSubscriptionStatus; label: string }>;

const paymentStatusOptions = [
  { value: "none", label: "결제 이력 없음" },
  { value: "scheduled", label: "결제 예정" },
  { value: "paid", label: "결제 완료" },
  { value: "failed", label: "결제 실패" },
  { value: "cancelled", label: "결제 취소" },
] as const satisfies Array<{ value: OwnerLastPaymentStatus; label: string }>;

const recentPaymentStatusMeta: Record<
  NonNullable<AdminOwnerPaymentStatus>,
  { label: string; tone: string }
> = {
  PAID: {
    label: "결제 완료",
    tone: "border-[#cfe4d7] bg-[#f2fbf5] text-[#1f6b5b]",
  },
  CANCELLED: {
    label: "취소 완료",
    tone: "border-[#e7d8cf] bg-[#fcf7f2] text-[#8a5a41]",
  },
  REQUESTED: {
    label: "취소 요청",
    tone: "border-[#ecdcb9] bg-[#fff9ea] text-[#8f6a18]",
  },
  FAILED: {
    label: "결제 실패",
    tone: "border-[#efcfcf] bg-[#fff4f4] text-[#bb4f4f]",
  },
  SCHEDULED: {
    label: "예약 결제",
    tone: "border-[#d8e1ed] bg-[#f6f8fc] text-[#54657e]",
  },
};

const loginMethodLabels: Record<AdminLoginMethod, string> = {
  id: "아이디",
  google: "구글",
  kakao: "카카오",
  naver: "네이버",
};

const loginMethodToneMap: Record<AdminLoginMethod, string> = {
  id: "border-[#ddd4c8] bg-[#fcfbf8] text-[#5e564f]",
  google: "border-[#d7e3f5] bg-[#f6f9ff] text-[#3f63a2]",
  kakao: "border-[#f3e08e] bg-[#fff9db] text-[#7f6200]",
  naver: "border-[#cde9d8] bg-[#f2fbf5] text-[#1f6b5b]",
};

const statusToneMap: Record<OwnerSubscriptionStatus, string> = {
  trialing: "bg-[#eef7f2] text-[#1f6b5b]",
  trial_will_end: "bg-[#f9f1df] text-[#7f622f]",
  active: "bg-[#edf5ff] text-[#2d5f9a]",
  past_due: "bg-[#fdf0f0] text-[#b54b4b]",
  canceled: "bg-[#f3f1ef] text-[#746d67]",
  expired: "bg-[#f3f1ef] text-[#746d67]",
};

const eventLabelMap: Record<AdminOwnerEventType, string> = {
  trial_extended: "체험 플랜 연장",
  service_extended: "서비스 기간 연장",
  plan_changed: "플랜 변경",
  status_changed: "이용 상태 변경",
  payment_status_changed: "결제 상태 변경",
  suspended: "계정 정지",
  restored: "계정 복구",
};

function getPlanLabel(value: OwnerPlanCode | string | null | undefined) {
  if (!value) return "-";
  return planOptions.find((option) => option.value === value)?.label ?? value;
}

function getStatusLabel(value: OwnerSubscriptionStatus | string | null | undefined) {
  if (!value) return "-";
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function getPaymentStatusLabel(value: OwnerLastPaymentStatus | string | null | undefined) {
  if (!value) return "-";
  return paymentStatusOptions.find((option) => option.value === value)?.label ?? value;
}

function getRecentPaymentStatusMeta(value: AdminOwnerPaymentStatus) {
  if (!value) {
    return {
      label: "상태 확인 필요",
      tone: "border-[#e8dfd3] bg-[#fcfbf8] text-[#6f665f]",
    };
  }

  return recentPaymentStatusMeta[value];
}

function formatDateLabel(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10).replace(/-/g, ".");
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toKstIsoEndOfDay(dateText: string) {
  return dateText ? `${dateText}T23:59:59+09:00` : null;
}

function todayKstDateText() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function plusDays(dateText: string, days: number) {
  const base = dateText || new Date().toISOString().slice(0, 10);
  const date = new Date(`${base}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDraft(item: AdminOwnerItem): OwnerDraft {
  return {
    currentPlanCode: item.currentPlanCode,
    serviceStartedAt: toDateInputValue(item.serviceStartedAt),
    currentPeriodEndsAt: toDateInputValue(item.currentPlanCode === "free" ? item.trialEndsAt : item.currentPeriodEndsAt),
    trialEndsAt: toDateInputValue(item.trialEndsAt),
    lastPaymentStatus: item.lastPaymentStatus,
    suspended: item.suspended,
    suspensionReason: item.suspensionReason ?? "",
  };
}

function summarizeEvent(event: AdminOwnerHistoryItem) {
  switch (event.type) {
    case "plan_changed":
      return `${getPlanLabel(
        typeof event.previousPayload.currentPlanName === "string"
          ? event.previousPayload.currentPlanName
          : typeof event.previousPayload.currentPlanCode === "string"
            ? event.previousPayload.currentPlanCode
            : null,
      )} → ${getPlanLabel(
        typeof event.nextPayload.currentPlanName === "string"
          ? event.nextPayload.currentPlanName
          : typeof event.nextPayload.currentPlanCode === "string"
            ? event.nextPayload.currentPlanCode
            : null,
      )}`;
    case "status_changed":
      return `${getStatusLabel(typeof event.previousPayload.status === "string" ? event.previousPayload.status : null)} → ${getStatusLabel(
        typeof event.nextPayload.status === "string" ? event.nextPayload.status : null,
      )}`;
    case "payment_status_changed":
      return `${getPaymentStatusLabel(
        typeof event.previousPayload.lastPaymentStatus === "string" ? event.previousPayload.lastPaymentStatus : null,
      )} → ${getPaymentStatusLabel(typeof event.nextPayload.lastPaymentStatus === "string" ? event.nextPayload.lastPaymentStatus : null)}`;
    case "trial_extended":
      return `${formatDateLabel(typeof event.previousPayload.trialEndsAt === "string" ? event.previousPayload.trialEndsAt : null)} → ${formatDateLabel(typeof event.nextPayload.trialEndsAt === "string" ? event.nextPayload.trialEndsAt : null)}`;
    case "service_extended":
      return `${formatDateLabel(typeof event.previousPayload.currentPeriodEndsAt === "string" ? event.previousPayload.currentPeriodEndsAt : null)} → ${formatDateLabel(typeof event.nextPayload.currentPeriodEndsAt === "string" ? event.nextPayload.currentPeriodEndsAt : null)}`;
    case "suspended":
      return typeof event.nextPayload.suspensionReason === "string" && event.nextPayload.suspensionReason
        ? event.nextPayload.suspensionReason
        : "운영자에 의해 계정이 일시 정지되었습니다.";
    case "restored":
      return "정지 상태가 해제되어 다시 접속할 수 있습니다.";
    default:
      return event.note ?? "-";
  }
}

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
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

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

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-6 py-6 text-[#171411] md:px-8">
      <div className="mx-auto w-full max-w-[1560px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin" as never)}
            className="inline-flex h-[42px] items-center gap-2 rounded-full border border-[#ddd6cb] bg-white px-4 text-[13px] font-semibold text-[#171411]"
          >
            <ChevronLeft className="h-4 w-4" />
            관리자 메인으로
          </button>
          <button
            type="button"
            onClick={() => void logoutAdmin()}
            className="inline-flex h-[42px] items-center rounded-full border border-[#ddd6cb] bg-white px-4 text-[13px] font-semibold text-[#171411]"
          >
            관리자 로그아웃
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <section className="rounded-[28px] border border-[#e8dfd3] bg-white shadow-[0_14px_36px_rgba(23,20,17,0.05)]">
            <div className="border-b border-[#eee7dc] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.04em] text-[#1f6b5b]">운영자 모드</p>
                  <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-[#171411]">오너 계정 관리</h1>
                  <p className="mt-2 text-[14px] leading-6 text-[#6f665f]">
                    오너 이름, 상호명, 전화번호, 매장명으로 빠르게 찾고 플랜과 서비스 기간을 바로 조정하세요.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#e5ddd2] bg-[#fcfbf8] px-4 py-3 text-right">
                  <p className="text-[11px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 운영자 계정</p>
                  <p className="mt-1 text-[15px] font-semibold text-[#171411]">{adminId}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="relative min-w-[320px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b9084]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="오너 이름, 상호명, 전화번호, 매장명, 로그인 계정으로 검색"
                    className="h-[46px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] pl-11 pr-4 text-[14px] text-[#171411] outline-none placeholder:text-[#a2978a]"
                  />
                </label>
                <div className="inline-flex h-[46px] items-center rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-4 text-[13px] font-medium text-[#5e564f]">
                  총 {filteredOwners.length}명
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-[14px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-4 rounded-[14px] border border-[#d7e7e1] bg-[#f4faf7] px-4 py-3 text-[13px] leading-6 text-[#1f6b5b]">
                  {notice}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(180px,0.95fr)_170px_140px] border-b border-[#eee7dc] bg-[#fcfbf8] px-6 py-3 text-[12px] font-semibold text-[#8a8277]">
              <span>오너 / 매장</span>
              <span>로그인 수단</span>
              <span>전화번호</span>
              <span>이용 상태</span>
            </div>

            <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
              {loading ? (
                <div className="px-6 py-16 text-center text-[14px] text-[#6f665f]">오너 계정을 불러오는 중이에요.</div>
              ) : filteredOwners.length === 0 ? (
                <div className="px-6 py-16 text-center text-[14px] text-[#6f665f]">검색 결과가 없습니다.</div>
              ) : (
                filteredOwners.map((item) => {
                  const selected = item.userId === selectedUserId;
                  return (
                    <button
                      key={item.userId}
                      type="button"
                      onClick={() => setSelectedUserId(item.userId)}
                      className={`grid w-full grid-cols-[minmax(0,1.25fr)_minmax(180px,0.95fr)_170px_140px] items-center gap-3 border-b border-[#f1ece4] px-6 py-4 text-left transition ${
                        selected ? "bg-[#f8fbf9]" : "bg-white hover:bg-[#fcfbf8]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-[#171411]">{item.ownerName}</p>
                          {item.suspended ? (
                            <span className="rounded-full bg-[#fff2f2] px-2 py-0.5 text-[10px] font-semibold text-[#b54b4b]">정지</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[13px] font-medium text-[#36302b]">{item.shopName}</p>
                        <p className="mt-1 truncate text-[12px] text-[#8a8277]">{item.shopAddress}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {item.loginMethods.map((method) => (
                          <span key={`${item.userId}-${method}`} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${loginMethodToneMap[method]}`}>
                            {loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>

                      <div className="text-[13px] text-[#5e564f]">{item.ownerPhoneNumber ?? "-"}</div>

                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusToneMap[item.status]}`}>
                          {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="sticky top-6 self-start rounded-[28px] border border-[#e8dfd3] bg-white shadow-[0_14px_36px_rgba(23,20,17,0.05)]">
            {selectedOwner && selectedDraft ? (
              <>
                <div className="border-b border-[#eee7dc] px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[19px] font-semibold tracking-[-0.02em] text-[#171411]">{selectedOwner.ownerName}</p>
                          <p className="mt-0.5 text-[13px] text-[#6f665f]">{selectedOwner.shopName}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusToneMap[selectedOwner.status]}`}>
                      {statusOptions.find((option) => option.value === selectedOwner.status)?.label ?? selectedOwner.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] p-4">
                    <DetailRow label="로그인 수단">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {selectedOwner.loginMethods.map((method) => (
                          <span key={`${selectedOwner.userId}-detail-${method}`} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${loginMethodToneMap[method]}`}>
                            {loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>
                    </DetailRow>
                    <DetailRow
                      label="로그인 계정"
                      value={
                        selectedOwner.loginId ??
                        (selectedOwner.ownerEmail?.endsWith("@owner.pawcare.local") ? "-" : selectedOwner.ownerEmail ?? "-")
                      }
                    />
                    <DetailRow label="연동 이메일" value={selectedOwner.ownerEmail ?? "-"} />
                    <DetailRow label="전화번호" value={selectedOwner.ownerPhoneNumber ?? "-"} />
                    <DetailRow label="매장 ID" value={selectedOwner.shopId} mono />
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="현재 플랜"
                      value={selectedDraft.currentPlanCode}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], currentPlanCode: value as OwnerPlanCode },
                        }))
                      }
                      options={planOptions}
                    />
                    <SelectField
                      label="결제 상태"
                      value={selectedDraft.lastPaymentStatus}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], lastPaymentStatus: value as OwnerLastPaymentStatus },
                        }))
                      }
                      options={paymentStatusOptions}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DateField
                      label="서비스 시작일"
                      value={selectedDraft.serviceStartedAt}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], serviceStartedAt: value },
                        }))
                      }
                    />
                    <DateField
                      label="서비스 종료일"
                      value={selectedDraft.currentPeriodEndsAt}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], currentPeriodEndsAt: value },
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: {
                            ...prev[selectedOwner.userId],
                            serviceStartedAt: todayKstDateText(),
                            currentPeriodEndsAt: plusDays(todayKstDateText(), 7),
                          },
                        }))
                      }
                    >
                      서비스 7일 연장
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: {
                            ...prev[selectedOwner.userId],
                            serviceStartedAt: todayKstDateText(),
                            currentPeriodEndsAt: plusDays(todayKstDateText(), 30),
                          },
                        }))
                      }
                    >
                      서비스 30일 연장
                    </ActionButton>
                  </div>

                  <div className="rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4f1] text-[#b54b4b]">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#171411]">계정 정지 / 정지 해제</p>
                        <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                          정지는 결제와 별개로 오너 로그인과 운영 기능을 임시 차단하는 기능입니다. 분쟁, 정책 위반, 테스트 계정 잠금 같은 경우에만 쓰는 운영자 전용 기능이에요.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: {
                              ...prev[selectedOwner.userId],
                              suspended: true,
                              suspensionReason: prev[selectedOwner.userId]?.suspensionReason || "운영자에 의해 계정이 일시 정지되었습니다.",
                            },
                          }))
                        }
                        className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#f0d1d1] bg-[#fff7f7] px-3 text-[12px] font-semibold text-[#b54b4b]"
                      >
                        계정 정지
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: { ...prev[selectedOwner.userId], suspended: false, suspensionReason: "" },
                          }))
                        }
                        className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#d7e7e1] bg-[#f4faf7] px-3 text-[12px] font-semibold text-[#1f6b5b]"
                      >
                        정지 해제
                      </button>
                    </div>

                    {selectedDraft.suspended ? (
                      <label className="mt-3 block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">정지 사유</span>
                        <textarea
                          value={selectedDraft.suspensionReason}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedOwner.userId]: { ...prev[selectedOwner.userId], suspensionReason: event.target.value },
                            }))
                          }
                          className="min-h-[88px] w-full rounded-[14px] border border-[#ddd4c8] bg-white px-3 py-3 text-[14px] text-[#171411] outline-none placeholder:text-[#a2978a]"
                          placeholder="왜 계정을 정지했는지 운영 메모를 남겨 주세요."
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff5f1] text-[#b86945]">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#171411]">결제 내역 / 취소</p>
                        <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                          결제된 건을 확인하고, 필요한 건만 선택해서 취소할 수 있습니다.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[14px] border border-[#e5ddd2] bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#171411]">등록 결제수단 복구</p>
                          <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                            {selectedOwner.paymentMethodExists
                              ? `${selectedOwner.paymentMethodLabel ?? "등록된 카드"} 정보를 지우고, 오너가 배포 서버에서 새 카드를 다시 등록할 수 있게 합니다.`
                              : "현재 등록된 카드가 없어서 초기화할 결제수단이 없습니다."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void resetOwnerPaymentMethod(selectedOwner)}
                          disabled={!selectedOwner.paymentMethodExists || resettingPaymentMethodUserId === selectedOwner.userId}
                          className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-[12px] border border-[#d8d1c5] bg-[#f8f5ef] px-3 text-[12px] font-semibold text-[#5e564f] disabled:opacity-50"
                        >
                          {resettingPaymentMethodUserId === selectedOwner.userId ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              초기화 중...
                            </span>
                          ) : (
                            "결제수단 초기화"
                          )}
                        </button>
                      </div>
                    </div>

                    <label className="mt-4 block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">취소 사유</span>
                      <textarea
                        value={refundReasons[selectedOwner.userId] ?? ""}
                        onChange={(event) =>
                          setRefundReasons((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: event.target.value,
                          }))
                        }
                        className="min-h-[72px] w-full rounded-[14px] border border-[#ddd4c8] bg-white px-3 py-3 text-[14px] text-[#171411] outline-none placeholder:text-[#a2978a]"
                        placeholder="예: 중복 결제 확인, 고객 요청 환불"
                      />
                    </label>

                    <div className="mt-4 space-y-2.5">
                      {selectedOwner.recentPayments.length === 0 ? (
                        <p className="rounded-[14px] border border-[#e5ddd2] bg-white px-3 py-3 text-[12px] leading-5 text-[#8a8277]">
                          확인된 결제 내역이 아직 없습니다.
                        </p>
                      ) : (
                        selectedOwner.recentPayments.map((payment) => (
                          <div key={payment.paymentId} className="rounded-[16px] border border-[#e5ddd2] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(31,22,17,0.02)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-[#171411]">
                                  {payment.planCode ? planOptions.find((option) => option.value === payment.planCode)?.label ?? payment.planCode : "플랜 정보 없음"}
                                </p>
                                <p className="mt-1 text-[12px] font-medium text-[#5f574f]">
                                  {payment.amount !== null ? `${payment.amount.toLocaleString("ko-KR")}원` : "금액 확인 필요"}
                                </p>
                                <p className="mt-2 text-[11px] text-[#8a8277]">결제 시각 · {formatDateTimeLabel(payment.createdAt)}</p>
                                <p className="mt-1 break-all rounded-[10px] bg-[#faf7f2] px-2.5 py-2 text-[11px] font-medium text-[#7b7269]">
                                  결제 번호 · {payment.paymentId}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRecentPaymentStatusMeta(payment.status).tone}`}
                              >
                                {getRecentPaymentStatusMeta(payment.status).label}
                              </span>
                            </div>
                            {payment.refundable ? (
                              <button
                                type="button"
                                onClick={() => void refundOwner(selectedOwner, payment.paymentId)}
                                disabled={refundingPaymentId === payment.paymentId}
                                className="mt-3 inline-flex h-[38px] w-full items-center justify-center rounded-[12px] border border-[#efcfc2] bg-[#fff8f4] px-3 text-[12px] font-semibold text-[#b45d3c] disabled:opacity-50"
                              >
                                {refundingPaymentId === payment.paymentId ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    취소 처리 중...
                                  </span>
                                ) : (
                                  "이 결제 취소"
                                )}
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveOwner(selectedOwner)}
                    disabled={savingUserId === selectedOwner.userId}
                    className="inline-flex h-[46px] w-full items-center justify-center rounded-[14px] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                  >
                    {savingUserId === selectedOwner.userId ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        저장 중...
                      </span>
                    ) : (
                      "변경사항 저장"
                    )}
                  </button>

                  <div className="rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[14px] font-semibold text-[#171411]">최근 변경 이력</h3>
                      <span className="text-[11px] font-medium text-[#8a8277]">{selectedOwner.recentEvents.length}건</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedOwner.recentEvents.length === 0 ? (
                        <p className="text-[12px] leading-5 text-[#8a8277]">아직 기록된 변경 이력이 없습니다.</p>
                      ) : (
                        selectedOwner.recentEvents.map((event) => (
                          <div key={event.id} className="rounded-[14px] border border-[#e5ddd2] bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] font-semibold text-[#171411]">{eventLabelMap[event.type]}</p>
                              <span className="text-[11px] font-medium text-[#8a8277]">{formatDateTimeLabel(event.createdAt)}</span>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-[#6f665f]">{summarizeEvent(event)}</p>
                            <p className="mt-1 text-[11px] font-medium text-[#8a8277]">{event.adminEmail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-5 py-14 text-center text-[14px] text-[#6f665f]">왼쪽에서 오너 계정을 선택하면 상세 정보와 편집 영역이 열립니다.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DetailRow({ label, value, children, mono = false }: { label: string; value?: string; children?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] font-semibold tracking-[0.04em] text-[#8a8277]">{label}</span>
      <div className={`min-w-0 text-right text-[13px] text-[#171411] ${mono ? "font-mono" : "font-medium"}`}>{children ?? value ?? "-"}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-[46px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-3 text-[14px] text-[#171411] outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-[46px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-3 text-[14px] text-[#171411] outline-none" />
    </label>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-[38px] items-center justify-center rounded-[12px] border border-[#ddd4c8] bg-white px-3 text-[12px] font-semibold text-[#171411]">
      {children}
    </button>
  );
}
