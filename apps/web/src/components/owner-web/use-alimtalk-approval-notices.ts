"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { AlimtalkApprovalNotice } from "@petmanager/shared/contracts/alimtalk-approval-notice";

export function useAlimtalkApprovalNotices(shopId: string, enabled = true) {
  const [notices, setNotices] = useState<AlimtalkApprovalNotice[]>([]), [error, setError] = useState("");
  const generation = useRef(0), pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    const epoch = generation.current;
    const task = fetchApiJsonWithAuth<{ notices: AlimtalkApprovalNotice[] }>(`/api/owner/alimtalk-approval-notices?shopId=${encodeURIComponent(shopId)}`)
      .then(result => { if (generation.current === epoch) { setNotices(result.notices); setError(""); } })
      .catch(() => { if (generation.current === epoch) setError("문구 승인 알림을 불러오지 못했습니다."); })
      .finally(() => { if (pending.current === task) pending.current = null; });
    pending.current = task; return task;
  }, [shopId]);
  useEffect(() => {
    generation.current++; pending.current = null; setNotices([]); setError(""); if (!enabled) return;
    const visible = () => { if (!document.hidden) void refresh(); };
    visible(); const timer = window.setInterval(visible, 30000);
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { generation.current++; pending.current = null; clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [shopId, enabled, refresh]);
  const acknowledge = async (notice: AlimtalkApprovalNotice) => {
    const epoch = generation.current;
    await fetchApiJsonWithAuth("/api/owner/alimtalk-approval-notices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, noticeId: notice.id }) });
    if (epoch !== generation.current) throw new Error("매장이 변경됐습니다.");
    generation.current++; pending.current = null;
    setNotices(current => current.filter(item => item.id !== notice.id));
  };
  return { notices, error, refresh, acknowledge };
}
