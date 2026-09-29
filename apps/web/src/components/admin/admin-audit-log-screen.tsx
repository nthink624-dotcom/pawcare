"use client";

import { ClipboardCheck, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { formatAdminDateTime } from "@/components/admin/admin-dashboard-model";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

type AuditEvent = {
  id: string | null;
  shopId: string | null;
  actorLabel: string | null;
  actionSource: string | null;
  actionType: string | null;
  entityType: string | null;
  entityId: string | null;
  requestId: string | null;
  createdAt: string | null;
};

type LoadState = "loading" | "ready" | "error";

const ACTION_LABELS: Record<string, string> = {
  created: "생성",
  updated: "수정",
  deleted: "삭제",
  restored: "복구",
  status_changed: "상태 변경",
  approved: "승인",
  rejected: "거절",
  assigned: "배정",
  unassigned: "배정 해제",
  sent: "발송",
  failed: "실패",
  imported: "가져오기",
  exported: "내보내기",
};

const ENTITY_LABELS: Record<string, string> = {
  appointment: "예약",
  appointment_customer_request: "예약 요청",
  guardian: "보호자",
  pet: "반려동물",
  grooming_record: "케어 기록",
  notification: "알림",
  staff_member: "담당자",
  staff_schedule_override: "근무 일정",
  service: "서비스",
  shop_settings: "매장 설정",
  customer_page_settings: "고객 화면 설정",
  alimtalk_credit: "알림톡 크레딧",
  media_asset: "미디어",
  label: "라벨",
  other: "기타",
};

const SOURCE_LABELS: Record<string, string> = {
  owner_web: "오너 웹",
  owner_mobile: "오너 앱",
  admin: "관리자",
  customer_page: "고객 화면",
  system: "시스템",
};

export default function AdminAuditLogScreen() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [shopId, setShopId] = useState("");
  const [actionSource, setActionSource] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoadState("loading");
    const query = new URLSearchParams({ limit: "100" });
    if (shopId.trim()) query.set("shopId", shopId.trim());
    if (actionSource) query.set("actionSource", actionSource);
    if (entityType) query.set("entityType", entityType);
    try {
      const response = await fetchApiJson<{ events: AuditEvent[] }>(`/api/admin/audit-events?${query.toString()}`, { cache: "no-store" });
      setEvents(response.events);
      setError(null);
      setLoadState("ready");
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "감사 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
      setLoadState("error");
    }
  }, [actionSource, entityType, shopId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadEvents());
    return () => window.cancelAnimationFrame(frame);
  }, [loadEvents]);

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F4F4F4] px-3 py-3 text-[#172033] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.10)]">
        <header className="border-b border-[#E7E7E7] px-4 py-5 sm:px-6 lg:px-8">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0873C6]`}>AUDIT OPERATIONS</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className={`tracking-[-0.03em] text-[#111112] ${ADMIN_TYPOGRAPHY.pageTitle}`}>감사 로그</h1>
              <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>운영 변경의 주체와 상태만 확인합니다. 고객 원문과 상세 payload는 표시하지 않습니다.</p>
            </div>
            <button type="button" onClick={() => void loadEvents()} disabled={loadState === "loading"} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#475569] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>
              <RefreshCcw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} aria-hidden />
              새로고침
            </button>
          </div>
          <div className="mt-4"><AdminSectionNav active="audit" /></div>
        </header>

        <div className="bg-[#F4F4F4] px-4 py-5 sm:px-6 lg:px-8">
          <section aria-label="감사 로그 필터" className="rounded-[12px] border border-[#D9E0E8] bg-white p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)_minmax(160px,0.6fr)_auto] md:items-end">
              <label className="min-w-0">
                <span className={`mb-1 block text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>매장 ID</span>
                <input value={shopId} onChange={(event) => setShopId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadEvents(); }} placeholder="전체 매장" className={`h-11 w-full rounded-[8px] border border-[#D9E0E8] bg-white px-3 text-[#172033] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] ${ADMIN_TYPOGRAPHY.control}`} />
              </label>
              <FilterSelect label="주체" value={actionSource} onChange={setActionSource} options={SOURCE_LABELS} allLabel="모든 주체" />
              <FilterSelect label="대상" value={entityType} onChange={setEntityType} options={ENTITY_LABELS} allLabel="모든 대상" />
              <button type="button" onClick={() => void loadEvents()} className={`inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#111A30] px-4 text-white transition hover:bg-[#1A294A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}>조회</button>
            </div>
          </section>

          <section aria-labelledby="audit-list-title" className="mt-4 overflow-hidden rounded-[12px] border border-[#D9E0E8] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E7E7E7] p-4 sm:p-5">
              <div>
                <h2 id="audit-list-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>최근 변경</h2>
                <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>최대 100건까지 조회합니다.</p>
              </div>
              <span className={`tabular-nums text-[#64748B] ${ADMIN_TYPOGRAPHY.meta}`}>{events.length}건</span>
            </div>
            {loadState === "loading" ? <p className={`px-4 py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>감사 로그를 불러오는 중입니다.</p> : null}
            {loadState === "error" ? <div className="px-4 py-12 text-center"><p role="alert" className={`text-[#9A5E4E] ${ADMIN_TYPOGRAPHY.body}`}>{error}</p><button type="button" onClick={() => void loadEvents()} className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#334155] ${ADMIN_TYPOGRAPHY.control}`}>다시 시도</button></div> : null}
            {loadState === "ready" && events.length === 0 ? <p className={`px-4 py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>조건에 맞는 감사 로그가 없습니다.</p> : null}
            {loadState === "ready" && events.length > 0 ? <div className="divide-y divide-[#E7E7E7]">{events.map((event) => <article key={event.id ?? `${event.createdAt}-${event.entityId}`} className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[#1D4ED8] ${ADMIN_TYPOGRAPHY.badge}`}>{ENTITY_LABELS[event.entityType ?? ""] ?? "기타"}</span><span className={`rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[#475569] ${ADMIN_TYPOGRAPHY.badge}`}>{ACTION_LABELS[event.actionType ?? ""] ?? "상태 확인"}</span></div><p className={`mt-2 text-[#111112] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{SOURCE_LABELS[event.actionSource ?? ""] ?? "알 수 없음"} · {event.actorLabel || "운영 주체 확인 필요"}</p><p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{event.shopId ? `매장 ${event.shopId}` : "매장 확인 필요"}</p></div><time dateTime={event.createdAt ?? undefined} className={`shrink-0 text-[#64748B] sm:text-right ${ADMIN_TYPOGRAPHY.helper}`}>{event.createdAt ? formatAdminDateTime(event.createdAt) : "시간 확인 필요"}</time></article>)}</div> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string>; allLabel: string }) {
  return <label className="min-w-0"><span className={`mb-1 block text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-[8px] border border-[#D9E0E8] bg-white px-3 text-[#172033] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] ${ADMIN_TYPOGRAPHY.control}`}><option value="">{allLabel}</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
