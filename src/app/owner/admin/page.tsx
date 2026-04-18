"use client";

import { ChevronLeft, Loader2, ShieldCheck, ShieldOff, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type OwnerSubscriptionStatus = "trialing" | "trial_will_end" | "active" | "past_due" | "canceled" | "expired";
type OwnerPlanCode = "monthly" | "quarterly" | "halfyearly" | "yearly";
type OwnerLastPaymentStatus = "none" | "scheduled" | "paid" | "failed" | "cancelled";
type AdminOwnerEventType =
  | "trial_extended"
  | "service_extended"
  | "plan_changed"
  | "status_changed"
  | "payment_status_changed"
  | "suspended"
  | "restored";

type AdminOwnerHistoryItem = {
  id: string;
  type: AdminOwnerEventType;
  adminEmail: string;
  note: string | null;
  previousPayload: Record<string, unknown>;
  nextPayload: Record<string, unknown>;
  createdAt: string;
};

type AdminOwnerItem = {
  userId: string;
  ownerName: string;
  loginId: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  shopId: string;
  shopName: string;
  shopAddress: string;
  joinedAt: string;
  status: OwnerSubscriptionStatus;
  currentPlanCode: OwnerPlanCode;
  currentPlanName: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  lastPaymentStatus: OwnerLastPaymentStatus;
  paymentMethodExists: boolean;
  suspended: boolean;
  suspensionReason: string | null;
  recentEvents: AdminOwnerHistoryItem[];
};

type OwnerDraft = {
  currentPlanCode: OwnerPlanCode;
  status: OwnerSubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEndsAt: string;
  lastPaymentStatus: OwnerLastPaymentStatus;
  suspended: boolean;
  suspensionReason: string;
};

const ADMIN_EMAIL = "nthink624@gmail.com";

const planOptions: Array<{ value: OwnerPlanCode; label: string }> = [
  { value: "monthly", label: "1개월" },
  { value: "quarterly", label: "3개월 약정" },
  { value: "halfyearly", label: "6개월 약정" },
  { value: "yearly", label: "12개월 약정" },
];

const statusOptions: Array<{ value: OwnerSubscriptionStatus; label: string }> = [
  { value: "trialing", label: "무료체험 중" },
  { value: "trial_will_end", label: "무료체험 종료 임박" },
  { value: "active", label: "이용 중" },
  { value: "past_due", label: "결제 확인 필요" },
  { value: "canceled", label: "해지" },
  { value: "expired", label: "만료" },
];

const paymentStatusOptions: Array<{ value: OwnerLastPaymentStatus; label: string }> = [
  { value: "none", label: "결제 이력 없음" },
  { value: "scheduled", label: "결제 예정" },
  { value: "paid", label: "결제 완료" },
  { value: "failed", label: "결제 실패" },
  { value: "cancelled", label: "결제 취소" },
];

const statusToneMap: Record<OwnerSubscriptionStatus, string> = {
  trialing: "bg-[#eef7f2] text-[#1f6b5b]",
  trial_will_end: "bg-[#f9f1df] text-[#7f622f]",
  active: "bg-[#edf5ff] text-[#2d5f9a]",
  past_due: "bg-[#fdf0f0] text-[#b54b4b]",
  canceled: "bg-[#f3f1ef] text-[#746d67]",
  expired: "bg-[#f3f1ef] text-[#746d67]",
};

const eventLabelMap: Record<AdminOwnerEventType, string> = {
  trial_extended: "무료체험 연장",
  service_extended: "서비스 기간 연장",
  plan_changed: "플랜 변경",
  status_changed: "이용 상태 변경",
  payment_status_changed: "결제 상태 변경",
  suspended: "계정 일시 정지",
  restored: "계정 복구",
};

function formatDateLabel(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10).replace(/-/g, ".");
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(
    2,
    "0",
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toKstIsoEndOfDay(dateText: string) {
  return dateText ? `${dateText}T23:59:59+09:00` : null;
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
    status: item.status,
    trialEndsAt: toDateInputValue(item.trialEndsAt),
    currentPeriodEndsAt: toDateInputValue(item.currentPeriodEndsAt),
    lastPaymentStatus: item.lastPaymentStatus,
    suspended: item.suspended,
    suspensionReason: item.suspensionReason ?? "",
  };
}

function summarizeEvent(event: AdminOwnerHistoryItem) {
  switch (event.type) {
    case "plan_changed":
      return `${String(event.previousPayload.currentPlanName ?? event.previousPayload.currentPlanCode ?? "-")} → ${String(
        event.nextPayload.currentPlanName ?? event.nextPayload.currentPlanCode ?? "-",
      )}`;
    case "status_changed":
      return `${String(event.previousPayload.status ?? "-")} → ${String(event.nextPayload.status ?? "-")}`;
    case "payment_status_changed":
      return `${String(event.previousPayload.lastPaymentStatus ?? "-")} → ${String(event.nextPayload.lastPaymentStatus ?? "-")}`;
    case "trial_extended":
      return `${formatDateLabel(
        typeof event.previousPayload.trialEndsAt === "string" ? event.previousPayload.trialEndsAt : null,
      )} → ${formatDateLabel(typeof event.nextPayload.trialEndsAt === "string" ? event.nextPayload.trialEndsAt : null)}`;
    case "service_extended":
      return `${formatDateLabel(
        typeof event.previousPayload.currentPeriodEndsAt === "string"
          ? event.previousPayload.currentPeriodEndsAt
          : null,
      )} → ${formatDateLabel(
        typeof event.nextPayload.currentPeriodEndsAt === "string" ? event.nextPayload.currentPeriodEndsAt : null,
      )}`;
    case "suspended":
      return typeof event.nextPayload.suspensionReason === "string" && event.nextPayload.suspensionReason
        ? event.nextPayload.suspensionReason
        : "운영자가 계정을 일시 정지했습니다.";
    case "restored":
      return "일시 정지 상태를 해제했습니다.";
    default:
      return event.note ?? "-";
  }
}

export default function OwnerAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OwnerDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setError("Supabase 설정을 확인해 주세요.");
          setLoading(false);
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login?next=%2Fowner%2Fadmin" as never);
        return;
      }

      const normalizedEmail = session.user.email?.trim().toLowerCase() ?? "";
      setCurrentEmail(normalizedEmail);

      if (normalizedEmail !== ADMIN_EMAIL) {
        if (active) {
          setError("이 페이지는 운영자 본인만 볼 수 있어요.");
          setLoading(false);
        }
        return;
      }

      try {
        const nextOwners = await fetchApiJsonWithAuth<AdminOwnerItem[]>("/api/admin/owners");
        if (!active) return;

        setOwners(nextOwners);
        setDrafts(Object.fromEntries(nextOwners.map((item) => [item.userId, buildDraft(item)])));
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "오너 계정을 불러오지 못했어요.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filteredOwners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return owners;

    return owners.filter((item) =>
      [item.ownerName, item.ownerEmail, item.shopName, item.shopAddress, item.loginId, item.ownerPhoneNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [owners, search]);

  async function saveOwner(item: AdminOwnerItem) {
    const draft = drafts[item.userId];
    if (!draft) return;

    setSavingUserId(item.userId);
    setError(null);

    try {
      const response = await fetchApiJsonWithAuth<{ success: true; owners: AdminOwnerItem[] }>("/api/admin/owners", {
        method: "PATCH",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          currentPlanCode: draft.currentPlanCode,
          status: draft.status,
          trialEndsAt: toKstIsoEndOfDay(draft.trialEndsAt),
          currentPeriodEndsAt: draft.currentPeriodEndsAt ? toKstIsoEndOfDay(draft.currentPeriodEndsAt) : null,
          lastPaymentStatus: draft.lastPaymentStatus,
          suspended: draft.suspended,
          suspensionReason: draft.suspended ? draft.suspensionReason.trim() || "운영자에 의해 계정이 일시 정지되었습니다." : null,
        }),
      });

      setOwners(response.owners);
      setDrafts(Object.fromEntries(response.owners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "오너 계정을 수정하지 못했어요.");
    } finally {
      setSavingUserId(null);
    }
  }

  const denied = !loading && currentEmail && currentEmail !== ADMIN_EMAIL;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-4 py-4 text-[#171411]">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/owner")}
          className="inline-flex h-[42px] items-center gap-2 rounded-full border border-[#e5ddd2] bg-white px-4 text-[14px] font-semibold text-[#171411]"
        >
          <ChevronLeft className="h-4 w-4" />
          설정으로 돌아가기
        </button>
      </div>

      <section className="rounded-[24px] border border-[#e8dfd3] bg-white px-4 py-5 shadow-[0_16px_40px_rgba(23,20,17,0.06)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1f6b5b]">운영자 전용</p>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em] text-[#171411]">오너 계정 관리</h1>
            <p className="mt-2 text-[14px] leading-6 text-[#6f665f]">
              가입한 사장님 계정을 직접 관리하고, 무료체험 연장, 서비스 기간 조정, 결제 상태 변경과 계정 정지/복구를 한 번에 처리할 수 있어요.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="사장님 이름, 이메일, 매장명으로 검색"
            className="h-[48px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-4 text-[14px] text-[#171411] outline-none placeholder:text-[#a2978a]"
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-[14px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
            {error}
          </p>
        ) : null}
      </section>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-[22px] border border-[#e8dfd3] bg-white px-4 py-8 text-center text-[14px] text-[#6f665f]">
            오너 계정을 불러오는 중이에요.
          </div>
        ) : denied ? (
          <div className="rounded-[22px] border border-[#ead9d9] bg-white px-4 py-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#fff4f4] text-[#b54b4b]">
              <ShieldOff className="h-5 w-5" />
            </div>
            <p className="mt-3 text-[15px] font-semibold text-[#171411]">운영자 본인만 접근할 수 있어요.</p>
            <p className="mt-1 text-[13px] leading-6 text-[#6f665f]">
              지금 로그인한 계정으로는 이 화면을 볼 수 없어요.
            </p>
          </div>
        ) : filteredOwners.length === 0 ? (
          <div className="rounded-[22px] border border-[#e8dfd3] bg-white px-4 py-8 text-center text-[14px] text-[#6f665f]">
            검색 결과가 없어요.
          </div>
        ) : (
          filteredOwners.map((item) => {
            const draft = drafts[item.userId];
            const saving = savingUserId === item.userId;

            return (
              <section
                key={item.userId}
                className="rounded-[22px] border border-[#e8dfd3] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(23,20,17,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171411]">{item.ownerName}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusToneMap[item.status]}`}>
                        {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                      </span>
                      {item.suspended ? (
                        <span className="rounded-full bg-[#fdf0f0] px-2.5 py-1 text-[11px] font-semibold text-[#b54b4b]">
                          정지됨
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[14px] font-medium text-[#36302b]">{item.shopName}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#7b726b]">{item.shopAddress}</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-[#f6fbf9] px-3 py-1.5 text-[11px] font-semibold text-[#1f6b5b]">
                    <Store className="mr-1 inline h-3.5 w-3.5" />
                    {item.shopId}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-[#6f665f]">
                  <InfoItem label="로그인 이메일" value={item.ownerEmail ?? item.loginId ?? "-"} />
                  <InfoItem label="연락처" value={item.ownerPhoneNumber ?? "-"} />
                  <InfoItem label="가입일" value={formatDateLabel(item.joinedAt)} />
                  <InfoItem
                    label="최근 결제 상태"
                    value={paymentStatusOptions.find((option) => option.value === item.lastPaymentStatus)?.label ?? item.lastPaymentStatus}
                  />
                </div>

                {draft ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="플랜"
                        value={draft.currentPlanCode}
                        onChange={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: { ...prev[item.userId], currentPlanCode: value as OwnerPlanCode },
                          }))
                        }
                        options={planOptions}
                      />
                      <SelectField
                        label="이용 상태"
                        value={draft.status}
                        onChange={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: { ...prev[item.userId], status: value as OwnerSubscriptionStatus },
                          }))
                        }
                        options={statusOptions}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <DateField
                        label="무료체험 종료일"
                        value={draft.trialEndsAt}
                        onChange={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: { ...prev[item.userId], trialEndsAt: value },
                          }))
                        }
                      />
                      <DateField
                        label="서비스 종료일"
                        value={draft.currentPeriodEndsAt}
                        onChange={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: { ...prev[item.userId], currentPeriodEndsAt: value },
                          }))
                        }
                      />
                    </div>

                    <SelectField
                      label="결제 상태"
                      value={draft.lastPaymentStatus}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.userId]: { ...prev[item.userId], lastPaymentStatus: value as OwnerLastPaymentStatus },
                        }))
                      }
                      options={paymentStatusOptions}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: {
                              ...prev[item.userId],
                              trialEndsAt: plusDays(prev[item.userId]?.trialEndsAt, 7),
                            },
                          }))
                        }
                        className="inline-flex h-[38px] items-center justify-center rounded-[12px] border border-[#ddd4c8] bg-white px-3 text-[12px] font-semibold text-[#171411]"
                      >
                        체험 7일 연장
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: {
                              ...prev[item.userId],
                              currentPeriodEndsAt: plusDays(
                                prev[item.userId]?.currentPeriodEndsAt || prev[item.userId]?.trialEndsAt,
                                30,
                              ),
                              status: "active",
                            },
                          }))
                        }
                        className="inline-flex h-[38px] items-center justify-center rounded-[12px] border border-[#ddd4c8] bg-white px-3 text-[12px] font-semibold text-[#171411]"
                      >
                        서비스 30일 연장
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.userId]: {
                              ...prev[item.userId],
                              suspended: true,
                              suspensionReason:
                                prev[item.userId]?.suspensionReason || "운영자에 의해 계정이 일시 정지되었습니다.",
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
                            [item.userId]: { ...prev[item.userId], suspended: false, suspensionReason: "" },
                          }))
                        }
                        className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#d7e7e1] bg-[#f4faf7] px-3 text-[12px] font-semibold text-[#1f6b5b]"
                      >
                        정지 해제
                      </button>
                    </div>

                    {draft.suspended ? (
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">정지 사유</span>
                        <textarea
                          value={draft.suspensionReason}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.userId]: { ...prev[item.userId], suspensionReason: event.target.value },
                            }))
                          }
                          className="min-h-[84px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-3 py-3 text-[14px] text-[#171411] outline-none placeholder:text-[#a2978a]"
                          placeholder="왜 계정을 정지했는지 메모해 두세요"
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void saveOwner(item)}
                      disabled={saving}
                      className="inline-flex h-[46px] w-full items-center justify-center rounded-[14px] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          저장 중...
                        </span>
                      ) : (
                        "변경사항 저장"
                      )}
                    </button>

                    <div className="rounded-[18px] border border-[#ebe5dc] bg-[#fcfbf8] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-[#171411]">최근 변경 이력</h3>
                        <span className="text-[11px] font-medium text-[#8a8277]">{item.recentEvents.length}건</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {item.recentEvents.length === 0 ? (
                          <p className="text-[12px] leading-5 text-[#8a8277]">아직 기록된 변경 이력이 없어요.</p>
                        ) : (
                          item.recentEvents.map((event) => (
                            <div key={event.id} className="rounded-[14px] border border-[#e5ddd2] bg-white px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[12px] font-semibold text-[#171411]">{eventLabelMap[event.type]}</p>
                                <span className="text-[11px] font-medium text-[#8a8277]">
                                  {formatDateTimeLabel(event.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">{summarizeEvent(event)}</p>
                              <p className="mt-1 text-[11px] font-medium text-[#8a8277]">{event.adminEmail}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#ebe5dc] bg-[#fcfbf8] px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-[#8a8277]">{label}</p>
      <p className="mt-1 break-all text-[13px] font-medium leading-5 text-[#171411]">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[46px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-3 text-[14px] text-[#171411] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6f665f]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[46px] w-full rounded-[14px] border border-[#ddd4c8] bg-[#fcfbf8] px-3 text-[14px] text-[#171411] outline-none"
      />
    </label>
  );
}
