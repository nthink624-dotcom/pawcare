"use client";

import { CheckCircle2, CircleAlert, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

type TemplateOption = {
  templateCode: string;
  templateName: string;
  templateContent: string;
  inspectionStatus: string;
  serviceStatus: string;
  buttons: Array<{ name: string; type: string }>;
};

type MappingResponse = {
  templates: TemplateOption[];
  providerTemplates: TemplateOption[];
  notificationMappings: Array<{
    type: string;
    title: string;
    trigger: string;
    alias: string;
    configKey: string;
    notes: string | null;
    source: "platform" | "environment" | "relay" | "none";
    templateCode: string | null;
    templateName: string | null;
    templateContent: string | null;
    inspectionStatus: string | null;
    serviceStatus: string | null;
    buttons: Array<{ name: string; type: string }>;
    usable: boolean;
  }>;
  connection: {
    relayConnected: boolean;
    ssodaaConnected: boolean | null;
    checkedAt: string | null;
    templateCount: number;
    approvedCount: number;
    reservationTemplateCount: number;
  };
  selectedCode: string;
  persistedCode: string;
  selectedName: string | null;
};

export default function AdminAlimtalkTemplateMapping() {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [providerTemplates, setProviderTemplates] = useState<TemplateOption[]>([]);
  const [notificationMappings, setNotificationMappings] = useState<MappingResponse["notificationMappings"]>([]);
  const [connection, setConnection] = useState<MappingResponse["connection"] | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setConnection(null);
    setProviderTemplates([]);
    try {
      const response = await fetchApiJson<MappingResponse>("/api/admin/alimtalk/template-mapping", { cache: "no-store" });
      setTemplates(response.templates);
      setProviderTemplates(response.providerTemplates);
      setNotificationMappings(response.notificationMappings);
      setConnection(response.connection);
      setSelectedCode(response.selectedCode);
      setSavedCode(response.persistedCode);
      setSavedName(response.selectedName);
      setError(null);
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "쏘다에서 승인된 예약 확정 템플릿을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const selectedTemplate = templates.find((template) => template.templateCode === selectedCode) ?? null;
  const isDirty = !savedCode || selectedCode !== savedCode;
  const selectedCodes = new Set(templates.map((template) => template.templateCode));
  const sendableCount = notificationMappings.filter((mapping) => mapping.templateCode && mapping.usable).length;
  const stoppedCount = notificationMappings.filter((mapping) =>
    Boolean(mapping.templateCode) && ["S", "STP", "STOP", "STOPPED"].includes(mapping.serviceStatus?.toUpperCase() ?? ""),
  ).length;
  const missingCount = notificationMappings.filter((mapping) => !mapping.templateCode).length;
  const reviewCount = notificationMappings.filter((mapping) =>
    Boolean(mapping.templateCode)
    && !mapping.usable
    && !["S", "STP", "STOP", "STOPPED"].includes(mapping.serviceStatus?.toUpperCase() ?? ""),
  ).length;
  const mappingGroups = [
    {
      key: "reservation",
      title: "예약 알림",
      aliases: ["booking_consent_request", "booking_confirmed", "booking_cancelled", "revisit_notice"],
    },
    {
      key: "reservation-guide",
      title: "예약 안내",
      aliases: ["appointment_reminder_10m", "visit_schedule_notice", "visit_reminder_notice"],
    },
    {
      key: "grooming",
      title: "미용 진행",
      aliases: ["grooming_started", "grooming_almost_done", "grooming_completed", "grooming_completed_without_report"],
    },
  ].map((group) => ({
    ...group,
    mappings: notificationMappings.filter((mapping) => group.aliases.includes(mapping.alias)),
  })).filter((group) => group.mappings.length > 0);
  const templateUseCounts = new Map<string, number>();
  for (const mapping of notificationMappings) {
    if (mapping.templateCode) templateUseCounts.set(mapping.templateCode, (templateUseCounts.get(mapping.templateCode) ?? 0) + 1);
  }

  function formatMappingSource(source: MappingResponse["notificationMappings"][number]["source"]) {
    if (source === "platform") return "PetManager 관리자 설정";
    if (source === "environment") return "PetManager 서버 설정";
    if (source === "relay") return "쏘다 릴레이 별칭";
    return "설정 없음";
  }

  function formatTemplateStatus(code: string, kind: "inspection" | "service") {
    const normalized = code.toUpperCase();
    if (kind === "inspection") {
      if (normalized === "APR") return "카카오 승인";
      if (normalized === "REQ") return "검수 중";
      if (normalized === "REJ") return "카카오 반려";
      if (!normalized) return "검수 상태 미확인";
      return `검수 확인 필요 (${code})`;
    }
    if (["R", "RDY", "READY", "ACT", "ACTIVE"].includes(normalized)) return "발송 가능";
    if (["S", "STP", "STOP", "STOPPED"].includes(normalized)) return "중지 · 발송 불가";
    if (["DMT", "DORMANT"].includes(normalized)) return "휴면";
    if (["BLK", "BLOCKED"].includes(normalized)) return "차단 · 발송 불가";
    if (!normalized) return "서비스 상태 확인 필요";
    return `서비스 상태 확인 필요 (${code})`;
  }

  function getMappingStatus(mapping: MappingResponse["notificationMappings"][number]) {
    const serviceStatus = mapping.serviceStatus?.toUpperCase() ?? "";
    const inspectionStatus = mapping.inspectionStatus?.toUpperCase() ?? "";
    if (!mapping.templateCode) return { label: "템플릿 없음", tone: "danger" as const };
    if (["S", "STP", "STOP", "STOPPED"].includes(serviceStatus)) return { label: "중지 · 발송 불가", tone: "danger" as const };
    if (inspectionStatus === "REJ") return { label: "카카오 반려", tone: "danger" as const };
    if (mapping.usable) {
      return {
        label: "발송 가능",
        tone: "success" as const,
      };
    }
    return { label: "상태 확인 필요", tone: "warning" as const };
  }

  async function save() {
    if (!selectedCode || !isDirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchApiJson<{ selectedCode: string; selectedName: string }>(
        "/api/admin/alimtalk/template-mapping",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ templateCode: selectedCode }),
        },
      );
      setSelectedCode(response.selectedCode);
      setSavedCode(response.selectedCode);
      setSavedName(response.selectedName);
      setNotice("저장됨");
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "저장 실패"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="admin-alimtalk-template-title" className="rounded-[12px] border border-[#D9E0E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="admin-alimtalk-template-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>예약 확정</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D9E0E8] bg-white px-3 text-[#475569] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-4 rounded-[8px] border border-[#E8EDF3] bg-[#F8FAFC] px-3 py-3" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {connection?.ssodaaConnected === true
            ? <CheckCircle2 className="h-4 w-4 text-[#1F6B5B]" aria-hidden />
            : connection?.ssodaaConnected === false || error
              ? <CircleAlert className="h-4 w-4 text-[#9A5E4E]" aria-hidden />
              : <RefreshCcw className={`h-4 w-4 text-[#64748B] ${loading ? "animate-spin" : ""}`} aria-hidden />}
          <p className={`text-[#15213B] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>
            {!connection ? "쏘다 연결 상태 확인 중" : connection.ssodaaConnected === true ? "쏘다 템플릿 조회 완료" : connection.ssodaaConnected === false ? "쏘다 템플릿 조회 실패" : "쏘다 조회 상태 확인 필요"}
          </p>
          {connection?.checkedAt ? <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
            확인 {new Date(connection.checkedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
          </span> : null}
        </div>
        {connection ? <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
          릴레이 {connection.relayConnected ? "연결됨" : "연결 안 됨"} · 전체 {connection.templateCount}개 · 승인 {connection.approvedCount}개 · 예약 확정 {connection.reservationTemplateCount}개
        </p> : null}
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className={`mb-1 block text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>템플릿</span>
          <select value={selectedCode} onChange={(event) => { setSelectedCode(event.target.value); setNotice(null); }} disabled={loading || saving || templates.length === 0} className={`min-h-11 w-full rounded-[8px] border border-[#D9E0E8] bg-white px-3 text-[#15213B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:bg-[#F8FAFC] ${ADMIN_TYPOGRAPHY.control}`}>
            <option value="">승인된 템플릿 선택</option>
            {selectedCode && !templates.some((template) => template.templateCode === selectedCode) ? <option value={selectedCode}>{savedName || selectedCode} · 현재 적용</option> : null}
            {templates.map((template) => <option key={template.templateCode} value={template.templateCode}>{template.templateName} · {template.templateCode}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void save()} disabled={loading || saving || !selectedCode || !isDirty} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#111A30] px-5 text-white hover:bg-[#1A294A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_TYPOGRAPHY.control}`}>
          {saving ? "적용 중" : "적용"}
        </button>
      </div>

      {selectedTemplate ? <div className="mt-3 rounded-[8px] bg-[#F8FAFC] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#1F6B5B]" aria-hidden />
          <p className={`min-w-0 text-[#334155] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{selectedTemplate.templateName}</p>
          <span className={`rounded-full bg-white px-2 py-0.5 text-[#64748B] ${ADMIN_TYPOGRAPHY.badge}`}>승인됨</span>
        </div>
        {selectedTemplate.buttons.length ? <p className={`mt-1 break-words text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>버튼: {selectedTemplate.buttons.map((button) => button.name).join(", ")}</p> : null}
      </div> : null}
      {selectedCode && !isDirty ? <p className={`mt-2 break-all text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
        {savedCode ? "관리자 설정에 저장됨" : "운영 환경 기본값"} · {savedName || selectedCode}
      </p> : null}
      {notice ? <p role="status" className={`mt-3 text-[#1F6B5B] ${ADMIN_TYPOGRAPHY.helper}`}>{notice}</p> : null}
      {error ? <p role="alert" className={`mt-3 text-[#9A5E4E] ${ADMIN_TYPOGRAPHY.helper}`}>{error}</p> : null}
      {!loading && !error && templates.length === 0 ? <p className={`mt-3 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
        예약 확정 템플릿 없음
      </p> : null}

      {!loading && !error ? <details className="mt-4 border-t border-[#E8EDF3] pt-3">
        <summary className={`flex min-h-11 cursor-pointer items-center text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>
          쏘다 템플릿 {providerTemplates.length}개
        </summary>
        {providerTemplates.length ? <ul className="mt-3 divide-y divide-[#E8EDF3]">
          {providerTemplates.map((template) => <li key={template.templateCode} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className={`break-words text-[#15213B] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{template.templateName}</p>
              <p className={`break-all text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{template.templateCode}</p>
            </div>
            <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
              <span>{formatTemplateStatus(template.inspectionStatus, "inspection")}</span>
              <span>{formatTemplateStatus(template.serviceStatus, "service")}</span>
              <span className={selectedCodes.has(template.templateCode) ? "text-[#1F6B5B]" : ""}>
                {selectedCodes.has(template.templateCode) ? "예약 확정 사용 가능" : "예약 확정 사용 불가"}
              </span>
            </div>
          </li>)}
        </ul> : <p className={`mt-3 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>쏘다 템플릿 없음</p>}
      </details> : null}

      {!loading && !error ? <section aria-labelledby="alimtalk-notification-mappings-title" className="mt-5 border-t border-[#E8EDF3] pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="alimtalk-notification-mappings-title" className={`text-[#15213B] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>알림 연결 상태</h3>
          </div>
          {connection?.checkedAt ? <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
            쏘다 확인 {new Date(connection.checkedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
          </span> : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "발송 가능", count: sendableCount, tone: "success" },
            { label: "중지 · 발송 불가", count: stoppedCount, tone: "danger" },
            { label: "템플릿 미연결", count: missingCount, tone: "danger" },
            { label: "상태 확인 필요", count: reviewCount, tone: "warning" },
          ].map((item) => <div key={item.label} className={`rounded-[8px] border px-3 py-2 ${item.tone === "success" ? "border-[#CDE9DA] bg-[#F0FAF4] text-[#1F6B5B]" : item.tone === "danger" ? "border-[#F0D4CC] bg-[#FFF7F4] text-[#9A4F3E]" : "border-[#F0E1C5] bg-[#FFFAF0] text-[#8B6429]"}`}>
            <p className={ADMIN_TYPOGRAPHY.helper}>{item.label}</p>
            <p className={`mt-0.5 ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.count}개</p>
          </div>)}
        </div>

        <div className="mt-3 space-y-3">
          {mappingGroups.map((group) => {
            const groupSendable = group.mappings.filter((mapping) => mapping.templateCode && mapping.usable).length;
            const groupStopped = group.mappings.filter((mapping) => ["S", "STP", "STOP", "STOPPED"].includes(mapping.serviceStatus?.toUpperCase() ?? "")).length;
            const groupMissing = group.mappings.filter((mapping) => !mapping.templateCode).length;
            const groupReview = group.mappings.filter((mapping) => mapping.templateCode && !mapping.usable && !["S", "STP", "STOP", "STOPPED"].includes(mapping.serviceStatus?.toUpperCase() ?? "")).length;
            return <section key={group.key} aria-label={group.title} className="overflow-hidden rounded-[8px] border border-[#E8EDF3]">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[#F8FAFC] px-3 py-2.5 sm:px-4">
                <h4 className={`text-[#15213B] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{group.title} <span className="font-normal text-[#64748B]">{groupSendable}/{group.mappings.length} 발송 가능</span></h4>
                <div className={`flex flex-wrap gap-x-3 gap-y-1 ${ADMIN_TYPOGRAPHY.helper}`}>
                  {groupStopped > 0 ? <span className="text-[#9A4F3E]">{groupStopped}개 중지 · 발송 불가</span> : null}
                  {groupMissing > 0 ? <span className="text-[#9A4F3E]">{groupMissing}개 템플릿 미연결</span> : null}
                  {groupReview > 0 ? <span className="text-[#8B6429]">{groupReview}개 상태 확인 필요</span> : null}
                </div>
              </div>
              <ul className="divide-y divide-[#E8EDF3]">
          {group.mappings.map((mapping) => {
            const status = getMappingStatus(mapping);
            const statusClass = status.tone === "success"
              ? "bg-[#EAF7F1] text-[#1F6B5B]"
              : status.tone === "danger"
                ? "bg-[#FFF0EC] text-[#9A4F3E]"
                : "bg-[#FFF7E8] text-[#8B6429]";
            const duplicateCount = mapping.templateCode ? templateUseCounts.get(mapping.templateCode) ?? 0 : 0;
            return <li key={`${mapping.alias}-${mapping.type}`} className="px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <p className={`text-[#15213B] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{mapping.title}</p>
                <p className={`min-w-0 max-w-full break-all text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                  {mapping.templateName || mapping.templateCode || "템플릿 미연결"}
                </p>
                {duplicateCount > 1 ? <span className={`text-[#8B6429] ${ADMIN_TYPOGRAPHY.badge}`}>중복 {duplicateCount}</span> : null}
                <span className={`rounded-full px-2 py-0.5 ${statusClass} ${ADMIN_TYPOGRAPHY.badge}`}>{status.label}</span>
                <details className="basis-full sm:ml-auto sm:basis-auto">
                <summary className={`min-h-8 cursor-pointer text-[#2563EB] ${ADMIN_TYPOGRAPHY.helper}`}>연결 정보</summary>
                <div className="mt-2 rounded-[8px] bg-[#F8FAFC] p-3">
                  <p className={`break-all text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                    PetManager 코드 <code className="font-medium">{mapping.alias}</code> · {formatMappingSource(mapping.source)}
                  </p>
                  <p className={`mt-1 text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                    {formatTemplateStatus(mapping.inspectionStatus ?? "", "inspection")} · 쏘다 {formatTemplateStatus(mapping.serviceStatus ?? "", "service")}
                  </p>
                  {mapping.templateCode ? <p className={`mt-1 break-all text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>쏘다 코드 {mapping.templateCode}</p> : null}
                  {mapping.templateContent ? <div className={`mt-2 whitespace-pre-wrap break-words border-t border-[#E8EDF3] pt-2 text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                    <p className="mb-1 font-medium">쏘다 본문</p>
                    {mapping.templateContent}
                    {mapping.buttons.length ? <p className="mt-2">버튼: {mapping.buttons.map((button) => button.name).join(", ")}</p> : null}
                  </div> : null}
                </div>
                </details>
              </div>
            </li>;
          })}
              </ul>
            </section>;
          })}
        </div>
      </section> : null}
    </section>
  );
}
