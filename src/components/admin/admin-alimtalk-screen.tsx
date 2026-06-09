"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, RefreshCcw, Save, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import AdminAlimtalkActivitySections from "@/components/admin/admin-alimtalk-activity-sections";
import AdminAlimtalkRuntimePanel from "@/components/admin/admin-alimtalk-runtime-panel";
import AdminAlimtalkTemplateRegistrationPanel from "@/components/admin/admin-alimtalk-template-registration-panel";
import { fetchApiJson } from "@/lib/api";
import type {
  AdminNotificationActivity,
  AppAlimtalkConfig,
  AppTemplateDraft,
  RelayAdminConfig,
  RelayAdminConfigResponse,
  RelaySsodaaTemplateItem,
  RelayTemplateCatalogResponse,
} from "@/server/admin-alimtalk";

const relayFieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: keyof RelayAdminConfig; label: string; placeholder?: string; help?: string }>;
}> = [
  {
    title: "연결 원본값",
    description: "릴레이 서버가 쏘다 API를 호출할 때 쓰는 핵심 연결값입니다. 보통 최초 세팅 후 자주 바꾸지 않습니다.",
    fields: [
      { key: "relaySecret", label: "Relay Secret", help: "Vercel의 ALIMTALK_RELAY_SECRET과 같아야 합니다." },
      { key: "ssodaaApiUrl", label: "쏘다 발송 URL", help: "알림톡 실제 발송 API 주소입니다." },
      { key: "ssodaaSentListUrl", label: "쏘다 발송 조회 URL", help: "발송 결과를 다시 확인할 때 쓰는 API 주소입니다." },
      { key: "ssodaaApiKey", label: "쏘다 API Key" },
      { key: "ssodaaTokenKey", label: "쏘다 Token Key" },
      { key: "ssodaaSenderKey", label: "쏘다 Sender Key", help: "카카오 채널/발신 프로필에 연결된 Sender Key입니다." },
    ],
  },
  {
    title: "릴레이 템플릿 코드 매핑",
    description: "각 알림 종류가 쏘다의 어떤 템플릿 코드로 발송될지 연결합니다. 승인된 코드만 넣어야 실제 발송됩니다.",
    fields: [
      { key: "templateBookingReceived", label: "예약 접수", placeholder: "booking_received" },
      { key: "templateBookingConfirmed", label: "예약 확정", placeholder: "booking_confirmed" },
      { key: "templateBookingRejected", label: "예약 거절", placeholder: "booking_rejected" },
      { key: "templateBookingCancelled", label: "예약 취소", placeholder: "booking_cancelled" },
      { key: "templateBookingRescheduledConfirmed", label: "예약 변경 확정", placeholder: "booking_rescheduled_confirmed" },
      { key: "templateAppointmentReminder10m", label: "방문 전 알림", placeholder: "appointment_reminder_10m" },
      { key: "templateGroomingStarted", label: "미용 시작", placeholder: "grooming_started" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비", placeholder: "grooming_almost_done" },
      { key: "templateGroomingCompleted", label: "미용 완료 사진", placeholder: "grooming_completed_photo" },
      { key: "templateRevisitNotice", label: "재방문 안내", placeholder: "revisit_notice" },
      { key: "templateBirthdayGreeting", label: "생일 축하", placeholder: "birthday_greeting" },
    ],
  },
];

const appFieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: keyof AppAlimtalkConfig; label: string }>;
}> = [
  {
    title: "앱 서버 연결값",
    description: "Vercel 서버가 현재 읽고 있는 환경변수입니다. 이 영역은 확인용이며 저장 버튼으로 바뀌지 않습니다.",
    fields: [
      { key: "provider", label: "Provider" },
      { key: "relayUrl", label: "Relay URL" },
      { key: "relaySecret", label: "Relay Secret" },
      { key: "apiUrl", label: "API URL" },
      { key: "apiKey", label: "API Key" },
      { key: "tokenKey", label: "Token Key" },
      { key: "senderKey", label: "Sender Key" },
    ],
  },
  {
    title: "앱 서버 템플릿 코드",
    description: "앱 서버 환경변수에 직접 들어있는 템플릿 코드입니다. 현재 구조에서는 릴레이 매핑이 우선 운영 기준입니다.",
    fields: [
      { key: "templateBookingReceived", label: "예약 접수" },
      { key: "templateBookingConfirmed", label: "예약 확정" },
      { key: "templateBookingRejected", label: "예약 거절" },
      { key: "templateBookingCancelled", label: "예약 취소" },
      { key: "templateBookingRescheduledConfirmed", label: "예약 변경 확정" },
      { key: "templateAppointmentReminder10m", label: "방문 전 알림" },
      { key: "templateGroomingStarted", label: "미용 시작" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비" },
      { key: "templateGroomingCompleted", label: "미용 완료 사진" },
      { key: "templateRevisitNotice", label: "재방문 안내" },
      { key: "templateBirthdayGreeting", label: "생일 축하" },
    ],
  },
];

type AdminAlimtalkCreditBalance = {
  shopId: string;
  shopName: string;
  includedTotal: number;
  includedUsed: number;
  includedRemaining: number;
  includedPeriodStartedAt: string | null;
  includedPeriodEndsAt: string | null;
  purchasedTotal: number;
  purchasedUsed: number;
  purchasedRemaining: number;
  remainingTotal: number;
  updatedAt: string;
};

type AdminAlimtalkCreditBalancesResponse = {
  ok: boolean;
  balances: AdminAlimtalkCreditBalance[];
};

type AdminAlimtalkCreditGrantResponse = {
  ok: boolean;
  remainingCount: number | null;
  eventId: string | null;
};

const ssodaaStatusLabels: Record<string, string> = {
  REG: "등록",
  REQ: "검수 요청",
  REJ: "반려",
  STP: "차단",
  RDY: "발송 전",
  ACT: "정상",
  DMT: "휴면",
  BLK: "차단",
};

function formatSsodaaStatus(value: string | null | undefined) {
  if (!value) return "-";
  return ssodaaStatusLabels[value] ? `${ssodaaStatusLabels[value]} (${value})` : value;
}

function TextField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[14px] font-semibold text-[#6f665f]">{label}</span>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`w-full rounded-[6px] border px-4 py-3 font-mono text-[14px] leading-5 outline-none ${
          readOnly
            ? "border-[#e6e3dd] bg-white text-[#6f665f]"
            : "border-[#d8d4ce] bg-white text-[#171411] focus:border-[#1f6b5b]"
        }`}
      />
      {help ? <span className="block text-[11px] leading-4 text-[#8a8277]">{help}</span> : null}
    </label>
  );
}

function AdminCollapsibleSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[8px] border border-[#e6e3dd] bg-white shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">{eyebrow}</p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">{title}</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#6f665f]">{description}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#7a7268] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-[#e6e3dd] p-6">{children}</div> : null}
    </section>
  );
}

function CreditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#ece8e2] bg-[#fbfaf8] px-4 py-3">
      <p className="text-[13px] font-semibold text-[#8a8277]">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-[#171411]">{value}</p>
    </div>
  );
}

export default function AdminAlimtalkScreen({
  sessionLoginId,
  appConfig,
  appTemplateDrafts,
  notificationActivity,
}: {
  sessionLoginId: string;
  appConfig: AppAlimtalkConfig;
  appTemplateDrafts: AppTemplateDraft[];
  notificationActivity: AdminNotificationActivity;
}) {
  const [relayConfig, setRelayConfig] = useState<RelayAdminConfig | null>(null);
  const [relayTemplateItems, setRelayTemplateItems] = useState<RelaySsodaaTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [creditBalances, setCreditBalances] = useState<AdminAlimtalkCreditBalance[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [grantingCredits, setGrantingCredits] = useState(false);
  const [creditShopId, setCreditShopId] = useState("");
  const [creditAmount, setCreditAmount] = useState("100");
  const [creditBucket, setCreditBucket] = useState<"included" | "purchased">("purchased");
  const [creditReason, setCreditReason] = useState("admin_manual_grant");

  async function loadRelayConfig() {
    setLoading(true);
    try {
      const response = await fetchApiJson<RelayAdminConfigResponse>("/api/admin/alimtalk/relay", {
        cache: "no-store",
      });
      setRelayConfig(response.config);
      setError(null);
      setMessage(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "릴레이 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRelayTemplates() {
    setLoadingTemplates(true);
    try {
      const response = await fetchApiJson<RelayTemplateCatalogResponse>("/api/admin/alimtalk/relay/templates", {
        cache: "no-store",
      });
      setRelayTemplateItems(response.items);
      setTemplateError(null);
    } catch (nextError) {
      setTemplateError(nextError instanceof Error ? nextError.message : "쏘다 템플릿 상세를 불러오지 못했습니다.");
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadCreditBalances() {
    setLoadingCredits(true);
    try {
      const response = await fetchApiJson<AdminAlimtalkCreditBalancesResponse>("/api/admin/alimtalk/credits", {
        cache: "no-store",
      });
      setCreditBalances(response.balances);
      setCreditShopId((current) => current || response.balances[0]?.shopId || "");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "알림톡 건수 정보를 불러오지 못했습니다.");
    } finally {
      setLoadingCredits(false);
    }
  }

  useEffect(() => {
    void loadRelayConfig();
    void loadRelayTemplates();
    void loadCreditBalances();
  }, []);

  const hasRelayConfig = Boolean(relayConfig);
  const selectedCreditBalance = useMemo(
    () => creditBalances.find((item) => item.shopId === creditShopId) ?? null,
    [creditBalances, creditShopId],
  );
  const dirtyCount = useMemo(() => {
    if (!relayConfig) return 0;
    return Object.values(relayConfig).filter((value) => value.trim().length > 0).length;
  }, [relayConfig]);

  async function handleSave() {
    if (!relayConfig) return;

    setSaving(true);
    try {
      const response = await fetchApiJson<RelayAdminConfigResponse>("/api/admin/alimtalk/relay", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(relayConfig),
      });
      setRelayConfig(response.config);
      void loadRelayTemplates();
      setMessage("릴레이 서버 설정을 저장했습니다. 다음 발송부터 새 설정이 적용됩니다.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "릴레이 설정 저장에 실패했습니다.");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof RelayAdminConfig, value: string) {
    setRelayConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleGrantCredits() {
    const amount = Number(creditAmount);
    if (!creditShopId) {
      setError("알림톡 건수를 증정할 매장을 선택해 주세요.");
      setMessage(null);
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("증정 건수는 1 이상의 정수로 입력해 주세요.");
      setMessage(null);
      return;
    }

    setGrantingCredits(true);
    try {
      const selectedShop = creditBalances.find((item) => item.shopId === creditShopId);
      const response = await fetchApiJson<AdminAlimtalkCreditGrantResponse>("/api/admin/alimtalk/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "grant",
          shopId: creditShopId,
          amount,
          creditBucket,
          reason: creditReason.trim() || "admin_manual_grant",
        }),
      });
      await loadCreditBalances();
      setMessage(`${selectedShop?.shopName || creditShopId}에 알림톡 ${amount.toLocaleString("ko-KR")}건을 증정했습니다. 남은 건수: ${response.remainingCount?.toLocaleString("ko-KR") ?? "-"}건`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "알림톡 건수 증정에 실패했습니다.");
      setMessage(null);
    } finally {
      setGrantingCredits(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-[#171411] md:px-8 md:py-7">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <section className="rounded-[8px] border border-[#e6e3dd] bg-white px-6 py-5 shadow-[0_6px_16px_rgba(23,20,17,0.025)] md:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 justify-self-start text-[14px] font-semibold text-[#7a7268]">
              <ArrowLeft className="h-4 w-4" />
              관리자 홈으로
            </Link>
            <h1 className="text-center text-[30px] font-bold tracking-[-0.04em] text-[#171411]">알림톡 설정</h1>
            <div aria-hidden="true" />
          </div>

          {message ? (
            <p className="mt-5 rounded-[6px] border border-[#cfe3dc] bg-white px-4 py-3 text-[14px] leading-6 text-[#1f6b5b]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] leading-6 text-[#b54b4b]">
              {error}
            </p>
          ) : null}
        </section>

        <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">크레딧 증정</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">오너 알림톡 건수 수동 증정</h2>
              <p className="mt-3 max-w-[720px] text-[14px] leading-6 text-[#6f665f]">
                알림톡은 매장 단위로 차감됩니다. 여기에서 증정한 건수는 선택한 매장의 내부 크레딧 잔액에 바로 반영됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCreditBalances()}
              disabled={loadingCredits || grantingCredits}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[14px] font-semibold text-[#5c554d] disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              잔액 새로고침
            </button>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-[6px] border border-[#e6e3dd] bg-[#fbfaf8] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[14px] font-semibold text-[#6f665f]">매장 선택</span>
                  <select
                    value={creditShopId}
                    onChange={(event) => setCreditShopId(event.target.value)}
                    disabled={loadingCredits || grantingCredits || creditBalances.length === 0}
                    className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b] disabled:opacity-60"
                  >
                    {creditBalances.length === 0 ? <option value="">매장이 없습니다</option> : null}
                    {creditBalances.map((balance) => (
                      <option key={balance.shopId} value={balance.shopId}>
                        {balance.shopName} · 잔여 {balance.remainingTotal.toLocaleString("ko-KR")}건
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-[14px] font-semibold text-[#6f665f]">증정 건수</span>
                  <input
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="예: 100"
                    className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[14px] font-semibold text-[#6f665f]">크레딧 구분</span>
                  <select
                    value={creditBucket}
                    onChange={(event) => setCreditBucket(event.target.value === "included" ? "included" : "purchased")}
                    className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                  >
                    <option value="purchased">추가 증정 크레딧</option>
                    <option value="included">플랜 포함 크레딧</option>
                  </select>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[14px] font-semibold text-[#6f665f]">사유</span>
                  <input
                    value={creditReason}
                    onChange={(event) => setCreditReason(event.target.value)}
                    placeholder="예: admin_manual_grant"
                    className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleGrantCredits()}
                disabled={loadingCredits || grantingCredits || !creditShopId}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[6px] bg-[#1f6b5b] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {grantingCredits ? "증정 중..." : "알림톡 건수 증정"}
              </button>
            </div>

            <div className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#8a8277]">현재 선택 매장</p>
                  <h3 className="mt-1 text-[20px] font-semibold text-[#171411]">{selectedCreditBalance?.shopName || "매장을 선택해 주세요"}</h3>
                </div>
                <div className="rounded-[6px] border border-[#d8d4ce] bg-white px-3 py-2 text-right">
                  <p className="text-[13px] text-[#8a8277]">총 잔여</p>
                  <p className="mt-0.5 text-[20px] font-semibold text-[#1f6b5b]">{(selectedCreditBalance?.remainingTotal ?? 0).toLocaleString("ko-KR")}건</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <CreditStat label="플랜 포함 잔여" value={`${(selectedCreditBalance?.includedRemaining ?? 0).toLocaleString("ko-KR")}건`} />
                <CreditStat label="추가 증정 잔여" value={`${(selectedCreditBalance?.purchasedRemaining ?? 0).toLocaleString("ko-KR")}건`} />
                <CreditStat label="플랜 포함 총량" value={`${(selectedCreditBalance?.includedTotal ?? 0).toLocaleString("ko-KR")}건`} />
                <CreditStat label="추가 증정 총량" value={`${(selectedCreditBalance?.purchasedTotal ?? 0).toLocaleString("ko-KR")}건`} />
              </div>
              <div className="mt-4 max-h-[220px] overflow-auto rounded-[6px] border border-[#ece8e2]">
                {loadingCredits ? (
                  <p className="px-4 py-5 text-[14px] text-[#7a7268]">잔액을 불러오는 중입니다.</p>
                ) : (
                  <table className="w-full min-w-[560px] text-left text-[14px]">
                    <thead className="bg-[#fbfaf8] text-[#7a7268]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">매장</th>
                        <th className="px-3 py-2 font-semibold">총 잔여</th>
                        <th className="px-3 py-2 font-semibold">포함</th>
                        <th className="px-3 py-2 font-semibold">추가</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece8e2]">
                      {creditBalances.map((balance) => (
                        <tr key={balance.shopId} className={balance.shopId === creditShopId ? "bg-[#f0f7f4]" : "bg-white"}>
                          <td className="px-3 py-2 text-[#171411]">{balance.shopName}</td>
                          <td className="px-3 py-2 text-[#1f6b5b]">{balance.remainingTotal.toLocaleString("ko-KR")}건</td>
                          <td className="px-3 py-2 text-[#6f665f]">{balance.includedRemaining.toLocaleString("ko-KR")}건</td>
                          <td className="px-3 py-2 text-[#6f665f]">{balance.purchasedRemaining.toLocaleString("ko-KR")}건</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>

        <AdminAlimtalkTemplateRegistrationPanel onRegistered={() => void loadRelayTemplates()} />

        <AdminCollapsibleSection
          eyebrow="연결 설정"
          title="연결값 / 템플릿 코드 수정"
          description="초기 세팅이 끝난 뒤에는 평소에 열지 않아도 됩니다. 잘못 수정하면 알림톡 발송이 끊길 수 있습니다."
        >
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">릴레이 서버</p>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">연결 원본값 / 매핑</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadRelayConfig()}
                    disabled={loading || saving}
                    className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[14px] font-semibold text-[#5c554d] disabled:opacity-60"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    새로고침
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!hasRelayConfig || loading || saving}
                    className="inline-flex h-11 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    저장
                  </button>
                </div>
              </div>

              <p className="mt-3 text-[14px] leading-6 text-[#6f665f]">
                Relay Secret은 앱 서버의 <span className="font-semibold text-[#171411]">ALIMTALK_RELAY_SECRET</span>과 같아야 합니다.
                템플릿 코드는 쏘다/카카오에서 승인된 코드만 넣어야 실제 발송됩니다.
              </p>

              {loading ? (
                <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[16px] text-[#7a7268]">
                  릴레이 설정을 불러오는 중입니다.
                </div>
              ) : relayConfig ? (
                <div className="mt-5 space-y-5">
                  {relayFieldGroups.map((group) => (
                    <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                      <div className="space-y-1">
                        <h4 className="text-[16px] font-semibold text-[#171411]">{group.title}</h4>
                        <p className="text-[14px] leading-5 text-[#7a7268]">{group.description}</p>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {group.fields.map((field) => (
                          <TextField
                            key={field.key}
                            label={field.label}
                            value={relayConfig[field.key]}
                            onChange={(value) => updateField(field.key, value)}
                            placeholder={field.placeholder}
                            help={field.help}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  <p className="text-[14px] leading-5 text-[#8a8277]">
                    현재 릴레이 설정 입력칸 {dirtyCount}개가 채워져 있습니다.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[#e6e3dd] bg-white text-[#52667d]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">앱 서버(Vercel)</p>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">현재 읽히는 환경변수</h3>
                  <p className="mt-3 text-[14px] leading-6 text-[#6f665f]">
                    이 영역은 현재 Vercel 서버가 읽고 있는 값을 보여주는 확인용입니다.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {appFieldGroups.map((group) => (
                  <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                    <div className="space-y-1">
                      <h4 className="text-[16px] font-semibold text-[#171411]">{group.title}</h4>
                      <p className="text-[14px] leading-5 text-[#7a7268]">{group.description}</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {group.fields.map((field) => (
                        <TextField key={field.key} label={field.label} value={appConfig[field.key]} readOnly />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        </AdminCollapsibleSection>

        <AdminCollapsibleSection
          eyebrow="진단 / 테스트"
          title="릴레이 상태와 즉시 발송 테스트"
          description="문제가 생겼을 때만 열어 릴레이 상태와 템플릿 테스트 발송을 확인합니다."
        >
          <AdminAlimtalkRuntimePanel appTemplateDrafts={appTemplateDrafts} />
        </AdminCollapsibleSection>

        <AdminCollapsibleSection
          eyebrow="운영 이력"
          title="알림톡 발송 활동"
          description="실제 발송 이력이나 실패 원인을 확인할 때만 열어봅니다."
        >
          <AdminAlimtalkActivitySections notificationActivity={notificationActivity} />
        </AdminCollapsibleSection>

        <AdminCollapsibleSection
          eyebrow="템플릿 비교"
          title="쏘다 등록 내용과 현재 코드 본문"
          description="승인된 템플릿과 앱 코드 초안이 맞는지 검수할 때만 확인합니다."
        >
        <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">템플릿 비교</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">쏘다 등록 내용과 현재 코드 본문</h2>
              <p className="mt-3 text-[14px] leading-6 text-[#6f665f]">
                릴레이에 연결된 코드, 쏘다에 실제 등록된 템플릿 상태, 앱 코드의 초안 본문을 비교합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRelayTemplates()}
              disabled={loadingTemplates}
              className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[14px] font-semibold text-[#5c554d] disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              새로고침
            </button>
          </div>

          {templateError ? (
            <p className="mt-5 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] leading-6 text-[#b54b4b]">
              {templateError}
            </p>
          ) : null}

          {loadingTemplates ? (
            <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[16px] text-[#7a7268]">
              쏘다 템플릿 상세를 불러오는 중입니다.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {appTemplateDrafts.map((draft) => {
                const relayItem = relayTemplateItems.find((item) => item.alias === draft.alias) ?? null;
                return (
                  <article key={draft.alias} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">{draft.alias}</p>
                        <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#171411]">{draft.title}</h3>
                      </div>
                      <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-3 py-2 text-[14px] text-[#6f665f]">
                        <p>
                          릴레이 코드:{" "}
                          <span className="text-[#171411]">{relayItem?.configuredCode || "-"}</span>
                        </p>
                        <p className="mt-1">
                          쏘다 상태:{" "}
                          <span className="text-[#171411]">
                            {relayItem?.detail?.inspectionStatus || relayItem?.detail?.serviceStatus
                              ? formatSsodaaStatus(relayItem.detail.inspectionStatus || relayItem.detail.serviceStatus)
                              : relayItem?.error || "-"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">앱 코드 초안 본문</p>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[14px] leading-6 text-[#171411]">
                          {draft.body}
                        </pre>
                      </section>
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">쏘다 등록 템플릿</p>
                        <div className="mt-3 space-y-2 text-[14px] leading-6 text-[#6f665f]">
                          <p>
                            템플릿 코드:{" "}
                            <span className="text-[#171411]">
                              {relayItem?.detail?.templateCode || relayItem?.configuredCode || "-"}
                            </span>
                          </p>
                          <p>
                            템플릿 이름:{" "}
                            <span className="text-[#171411]">{relayItem?.detail?.templateName || "-"}</span>
                          </p>
                          <p>
                            검수 상태:{" "}
                            <span className="text-[#171411]">{formatSsodaaStatus(relayItem?.detail?.inspectionStatus)}</span>
                          </p>
                          <p>
                            서비스 상태:{" "}
                            <span className="text-[#171411]">{formatSsodaaStatus(relayItem?.detail?.serviceStatus)}</span>
                          </p>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[14px] leading-6 text-[#171411]">
                          {relayItem?.detail?.templateContent || relayItem?.error || "쏘다 등록 본문을 아직 불러오지 못했습니다."}
                        </pre>
                        <div className="mt-3 rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4">
                          <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">등록 버튼</p>
                          {relayItem?.detail?.buttons?.length ? (
                            <div className="mt-3 space-y-3">
                              {relayItem.detail.buttons.map((button, index) => (
                                <div
                                  key={`${button.name ?? "button"}-${index}`}
                                  className="rounded-[6px] border border-[#ece8e2] bg-[#fbfaf8] px-3 py-3 text-[14px] leading-6 text-[#6f665f]"
                                >
                                  <p>
                                    버튼명: <span className="text-[#171411]">{button.name || "-"}</span>
                                    <span className="ml-3 text-[#8a8277]">유형 {button.type || "-"}</span>
                                  </p>
                                  <p className="break-all">
                                    모바일 URL: <span className="text-[#171411]">{button.linkMobile || "-"}</span>
                                  </p>
                                  <p className="break-all">
                                    PC URL: <span className="text-[#171411]">{button.linkPc || button.linkMobile || "-"}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-[14px] leading-6 text-[#8a8277]">쏘다 등록 버튼 정보를 아직 불러오지 못했습니다.</p>
                          )}
                        </div>
                        {relayItem?.detail?.rawKeys?.length ? (
                          <p className="mt-2 text-[12px] leading-5 text-[#9b938a]">
                            쏘다 응답 필드: {relayItem.detail.rawKeys.slice(0, 18).join(", ")}
                          </p>
                        ) : null}
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </AdminCollapsibleSection>
      </div>
    </main>
  );
}
