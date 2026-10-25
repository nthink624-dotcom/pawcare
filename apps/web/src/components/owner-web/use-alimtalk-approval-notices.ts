"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { AlimtalkApprovalNotice } from "@petmanager/shared/contracts/alimtalk-approval-notice";

export function useAlimtalkApprovalNotices(shopId: string, enabled = true) {
  const [state, setState] = useState<{ shopId: string; notices: AlimtalkApprovalNotice[]; error: string } | null>(null);
  const notices = enabled && state?.shopId === shopId ? state.notices : [];
  const error = enabled && state?.shopId === shopId ? state.error : "";
  const generation = useRef(0), pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    const epoch = generation.current;
    const task = fetchApiJsonWithAuth<{ notices: AlimtalkApprovalNotice[] }>(`/api/owner/alimtalk-approval-notices?shopId=${encodeURIComponent(shopId)}`)
      .then(result => { if (generation.current === epoch) setState({ shopId, notices: result.notices, error: "" }); })
      .catch(() => { if (generation.current === epoch) setState(current => ({ shopId, notices: current?.shopId === shopId ? current.notices : [], error: "문구 승인 알림을 불러오지 못했습니다." })); })
      .finally(() => { if (pending.current === task) pending.current = null; });
    pending.current = task; return task;
  }, [shopId]);
  useEffect(() => {
    generation.current++; pending.current = null; if (!enabled) return;
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
    setState(current => current?.shopId === shopId ? { ...current, notices: current.notices.filter(item => item.id !== notice.id) } : current);
  };
  return { notices, error, refresh, acknowledge };
}
