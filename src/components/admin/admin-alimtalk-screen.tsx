"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, Save, ServerCog, ShieldCheck } from "lucide-react";
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
      { key: "templateAppointmentReminder10m", label: "방문 10분 전", placeholder: "appointment_reminder_10m" },
      { key: "templateGroomingStarted", label: "미용 시작", placeholder: "grooming_started" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비", placeholder: "grooming_almost_done" },
      { key: "templateGroomingCompleted", label: "미용 완료/전후 사진", placeholder: "grooming_completed_photo" },
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
      { key: "templateAppointmentReminder10m", label: "방문 10분 전" },
      { key: "templateGroomingStarted", label: "미용 시작" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비" },
      { key: "templateGroomingCompleted", label: "미용 완료/전후 사진" },
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
      {help ? <span className="block text-[11px] leading-4 text-[#8a8277]">{help}</span> : null}
    </label>
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
                  <p className="text-[13px] font-semibold tracking-[0.04em] text-[#1f6b5b]">내부 운영 도구</p>
                  <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#171411]">알림톡 서버 설정</h1>
                  <p className="max-w-[760px] text-[14px] leading-6 text-[#6f665f]">
                    쏘다 연결값, 릴레이 템플릿 코드, 실시간 진단, 템플릿 등록/검수 요청을 한 화면에서 관리합니다.
                    전후 사진 알림톡은 아래 템플릿 등록 영역에서 쏘다 검수 요청까지 진행합니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-4">
              <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 관리자</p>
              <p className="mt-2 text-[18px] font-semibold text-[#171411]">{sessionLoginId}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#6f665f]">릴레이 설정 저장 시 서버 메모리와 설정 파일에 반영됩니다.</p>
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

        <section className="rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-6">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#52667d]">어디서 어떻게 하나요</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">전후 사진 알림톡 템플릿 승인 요청 순서</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["1", "릴레이 상태 확인", "실시간 릴레이 진단에서 /health가 200인지 확인합니다."],
              ["2", "템플릿 작성", "전후 사진 알림톡 템플릿 만들기 영역에서 문구와 카테고리를 확인합니다."],
              ["3", "등록/검수 요청", "코드 검증 후 템플릿 등록/검수 요청 버튼을 누릅니다."],
              ["4", "승인 후 발송", "쏘다/카카오 승인 완료 후 오너 화면에서 전후 사진 알림톡을 보냅니다."],
            ].map(([step, title, description]) => (
              <div key={step} className="rounded-[6px] border border-[#dbe2ea] bg-white p-4">
                <p className="text-[12px] font-semibold text-[#1f6b5b]">STEP {step}</p>
                <p className="mt-2 text-[15px] font-semibold text-[#111827]">{title}</p>
                <p className="mt-2 text-[12px] leading-5 text-[#64748b]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">릴레이 서버</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">연결값 / 템플릿 코드 수정</h2>
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
              Relay Secret은 앱 서버의 <span className="font-semibold text-[#171411]">ALIMTALK_RELAY_SECRET</span>과 같아야 합니다.
              템플릿 코드는 쏘다/카카오에서 승인된 코드만 넣어야 실제 발송됩니다.
            </p>

            {loading ? (
              <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[14px] text-[#7a7268]">
                릴레이 설정을 불러오는 중입니다.
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
                          help={field.help}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <p className="text-[12px] leading-5 text-[#8a8277]">
                  현재 릴레이 설정 입력칸 {dirtyCount}개가 채워져 있습니다.
                </p>
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
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">현재 읽히는 환경변수</h2>
                <p className="mt-3 text-[13px] leading-6 text-[#6f665f]">
                  이 영역은 현재 Vercel 서버가 읽고 있는 값을 보여주는 확인용입니다. 값을 바꾸려면 Vercel 환경변수나 릴레이 설정을 수정해야 합니다.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {appFieldGroups.map((group) => (
                <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                  <div className="space-y-1">
                    <h3 className="text-[15px] font-semibold text-[#171411]">{group.title}</h3>
                    <p className="text-[12px] leading-5 text-[#7a7268]">{group.description}</p>
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

        <AdminAlimtalkRuntimePanel appTemplateDrafts={appTemplateDrafts} />

        <AdminAlimtalkActivitySections notificationActivity={notificationActivity} />

        <AdminAlimtalkTemplateRegistrationPanel onRegistered={() => void loadRelayTemplates()} />

        <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">템플릿 비교</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">쏘다 등록 내용과 현재 코드 본문</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#6f665f]">
                릴레이에 연결된 코드, 쏘다에 실제 등록된 템플릿 상태, 앱 코드의 초안 본문을 비교합니다.
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
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">{draft.alias}</p>
                        <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#171411]">{draft.title}</h3>
                      </div>
                      <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-3 py-2 text-[12px] text-[#6f665f]">
                        <p>
                          릴레이 코드:{" "}
                          <span className="font-semibold text-[#171411]">{relayItem?.configuredCode || "-"}</span>
                        </p>
                        <p className="mt-1">
                          쏘다 상태:{" "}
                          <span className="font-semibold text-[#171411]">
                            {relayItem?.detail?.inspectionStatus || relayItem?.detail?.serviceStatus || relayItem?.error || "-"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">앱 코드 초안 본문</p>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[13px] leading-6 text-[#171411]">
                          {draft.body}
                        </pre>
                      </section>
                      <section className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">쏘다 등록 템플릿</p>
                        <div className="mt-3 space-y-2 text-[13px] leading-6 text-[#6f665f]">
                          <p>
                            템플릿 코드:{" "}
                            <span className="font-semibold text-[#171411]">
                              {relayItem?.detail?.templateCode || relayItem?.configuredCode || "-"}
                            </span>
                          </p>
                          <p>
                            템플릿 이름:{" "}
                            <span className="font-semibold text-[#171411]">{relayItem?.detail?.templateName || "-"}</span>
                          </p>
                          <p>
                            검수 상태:{" "}
                            <span className="font-semibold text-[#171411]">{relayItem?.detail?.inspectionStatus || "-"}</span>
                          </p>
                          <p>
                            서비스 상태:{" "}
                            <span className="font-semibold text-[#171411]">{relayItem?.detail?.serviceStatus || "-"}</span>
                          </p>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[13px] leading-6 text-[#171411]">
                          {relayItem?.detail?.templateContent || relayItem?.error || "쏘다 등록 본문을 아직 불러오지 못했습니다."}
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
