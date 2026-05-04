"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, Save, ServerCog, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import type {
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
  fields: Array<{ key: keyof RelayAdminConfig; label: string; placeholder?: string }>;
}> = [
  {
    title: "연결 키",
    description: "relay 서버에서 실제 쏘다 발송과 관리자 인증에 쓰는 값입니다.",
    fields: [
      { key: "relaySecret", label: "Relay 시크릿" },
      { key: "ssodaaApiUrl", label: "쏘다 발송 URL" },
      { key: "ssodaaSentListUrl", label: "쏘다 발송 조회 URL" },
      { key: "ssodaaApiKey", label: "쏘다 API Key" },
      { key: "ssodaaTokenKey", label: "쏘다 Token Key" },
      { key: "ssodaaSenderKey", label: "쏘다 Sender Key" },
    ],
  },
  {
    title: "템플릿 코드",
    description: "새 템플릿을 추가할 때는 여기만 바꾸면 relay 기준 매핑이 바뀝니다.",
    fields: [
      { key: "templateBookingReceived", label: "예약 접수", placeholder: "booking_received" },
      { key: "templateBookingConfirmed", label: "예약 확정", placeholder: "booking_confirmed" },
      { key: "templateBookingRejected", label: "예약 거절", placeholder: "booking_rejected" },
      { key: "templateBookingCancelled", label: "예약 취소", placeholder: "booking_cancelled" },
      { key: "templateBookingRescheduledConfirmed", label: "예약 변경 확정", placeholder: "booking_rescheduled_confirmed" },
      { key: "templateAppointmentReminder10m", label: "방문 10분 전", placeholder: "appointment_reminder_10m" },
      { key: "templateGroomingStarted", label: "미용 시작", placeholder: "grooming_started" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비", placeholder: "grooming_almost_done" },
      { key: "templateGroomingCompleted", label: "미용 완료", placeholder: "grooming_completed" },
      { key: "templateRevisitNotice", label: "재방문 안내", placeholder: "revisit_notice" },
      { key: "templateBirthdayGreeting", label: "생일 축하", placeholder: "birthday_greeting" },
    ],
  },
];

const appFieldGroups: Array<{
  title: string;
  fields: Array<{ key: keyof AppAlimtalkConfig; label: string }>;
}> = [
  {
    title: "앱 서버 연결",
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
    title: "앱 서버 템플릿",
    fields: [
      { key: "templateBookingReceived", label: "예약 접수" },
      { key: "templateBookingConfirmed", label: "예약 확정" },
      { key: "templateBookingRejected", label: "예약 거절" },
      { key: "templateBookingCancelled", label: "예약 취소" },
      { key: "templateBookingRescheduledConfirmed", label: "예약 변경 확정" },
      { key: "templateAppointmentReminder10m", label: "방문 10분 전" },
      { key: "templateGroomingStarted", label: "미용 시작" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비" },
      { key: "templateGroomingCompleted", label: "미용 완료" },
      { key: "templateRevisitNotice", label: "재방문 안내" },
      { key: "templateBirthdayGreeting", label: "생일 축하" },
    ],
  },
];

function TextField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-semibold text-[#6f665f]">{label}</span>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`w-full rounded-[6px] border px-4 py-3 font-mono text-[12px] leading-5 outline-none ${
          readOnly
            ? "border-[#e6e3dd] bg-white text-[#6f665f]"
            : "border-[#d8d4ce] bg-white text-[#171411] focus:border-[#1f6b5b]"
        }`}
      />
    </label>
  );
}

export default function AdminAlimtalkScreen({
  sessionLoginId,
  appConfig,
  appTemplateDrafts,
}: {
  sessionLoginId: string;
  appConfig: AppAlimtalkConfig;
  appTemplateDrafts: AppTemplateDraft[];
}) {
  const [relayConfig, setRelayConfig] = useState<RelayAdminConfig | null>(null);
  const [relayTemplateItems, setRelayTemplateItems] = useState<RelaySsodaaTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

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
      setError(nextError instanceof Error ? nextError.message : "relay 설정을 불러오지 못했습니다.");
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

  useEffect(() => {
    void loadRelayConfig();
    void loadRelayTemplates();
  }, []);

  const hasRelayConfig = Boolean(relayConfig);
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
      setMessage("relay 서버 설정을 저장했습니다. 바로 다음 발송부터 새 값이 적용돼요.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "relay 설정 저장에 실패했습니다.");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof RelayAdminConfig, value: string) {
    setRelayConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-[#171411] md:px-8 md:py-7">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <section className="rounded-[8px] border border-[#e6e3dd] bg-white px-6 py-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)] md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Link href="/admin" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#7a7268]">
                <ArrowLeft className="h-4 w-4" />
                관리자 홈으로
              </Link>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[8px] border border-[#e6e3dd] bg-white text-[#1f6b5b]">
                  <ServerCog className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold tracking-[0.04em] text-[#1f6b5b]">내부 전용</p>
                  <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#171411]">알림톡 서버 설정</h1>
                  <p className="max-w-[760px] text-[14px] leading-6 text-[#6f665f]">
                    여기서는 relay 서버에 올라간 쏘다 키와 템플릿 코드를 원본 그대로 확인하고 수정할 수 있어요. 앱 서버(Vercel) 값은
                    참고용으로 raw 조회만 가능하고, 실제 저장은 relay 서버에 반영됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-4">
              <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 관리자</p>
              <p className="mt-2 text-[18px] font-semibold text-[#171411]">{sessionLoginId}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#6f665f]">relay raw 값 저장 시 바로 서버 메모리에 반영됩니다.</p>
            </div>
          </div>

          {message ? (
            <p className="mt-5 rounded-[6px] border border-[#cfe3dc] bg-white px-4 py-3 text-[13px] leading-6 text-[#1f6b5b]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
              {error}
            </p>
          ) : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">relay 서버</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">원본 키 / 템플릿 수정</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadRelayConfig()}
                  disabled={loading || saving}
                  className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!hasRelayConfig || loading || saving}
                  className="inline-flex h-11 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  저장
                </button>
              </div>
            </div>

            <p className="mt-3 text-[13px] leading-6 text-[#6f665f]">
              relay 시크릿을 바꾸면 Vercel의 <span className="font-semibold text-[#171411]">ALIMTALK_RELAY_SECRET</span>도 같이 바꿔야
              알림톡이 계속 나갑니다.
            </p>

            {loading ? (
              <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[14px] text-[#7a7268]">
                relay 설정을 불러오는 중이에요.
              </div>
            ) : relayConfig ? (
              <div className="mt-5 space-y-5">
                {relayFieldGroups.map((group) => (
                  <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                    <div className="space-y-1">
                      <h3 className="text-[15px] font-semibold text-[#171411]">{group.title}</h3>
                      <p className="text-[12px] leading-5 text-[#7a7268]">{group.description}</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {group.fields.map((field) => (
                        <TextField
                          key={field.key}
                          label={field.label}
                          value={relayConfig[field.key]}
                          onChange={(value) => updateField(field.key, value)}
                          placeholder={field.placeholder}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <p className="text-[12px] leading-5 text-[#8a8277]">현재 relay 설정 입력 칸 {dirtyCount}개가 채워져 있습니다.</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[#e6e3dd] bg-white text-[#52667d]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">앱 서버(Vercel)</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">현재 읽히는 raw 값</h2>
                <p className="mt-3 text-[13px] leading-6 text-[#6f665f]">
                  이 영역은 현재 앱 서버가 읽고 있는 값을 그대로 보여주는 읽기 전용 참고 화면입니다. 여기 값은 Vercel 환경변수를 직접 바꿔야
                  변경됩니다.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {appFieldGroups.map((group) => (
                <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                  <h3 className="text-[15px] font-semibold text-[#171411]">{group.title}</h3>
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

        <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">템플릿 비교</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">쏘다 등록 내용과 현재 코드 본문</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#6f665f]">
                릴레이 서버에 저장된 코드와 쏘다에 실제 등록된 템플릿 상세, 그리고 현재 앱 코드가 만드는 본문 초안을 한 화면에서 비교합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRelayTemplates()}
              disabled={loadingTemplates}
              className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              새로고침
            </button>
          </div>

          {templateError ? (
            <p className="mt-5 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
              {templateError}
            </p>
          ) : null}

          {loadingTemplates ? (
            <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[14px] text-[#7a7268]">
              쏘다 템플릿 상세를 불러오는 중이에요.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {appTemplateDrafts.map((draft) => {
                const relayItem = relayTemplateItems.find((item) => item.alias === draft.alias) ?? null;
                return (
                  <article key={draft.alias} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">{draft.alias}</p>
                        <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#171411]">{draft.title}</h3>
                      </div>
                      <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-3 py-2 text-[12px] text-[#6f665f]">
                        <p>relay 코드: <span className="font-semibold text-[#171411]">{relayItem?.configuredCode || "-"}</span></p>
                        <p className="mt-1">쏘다 상태: <span className="font-semibold text-[#171411]">{relayItem?.detail?.inspectionStatus || relayItem?.detail?.serviceStatus || relayItem?.error || "-"}</span></p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 앱 코드 본문</p>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[13px] leading-6 text-[#171411]">
                          {draft.body}
                        </pre>
                      </section>
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">쏘다 등록 템플릿</p>
                        <div className="mt-3 space-y-2 text-[13px] leading-6 text-[#6f665f]">
                          <p>템플릿 코드: <span className="font-semibold text-[#171411]">{relayItem?.detail?.templateCode || relayItem?.configuredCode || "-"}</span></p>
                          <p>템플릿 이름: <span className="font-semibold text-[#171411]">{relayItem?.detail?.templateName || "-"}</span></p>
                          <p>검수 상태: <span className="font-semibold text-[#171411]">{relayItem?.detail?.inspectionStatus || "-"}</span></p>
                          <p>서비스 상태: <span className="font-semibold text-[#171411]">{relayItem?.detail?.serviceStatus || "-"}</span></p>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[13px] leading-6 text-[#171411]">
                          {relayItem?.detail?.templateContent || relayItem?.error || "쏘다 등록 본문을 아직 불러오지 못했어요."}
                        </pre>
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
