"use client";

import { RefreshCcw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import type { AlimtalkTemplateAlias } from "@/lib/notification-registry";
import type {
  AppTemplateDraft,
  RelayRuntimeDiagnostics,
  AdminAlimtalkTestResult,
} from "@/server/admin-alimtalk";

function statusTone(ok: boolean) {
  return ok
    ? "border-[#d8e7e1] bg-[#f5fbf8] text-[#2f7266]"
    : "border-[#efd4d4] bg-[#fff7f7] text-[#b54b4b]";
}

export default function AdminAlimtalkRuntimePanel({
  appTemplateDrafts,
}: {
  appTemplateDrafts: AppTemplateDraft[];
}) {
  const defaultAlias =
    appTemplateDrafts.find((item) => item.alias === "appointment_reminder_10m")?.alias ?? appTemplateDrafts[0]?.alias ?? "";

  const [diagnostics, setDiagnostics] = useState<RelayRuntimeDiagnostics | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(true);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<AdminAlimtalkTestResult | null>(null);
  const [form, setForm] = useState({
    alias: defaultAlias,
    phone: "",
    recipientName: "보호자",
    shopName: "펫매니저 테스트 매장",
    petName: "우유",
    serviceName: "전체 미용",
    appointmentDateTime: "2026-05-04(월) 14:00",
    bookingManageUrl: "https://www.petmanager.co.kr",
  });

  const selectedDraft = useMemo(
    () => appTemplateDrafts.find((item) => item.alias === form.alias) ?? null,
    [appTemplateDrafts, form.alias],
  );

  async function loadDiagnostics() {
    setLoadingDiagnostics(true);
    try {
      const response = await fetchApiJson<RelayRuntimeDiagnostics>("/api/admin/alimtalk/relay/diagnostics", {
        cache: "no-store",
      });
      setDiagnostics(response);
      setDiagnosticsError(null);
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : "relay 진단 정보를 불러오지 못했습니다.");
    } finally {
      setLoadingDiagnostics(false);
    }
  }

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  async function handleTestSend() {
    if (!form.alias || !form.phone.trim()) {
      setSendError("테스트할 템플릿과 수신 번호를 입력해 주세요.");
      return;
    }

    setSending(true);
    try {
      const response = await fetchApiJson<AdminAlimtalkTestResult>("/api/admin/alimtalk/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      setSendResult(response);
      setSendError(null);
    } catch (error) {
      setSendResult(null);
      setSendError(error instanceof Error ? error.message : "관리자 테스트 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <article className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">실시간 relay 진단</p>
            <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">현재 relay와 템플릿 상태</h2>
            <p className="text-[13px] leading-6 text-[#6f665f]">
              relay가 살아 있는지, 템플릿이 몇 개 연결됐는지, 디버그 엔드포인트 응답이 어떤지 바로 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDiagnostics()}
            disabled={loadingDiagnostics}
            className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            새로고침
          </button>
        </div>

        {diagnosticsError ? (
          <p className="mt-5 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
            {diagnosticsError}
          </p>
        ) : null}

        {loadingDiagnostics ? (
          <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[14px] text-[#7a7268]">
            relay 진단 상태를 불러오는 중이에요.
          </div>
        ) : diagnostics ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">Relay Host</p>
                <p className="mt-2 text-[16px] font-semibold text-[#171411]">{diagnostics.relayHost || "-"}</p>
                <p className="mt-2 text-[12px] leading-5 text-[#7a7268]">
                  연결 설정 {diagnostics.configured ? "완료" : "미완료"}
                </p>
              </div>
              <div className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">템플릿 연결 수</p>
                <p className="mt-2 text-[16px] font-semibold text-[#171411]">
                  {diagnostics.templates.configuredTemplates} / {diagnostics.templates.totalTemplates}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-[#7a7268]">relay debug 기준 연결된 템플릿 개수</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#171411]">/health</p>
                  <span className={`rounded-[999px] border px-2.5 py-1 text-[11px] font-medium ${statusTone(diagnostics.health.ok)}`}>
                    {diagnostics.health.status ?? "ERR"}
                  </span>
                </div>
                <p className="mt-2 break-all text-[11px] leading-5 text-[#8a8277]">{diagnostics.health.url || "-"}</p>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-3 py-3 font-[inherit] text-[12px] leading-5 text-[#5f5952]">
                  {diagnostics.health.error || diagnostics.health.bodyPreview || "응답 없음"}
                </pre>
              </div>

              <div className="rounded-[6px] border border-[#e6e3dd] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#171411]">/debug/templates</p>
                  <span
                    className={`rounded-[999px] border px-2.5 py-1 text-[11px] font-medium ${statusTone(diagnostics.templates.ok)}`}
                  >
                    {diagnostics.templates.status ?? "ERR"}
                  </span>
                </div>
                <p className="mt-2 break-all text-[11px] leading-5 text-[#8a8277]">{diagnostics.templates.url || "-"}</p>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-3 py-3 font-[inherit] text-[12px] leading-5 text-[#5f5952]">
                  {diagnostics.templates.error || diagnostics.templates.bodyPreview || "응답 없음"}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      <article className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">관리자 테스트 발송</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">쏘다 + relay 즉시 테스트</h2>
          <p className="text-[13px] leading-6 text-[#6f665f]">
            선택한 템플릿의 현재 초안 본문으로 직접 발송합니다. 특히 10분 전 알림처럼 특정 타입만 안 될 때 빠르게 확인할 수 있어요.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[12px] font-semibold text-[#6f665f]">템플릿</span>
            <select
              value={form.alias}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, alias: event.target.value as AlimtalkTemplateAlias }))
              }
              className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[14px] text-[#171411] outline-none focus:border-[#1f6b5b]"
            >
              {appTemplateDrafts.map((item) => (
                <option key={item.alias} value={item.alias}>
                  {item.title} ({item.alias})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-semibold text-[#6f665f]">수신 번호</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="01012345678"
              className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[14px] text-[#171411] outline-none focus:border-[#1f6b5b]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-semibold text-[#6f665f]">반려동물명</span>
            <input
              value={form.petName}
              onChange={(event) => setForm((prev) => ({ ...prev, petName: event.target.value }))}
              className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[14px] text-[#171411] outline-none focus:border-[#1f6b5b]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-semibold text-[#6f665f]">예약 일시</span>
            <input
              value={form.appointmentDateTime}
              onChange={(event) => setForm((prev) => ({ ...prev, appointmentDateTime: event.target.value }))}
              className="h-11 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[14px] text-[#171411] outline-none focus:border-[#1f6b5b]"
            />
          </label>
        </div>

        <div className="mt-4 rounded-[6px] border border-[#e6e3dd] bg-white p-4">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 전송될 초안 본문</p>
          <pre className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#171411]">
            {selectedDraft?.body || "선택한 템플릿 초안이 없습니다."}
          </pre>
        </div>

        {sendError ? (
          <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
            {sendError}
          </p>
        ) : null}

        {sendResult ? (
          <div className="mt-4 rounded-[6px] border border-[#d8e7e1] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[#171411]">{sendResult.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                  ****{sendResult.recipientPhoneTail} · {sendResult.provider}
                  {sendResult.providerMessageId ? ` · ${sendResult.providerMessageId}` : ""}
                </p>
              </div>
              <span className="rounded-[999px] border border-[#d8e7e1] bg-[#f5fbf8] px-2.5 py-1 text-[11px] font-medium text-[#2f7266]">
                sent
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-3 py-3 font-[inherit] text-[12px] leading-5 text-[#5f5952]">
              {sendResult.responsePreview}
            </pre>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void handleTestSend()}
            disabled={sending}
            className="inline-flex h-11 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "발송 중..." : "테스트 발송"}
          </button>
        </div>
      </article>
    </section>
  );
}
