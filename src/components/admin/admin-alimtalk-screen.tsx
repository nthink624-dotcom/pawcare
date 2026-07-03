"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import AdminAlimtalkActivitySections from "@/components/admin/admin-alimtalk-activity-sections";
import AdminAlimtalkRuntimePanel from "@/components/admin/admin-alimtalk-runtime-panel";
import AdminAlimtalkTemplateComparisonPanel from "@/components/admin/admin-alimtalk-template-comparison-panel";
import { fetchApiJson } from "@/lib/api";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias, type AlimtalkTemplateConfigKey } from "@/lib/notification-registry";
import type {
  AdminNotificationActivity,
  AppAlimtalkConfig,
  AppTemplateDraft,
  RelayAdminConfig,
  RelayAdminConfigResponse,
  RelaySsodaaTemplateDetail,
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
];

const appRuntimeFieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: keyof AppAlimtalkConfig; label: string; sensitive?: boolean }>;
}> = [
  {
    title: "현재 발송 서버 설정",
    description: "PetManager 서버가 실제 발송 시 읽는 값입니다. 확인용이라 이 화면에서 직접 수정하지 않습니다.",
    fields: [
      { key: "provider", label: "발송 방식" },
      { key: "relayUrl", label: "릴레이 발송 주소" },
      { key: "relaySecret", label: "릴레이 인증값", sensitive: true },
      { key: "apiUrl", label: "쏘다 API 주소" },
      { key: "apiKey", label: "쏘다 API Key", sensitive: true },
      { key: "tokenKey", label: "쏘다 Token Key", sensitive: true },
      { key: "senderKey", label: "쏘다 Sender Key", sensitive: true },
    ],
  },
];

const appTemplateCodeFieldGroups: Array<{
  fields: Array<{ key: AlimtalkTemplateConfigKey; label: string }>;
}> = [
  {
    fields: [
      { key: "templateBookingConfirmed", label: "예약 확정" },
      { key: "templateBookingCancelled", label: "예약 취소" },
      { key: "templateBookingRescheduledConfirmed", label: "예약 변경 확정" },
      { key: "templateVisitScheduleNotice", label: "예약 안내 - 내일" },
      { key: "templateVisitReminderNotice", label: "예약 안내 - 오늘" },
      { key: "templateAppointmentReminder10m", label: "예약 안내 - 직전" },
      { key: "templateGroomingStarted", label: "미용 시작" },
      { key: "templateGroomingAlmostDone", label: "픽업 준비" },
      { key: "templateGroomingCompleted", label: "미용 완료 사진" },
      { key: "templateRevisitNotice", label: "재방문 안내" },
      { key: "templateBirthdayGreeting", label: "생일 축하" },
    ],
  },
];

function getVisibleAppTemplateDrafts(items: AppTemplateDraft[]) {
  return items.filter((item) => item.alias !== "booking_received");
}
function TextField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  help,
  sensitive = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  help?: string;
  sensitive?: boolean;
}) {
  const displayValue = readOnly && sensitive ? (value.trim() ? "설정됨" : "미설정") : value;

  return (
    <label className="space-y-2">
      <span className="text-[14px] font-semibold text-[#6f665f]">{label}</span>
      <textarea
        value={displayValue}
        readOnly={readOnly}
        onChange={(event) => {
          if (!readOnly) onChange?.(event.target.value);
        }}
        placeholder={placeholder}
        rows={2}
        className={`w-full rounded-[6px] border px-4 py-3 font-mono text-[14px] leading-5 outline-none ${
          readOnly
            ? "border-[#e6e3dd] bg-white text-[#6f665f]"
            : "border-[#d8d4ce] bg-white text-[#171411] focus:border-[#1f6b5b]"
        }`}
      />
      {help ? <p className="text-[12px] leading-5 text-[#8a8277]">{help}</p> : null}
      {readOnly && sensitive ? <p className="text-[12px] leading-5 text-[#8a8277]">보안상 실제 값은 숨겨서 표시합니다.</p> : null}
    </label>
  );
}
function AdminCollapsibleSection({
  title,
  children,
}: {
  title: string;
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
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">{title}</h2>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#7a7268] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-[#e6e3dd] p-6">{children}</div> : null}
    </section>
  );
}

export default function AdminAlimtalkScreen({
  sessionLoginId,
  appConfig,
  appTemplateDrafts: initialAppTemplateDrafts,
  notificationActivity,
}: {
  sessionLoginId: string;
  appConfig: AppAlimtalkConfig;
  appTemplateDrafts: AppTemplateDraft[];
  notificationActivity: AdminNotificationActivity;
}) {
  const [relayConfig, setRelayConfig] = useState<RelayAdminConfig | null>(null);
  const [relayTemplateItems, setRelayTemplateItems] = useState<RelaySsodaaTemplateItem[]>([]);
  const [allSsodaaTemplates, setAllSsodaaTemplates] = useState<RelaySsodaaTemplateDetail[]>([]);
  const [appTemplateDrafts, setAppTemplateDrafts] = useState<AppTemplateDraft[]>(() =>
    getVisibleAppTemplateDrafts(initialAppTemplateDrafts),
  );
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateCodesOpen, setTemplateCodesOpen] = useState(false);

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
      setAllSsodaaTemplates(response.allTemplates ?? []);
      setTemplateError(response.relayError ?? null);
      return response;
    } catch (nextError) {
      setTemplateError(nextError instanceof Error ? nextError.message : "쏘다 템플릿 상세를 불러오지 못했습니다.");
      return null;
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    void loadRelayConfig();
    void loadRelayTemplates();
  }, []);

  const hasRelayConfig = Boolean(relayConfig);

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

  function getCurrentTemplateCode(key: AlimtalkTemplateConfigKey) {
    return relayConfig?.[key] ?? appConfig[key] ?? "";
  }

  function getTemplateCodeStatus(templateCode: string) {
    if (!templateCode.trim()) {
      return {
        label: "미설정",
        className: "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]",
      };
    }

    const detail = allSsodaaTemplates.find((item) => item.templateCode === templateCode);
    if (!detail) {
      return {
        label: "쏘다 미확인",
        className: "border-[#f1d7a7] bg-[#fff9ed] text-[#b98121]",
      };
    }

    const status = [detail.inspectionStatus, detail.serviceStatus].filter(Boolean).join(" / ");
    const isUsable = detail.serviceStatus === "ACT" || detail.serviceStatus === "RDY";
    const isRejected = detail.inspectionStatus === "REJ" || detail.serviceStatus === "REJ";

    return {
      label: status || "상태 확인됨",
      className: isRejected
        ? "border-[#f0d1d1] bg-[#fff7f7] text-[#a04455]"
        : isUsable
          ? "border-[#cfe3dc] bg-[#f4fbf8] text-[#1f6b5b]"
          : "border-[#f1d7a7] bg-[#fff9ed] text-[#b98121]",
    };
  }

  async function saveTemplateCodeField(key: AlimtalkTemplateConfigKey, label: string, nextCode: string) {
    if (!relayConfig) return;

    const nextConfig: RelayAdminConfig = {
      ...relayConfig,
      [key]: nextCode.trim(),
    };

    setSaving(true);
    try {
      const response = await fetchApiJson<RelayAdminConfigResponse>("/api/admin/alimtalk/relay", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextConfig),
      });
      setRelayConfig(response.config);
      void loadRelayTemplates();
      setMessage(nextCode.trim() ? `${label} 템플릿 코드를 저장했습니다.` : `${label} 템플릿 코드를 비웠습니다.`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `${label} 템플릿 코드 저장에 실패했습니다.`);
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAppTemplate(alias: AlimtalkTemplateAlias, body: string) {
    const response = await fetchApiJson<{ item: AppTemplateDraft }>("/api/admin/alimtalk/templates", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ alias, body }),
    });
    if (response.item.alias !== "booking_received") {
      setAppTemplateDrafts((prev) => prev.map((item) => (item.alias === alias ? response.item : item)));
    }
    setMessage("우리 템플릿을 저장했습니다. 다음 발송부터 저장한 본문이 적용됩니다.");
    setError(null);
  }

  async function handleSelectRelayTemplate(alias: AlimtalkTemplateAlias, templateCode: string) {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.templateAlias === alias);
    const templateConfigKey = spec?.templateConfigKey as AlimtalkTemplateConfigKey | null | undefined;
    if (!templateConfigKey) {
      throw new Error("연결할 알림톡 템플릿 설정을 찾지 못했습니다.");
    }

    const currentConfig = (
      await fetchApiJson<RelayAdminConfigResponse>("/api/admin/alimtalk/relay", {
        cache: "no-store",
      })
    ).config;
    const nextConfig: RelayAdminConfig = {
      ...currentConfig,
      [templateConfigKey]: templateCode,
    };

    setSaving(true);
    try {
      const response = await fetchApiJson<RelayAdminConfigResponse>("/api/admin/alimtalk/relay", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextConfig),
      });
      setRelayConfig(response.config);
      const templateCatalog = await loadRelayTemplates();
      const selectedTemplate =
        templateCatalog?.items.find((item) => item.alias === alias && item.configuredCode === templateCode)?.detail ??
        templateCatalog?.allTemplates?.find((item) => item.templateCode === templateCode) ??
        null;
      setMessage(`${spec?.title ?? alias} 템플릿을 ${templateCode}로 연결했습니다.`);
      setError(null);
      return selectedTemplate;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "쏘다 템플릿 연결 저장에 실패했습니다.");
      setMessage(null);
      throw nextError;
    } finally {
      setSaving(false);
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

        <AdminAlimtalkTemplateComparisonPanel
          appTemplateDrafts={appTemplateDrafts}
          relayTemplateItems={relayTemplateItems}
          allSsodaaTemplates={allSsodaaTemplates}
          loadingTemplates={loadingTemplates}
          templateError={templateError}
          onReload={() => void loadRelayTemplates()}
          onSelectTemplate={handleSelectRelayTemplate}
        />

        <section className="rounded-[8px] border border-[#eceff3] bg-[#fbfcfd] shadow-[0_3px_10px_rgba(15,23,42,0.015)]">
          <button
            type="button"
            onClick={() => setTemplateCodesOpen((current) => !current)}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left"
            aria-expanded={templateCodesOpen}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9c3cf]" />
              <span className="text-[13px] font-medium text-[#7b8491]">템플릿 코드 설정</span>
              <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[12px] font-medium text-[#969ba4]">
                {appTemplateCodeFieldGroups.flatMap((group) => group.fields).length}개
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[12px] text-[#969ba4]">
              <span>{templateCodesOpen ? "열림" : "접힘"}</span>
              <ChevronDown className={`h-4 w-4 transition ${templateCodesOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {templateCodesOpen ? (
            <div className="grid gap-2 border-t border-[#eef1f5] px-4 py-3 lg:grid-cols-2">
              {appTemplateCodeFieldGroups.flatMap((group) => group.fields).map((field) => {
                const currentCode = getCurrentTemplateCode(field.key);
                const status = getTemplateCodeStatus(currentCode);
                const datalistId = `ssodaa-template-code-${field.key}`;

                return (
                  <div key={field.key} className="min-w-0 rounded-[6px] border border-[#e6eaf0] bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-[#334155]">{field.label}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        list={datalistId}
                        value={relayConfig?.[field.key] ?? ""}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        placeholder={appConfig[field.key] || "템플릿 코드 입력"}
                        className="h-9 min-w-0 flex-1 rounded-[6px] border border-[#dbe2ea] bg-white px-2.5 font-mono text-[13px] text-[#111827] outline-none focus:border-[#607080]"
                      />
                      <datalist id={datalistId}>
                        {allSsodaaTemplates.map((item) => (
                          <option
                            key={`${field.key}-${item.templateCode}`}
                            value={item.templateCode}
                            label={`${item.templateName ?? "이름 없음"} ${item.serviceStatus ? `(${item.serviceStatus})` : ""}`}
                          />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => void saveTemplateCodeField(field.key, field.label, relayConfig?.[field.key] ?? "")}
                        disabled={!relayConfig || saving}
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155] disabled:opacity-60"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveTemplateCodeField(field.key, field.label, "")}
                        disabled={!relayConfig || saving}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-[#dbe2ea] bg-white text-[#64748b] disabled:opacity-60"
                        aria-label={`${field.label} 템플릿 코드 삭제`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[#e6e3dd] bg-white text-[#52667d]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">템플릿 설정</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">현재 발송에 사용하는 템플릿 코드</h2>
              <p className="mt-2 text-[14px] leading-6 text-[#7a7268]">
                여기 적힌 코드가 실제 발송 요청에 들어갑니다. 연결 가능한 쏘다 템플릿에서 연결하면 이 값도 함께 바뀝니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {appTemplateCodeFieldGroups.flatMap((group) => group.fields).map((field) => (
              <TextField key={field.key} label={field.label} value={getCurrentTemplateCode(field.key)} readOnly />
            ))}
          </div>
        </section>

        <AdminCollapsibleSection title="고급 설정">
          <section className="grid gap-5">
            <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
                </div>
              ) : null}
            </div>

            <div className="rounded-[8px] border border-[#e6e3dd] bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[#e6e3dd] bg-white text-[#52667d]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">발송 서버</p>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">현재 적용 중인 설정</h3>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {appRuntimeFieldGroups.map((group) => (
                  <section key={group.title} className="rounded-[6px] border border-[#e6e3dd] bg-white p-5">
                    <div className="space-y-1">
                      <h4 className="text-[16px] font-semibold text-[#171411]">{group.title}</h4>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {group.fields.map((field) => (
                        <TextField key={field.key} label={field.label} value={appConfig[field.key]} readOnly sensitive={field.sensitive} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
            </div>
          </section>
        </AdminCollapsibleSection>

        <AdminCollapsibleSection
          title="릴레이 상태와 즉시 발송 테스트"
        >
          <AdminAlimtalkRuntimePanel appTemplateDrafts={appTemplateDrafts} />
        </AdminCollapsibleSection>

        <AdminCollapsibleSection
          title="알림톡 발송 활동"
        >
          <AdminAlimtalkActivitySections notificationActivity={notificationActivity} />
        </AdminCollapsibleSection>
      </div>
    </main>
  );
}
