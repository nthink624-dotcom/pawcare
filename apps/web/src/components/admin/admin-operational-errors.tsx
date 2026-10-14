"use client";
import { useCallback, useEffect, useState } from "react";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { formatAdminDateTime } from "@/components/admin/admin-dashboard-model";
import { fetchApiJson } from "@/lib/api";

type Event = { id: string; project_name: string; event_name: string; http_status: number | null; release_id: string; created_at: string };
function describeEvent(name: string) {
  if (name.startsWith("alimtalk.")) return "알림톡 전송 실패";
  if (name.startsWith("billing.") || name.startsWith("payment_")) return "결제 처리 실패";
  if (name.startsWith("auth.") || name.startsWith("owner_login")) return "로그인·가입 처리 실패";
  if (name.startsWith("readiness.")) return "서버 연결 확인 실패";
  if (name.startsWith("appointment")) return "예약 처리 실패";
  if (name.startsWith("owner_push.")) return "앱 알림 전송 실패";
  return "운영 처리 실패";
}
export default function AdminOperationalErrors() {
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setFailed(false);
    try {
      const result = await fetchApiJson<{ ok: boolean; events: Event[] }>("/api/admin/operational-errors");
      if (!result.ok) throw new Error("Unavailable");
      setEvents(result.events);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="min-h-screen bg-[#F1F3F7] p-3 text-[#15213B] sm:p-6">
    <div className="mx-auto max-w-[1440px] rounded-[14px] border border-[#E8EDF3] bg-white">
      <header className="space-y-4 border-b border-[#E8EDF3] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={T.pageTitle}>운영 오류</h1>
          <button type="button" disabled={busy} onClick={() => void load()} className={`min-h-11 rounded-[8px] border border-[#E8EDF3] px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${T.control}`}>새로고침</button>
        </div>
        <p className={`text-[#64748B] ${T.body}`}>최근 7일의 오류를 최대 100건 표시합니다.</p>
        <AdminSectionNav active="operationalErrors" />
      </header>
      <section aria-label="운영 오류 기록" aria-busy={busy} className="p-4 sm:p-6">
        {failed ? <p role="alert" className={T.body}>오류 기록을 불러오지 못했습니다. 새로고침으로 다시 시도해주세요.</p> : busy ? <p role="status" className={T.body}>오류 기록을 불러오는 중입니다.</p> : events.length === 0 ? <p className={T.body}>최근 7일 동안 기록된 오류가 없습니다.</p> : <ul className="divide-y divide-[#E8EDF3]">
          {events.map(event => <li key={event.id} className="space-y-2 py-4 first:pt-0">
            <div className="flex flex-wrap justify-between gap-2"><span className={T.bodyStrong}>{event.project_name === "mobile" ? "모바일" : "웹"}{event.http_status ? ` · ${event.http_status}` : ""}</span><time dateTime={event.created_at} className={`text-[#64748B] ${T.helper}`}>{formatAdminDateTime(event.created_at)}</time></div>
            <p className={T.body}>{describeEvent(event.event_name)}</p>
            <p className={`text-[#64748B] ${T.helper}`}>배포 {event.release_id.slice(0, 8)}</p>
          </li>)}
        </ul>}
      </section>
    </div>
  </main>;
}
