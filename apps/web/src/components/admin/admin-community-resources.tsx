"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus as Plus } from "@tabler/icons-react";
import { fetchApiJson } from "@/lib/api";
import type { CommunityResource, CommunityResourcesResponse } from "@petmanager/shared/contracts/community";
import { communityButton, communityControl, communityPrimary } from "@petmanager/shared/components/community/community-form";

type Draft = Pick<CommunityResource, "id" | "title" | "body" | "sourceUrl" | "closesOn" | "published">;
const endpoint = "/api/admin/community/resources";
function ResourceEditor({ resource, busy, onSave, onCancel }: { resource: CommunityResource | "new"; busy: boolean; onSave: (draft: Draft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => resource === "new" ? { id: crypto.randomUUID(), title: "", body: "", sourceUrl: "", closesOn: null, published: true } : resource);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  return <form className="grid gap-4 rounded-[14px] border border-[#e8edf3] p-4" onSubmit={async (event) => { event.preventDefault(); if (busy || submitting.current) return; submitting.current = true; setError(""); try { await onSave(draft); } catch (cause) { setError(cause instanceof Error ? cause.message : "소식을 저장하지 못했습니다."); } finally { submitting.current = false; } }}>
    <h3 className="text-[20px] font-semibold">{resource === "new" ? "정보 올리기" : "소식 수정"}</h3>
    <label className="grid gap-2 text-[14px]">제목<input required maxLength={100} className={communityControl} value={draft.title} disabled={busy} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="grid gap-2 text-[14px]">내용<textarea required maxLength={5000} rows={7} className={communityControl} value={draft.body} disabled={busy} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
    <label className="grid gap-2 text-[14px]">공고 원문 링크 · 선택<input type="url" maxLength={2000} placeholder="https://" className={communityControl} value={draft.sourceUrl} disabled={busy} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} /></label>
    <label className="grid gap-2 text-[14px]">접수 마감일 · 선택<input type="date" className={communityControl} value={draft.closesOn ?? ""} disabled={busy} onChange={(e) => setDraft({ ...draft, closesOn: e.target.value || null })} /></label>
    <label className="flex min-h-11 items-center gap-3 text-[14px]"><input type="checkbox" checked={draft.published} disabled={busy} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />커뮤니티에 게시</label>
    {error && <p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={communityButton} disabled={busy} onClick={onCancel}>취소</button><button type="submit" className={communityPrimary} disabled={busy || !draft.title.trim() || !draft.body.trim()}>{busy ? "저장 중…" : draft.published ? "게시하기" : "숨김으로 저장"}</button></div>
  </form>;
}

export default function AdminCommunityResources() {
  const [data, setData] = useState<CommunityResourcesResponse | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<CommunityResource | "new" | null>(null);
  const [busy, setBusy] = useState(false); const mutating = useRef(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = useCallback(async () => { try { setData(await fetchApiJson<CommunityResourcesResponse>(`${endpoint}?page=${page}`, { cache: "no-store" })); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "소식을 불러오지 못했습니다."); } }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function save(draft: Draft, source = editing) {
    if (mutating.current) return; mutating.current = true; setBusy(true);
    try {
      const create = source === "new";
      await fetchApiJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, action: create ? "create" : "update", expectedUpdatedAt: source && source !== "new" ? source.updatedAt : undefined }) });
      setEditing(null); setNotice(draft.published ? "소식이 게시되었습니다." : "소식이 숨겨졌습니다."); await load();
    } finally { mutating.current = false; setBusy(false); }
  }
  return <section className="grid gap-4" aria-label="소식 관리">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[20px] font-semibold">지원금·운영 소식</h2><button type="button" className={communityPrimary} disabled={busy || !!editing} onClick={() => { setEditing("new"); setNotice(""); }}><Plus size={16} aria-hidden />정보 올리기</button></div>
    {notice && <p role="status" className="text-[14px] text-[#1f6b5b]">{notice}</p>}
    {error && <div><p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p><button type="button" className={communityButton} onClick={() => void load()}>다시 시도</button></div>}
    {editing && <ResourceEditor key={editing === "new" ? "new" : editing.id} resource={editing} busy={busy} onSave={save} onCancel={() => setEditing(null)} />}
    {!editing && (!data && !error ? <p role="status">소식을 불러오고 있습니다.</p> : data?.resources.length === 0 ? <p className="py-6 text-[14px] text-[#64748b]">등록한 소식이 없습니다.</p> : data?.resources.map((resource) => <article key={resource.id} className="grid gap-3 border-b border-[#e8edf3] py-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#64748b]"><span>{resource.published ? "게시 중" : "숨김"}</span>{resource.closesOn && <span>{resource.closed ? "마감" : "접수 마감일"} · {resource.closesOn}</span>}</div>
      <h3 className="text-[16px] font-medium [overflow-wrap:anywhere]">{resource.title}</h3><p className="whitespace-pre-wrap text-[14px] leading-6 [overflow-wrap:anywhere]">{resource.body.slice(0, 180)}</p>
      <div className="flex gap-2"><button type="button" className={communityButton} disabled={busy} onClick={() => { setEditing(resource); setNotice(""); }}>수정</button><button type="button" className={communityButton} disabled={busy} onClick={() => { setError(""); void save({ ...resource, published: !resource.published }, resource).catch((cause) => setError(cause instanceof Error ? cause.message : "소식 상태를 저장하지 못했습니다.")); }}>{resource.published ? "숨기기" : "다시 게시"}</button></div>
    </article>))}
    {!editing && data && (data.page > 0 || data.hasMore) && <nav className="flex items-center justify-center gap-3" aria-label="관리 소식 페이지"><button type="button" className={communityButton} disabled={busy || data.page === 0} onClick={() => setPage(data.page - 1)}>이전</button><span>{data.page + 1}</span><button type="button" className={communityButton} disabled={busy || !data.hasMore} onClick={() => setPage(data.page + 1)}>다음</button></nav>}
  </section>;
}
