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

  function formatTemplateStatus(code: string, kind: "inspection" | "service") {
    const normalized = code.toUpperCase();
    if (kind === "inspection") {
      if (normalized === "APR") return "승인됨";
      if (normalized === "REQ") return "검수 중";
      if (normalized === "REJ") return "반려됨";
      if (!normalized) return "검수 상태 미확인";
      return `검수 상태 ${code}`;
    }
    if (normalized === "ACT") return "사용 중";
    if (normalized === "RDY") return "사용 준비";
    if (!normalized) return "서비스 상태 미확인";
    return `서비스 상태 ${code}`;
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
      setNotice("선택한 템플릿을 예약 확정 알림톡 발송에 적용했습니다.");
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "템플릿을 저장하지 못했습니다. 연결과 승인 상태를 확인해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="admin-alimtalk-template-title" className="rounded-[12px] border border-[#D9E0E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="admin-alimtalk-template-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>예약 확정 템플릿</h2>
          <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
            쏘다에 연결된 승인 템플릿 중 실제 발송에 사용할 항목을 선택합니다.
          </p>
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
        <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
          {connection ? `릴레이 ${connection.relayConnected ? "연결됨" : "연결 안 됨"} · 전체 ${connection.templateCount}개 · 승인 ${connection.approvedCount}개 · 예약 확정 선택 가능 ${connection.reservationTemplateCount}개` : "새로고침하면 릴레이와 쏘다 템플릿 목록을 다시 확인합니다."}
        </p>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className={`mb-1 block text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>사용할 템플릿</span>
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
        쏘다에서 사용 가능한 예약 확정 템플릿을 찾지 못했습니다. 쏘다 연결과 템플릿 승인 상태를 확인해 주세요.
      </p> : null}

      {!loading && !error ? <details className="mt-4 border-t border-[#E8EDF3] pt-3">
        <summary className={`flex min-h-11 cursor-pointer items-center text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>
          쏘다에서 조회한 전체 템플릿 {providerTemplates.length}개
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
                {selectedCodes.has(template.templateCode) ? "예약 확정 선택 가능" : "예약 확정 발송에 사용할 수 없음"}
              </span>
            </div>
          </li>)}
        </ul> : <p className={`mt-3 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>쏘다에서 조회한 템플릿이 없습니다.</p>}
      </details> : null}
    </section>
  );
}
