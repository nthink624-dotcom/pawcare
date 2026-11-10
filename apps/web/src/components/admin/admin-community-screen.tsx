"use client";
import { useCallback, useEffect, useState } from "react";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { fetchApiJson } from "@/lib/api";
import { communityButton, communityPrimary } from "@petmanager/shared/components/community/community-form";

type Report = { id: string; reason: string; targetType: "post" | "comment"; createdAt: string; title: string | null; postBody: string | null; commentBody: string | null; hidden: boolean | null; images: { mediaAssetId: string; url: string }[] };
export default function AdminCommunityScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await fetchApiJson<{ reports: Report[] }>("/api/admin/community", { cache: "no-store" }); setReports(result.reports); }
    catch { setError("신고 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function review(id: string, action: "hide" | "dismiss") {
    setBusy(true); setError("");
    try { await fetchApiJson("/api/admin/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) }); await load(); }
    catch { setError("처리 결과를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-[1100px] space-y-5 bg-white p-5 text-[#15213b]">
    <AdminSectionNav active="community" />
    <div className="flex items-center justify-between gap-3"><h1 className="text-[24px] font-semibold">커뮤니티 신고</h1><button className={communityButton} disabled={busy || loading} onClick={() => void load()}>새로고침</button></div>
    {error && <p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p>}
    {loading ? <p role="status">신고를 불러오고 있습니다.</p> : reports.length === 0 ? <p>처리할 신고가 없습니다.</p> : reports.map((report) => <article key={report.id} className="space-y-3 border-b border-[#e8edf3] py-4">
      <p className="text-[13px] text-[#526175]">{new Date(report.createdAt).toLocaleString("ko-KR")}</p>
      <h2 className="text-[20px] font-semibold [overflow-wrap:anywhere]">{report.title ?? "삭제된 게시글"}</h2>
      <p className="whitespace-pre-wrap text-[16px] leading-6 [overflow-wrap:anywhere]">{(report.targetType === "comment" ? report.commentBody : report.postBody) ?? "작성자가 내용을 삭제했습니다."}</p>
      <div className="flex flex-wrap gap-2">{report.images.map((image) => <img key={image.mediaAssetId} src={image.url} alt="신고 게시글 첨부 사진" className="max-h-64 max-w-full rounded-[10px] object-contain" />)}</div>
      <p className="text-[14px] leading-5 [overflow-wrap:anywhere]">신고 사유: {report.reason}</p>
      <div className="flex flex-wrap gap-2"><button className={communityPrimary} disabled={busy || !!report.hidden || !(report.targetType === "comment" ? report.commentBody : report.postBody)} onClick={() => void review(report.id, "hide")}>{report.hidden ? "이미 숨겨진 내용" : "신고된 내용 숨기기"}</button><button className={communityButton} disabled={busy} onClick={() => void review(report.id, "dismiss")}>신고 종결</button></div>
    </article>)}
  </main>;
}
