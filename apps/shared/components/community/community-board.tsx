"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { MessageSquare, Search, SquarePen } from "lucide-react";
import { COMMUNITY_CATEGORIES, type CommunityApi, type CommunityPost, type CommunityResponse } from "../../contracts/community";
import { CommunityForm, communityButton, communityControl, communityPrimary, type CommunityDraft } from "./community-form";
import { CommunityDetail, communityDate, type CommunityIntent } from "./community-detail";

export default function CommunityBoard({ shopId, api, showTitle = true, backActionRef }: {
  shopId: string; api: CommunityApi; showTitle?: boolean; backActionRef?: RefObject<(() => boolean) | null>;
}) {
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [category, setCategory] = useState(""); const [search, setSearch] = useState(""); const [query, setQuery] = useState("");
  const [postId, setPostId] = useState<string | null>(null); const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<CommunityPost | "new" | null>(null);
  const [settings, setSettings] = useState(false); const [nickname, setNickname] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<CommunityIntent | null>(null); const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState(""); const dialogRef = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState(0); const sequence = useRef(0);
  const base = `/api/owner/community?shopId=${encodeURIComponent(shopId)}`;
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const current = ++sequence.current; const abort = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), q: query, category });
    if (postId) params.set("postId", postId);
    void api<CommunityResponse>(`${base}&${params}`, { cache: "no-store", signal: abort.signal }).then((result) => {
      if (current !== sequence.current || abort.signal.aborted) return;
      setData(result); setNickname(result.viewer.nickname); setLoading(false);
    }).catch((cause) => { if (!abort.signal.aborted && current === sequence.current) { setError(cause instanceof Error ? cause.message : "게시글을 불러오지 못했습니다."); setLoading(false); } });
    return () => { abort.abort(); sequence.current++; };
  }, [api, base, category, page, postId, query, revision]);
  useEffect(() => {
    const onFocus = () => setRevision((value) => value + 1);
    window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus);
  }, []);
  useEffect(() => {
    if (!intent) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => { previous?.focus(); };
  }, [intent]);
  const back = useCallback(() => {
    if (busy) return true;
    if (intent) { setIntent(null); return true; }
    if (editor) { setEditor(null); return true; }
    if (settings) { setSettings(false); return true; }
    if (postId) { setPostId(null); setPage(0); return true; }
    return false;
  }, [busy, editor, intent, postId, settings]);
  useEffect(() => { if (backActionRef) backActionRef.current = back; return () => { if (backActionRef) backActionRef.current = null; }; }, [back, backActionRef]);
  async function mutate(payload: unknown, photos: File[] = []) {
    setBusy(true);
    try {
      if (photos.length) {
        const form = new FormData(); form.set("payload", JSON.stringify(payload)); photos.forEach((file) => form.append("photos", file));
        return await api<{ id?: string }>(base, { method: "POST", body: form });
      }
      return await api<{ id?: string }>(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } finally { setBusy(false); }
  }
  async function save(draft: CommunityDraft) {
    const { photos, ...payload } = draft;
    const result = await mutate({ ...payload, action: editor === "new" ? "create_post" : "update_post" }, photos);
    setEditor(null); setPostId(result.id ?? draft.id); setPage(0); setNotice("게시글이 저장되었습니다."); refresh();
  }
  const openIntent = (value: CommunityIntent) => { setIntent(value); setReason(""); setDialogError(""); };
  return <section className="mx-auto w-full min-w-0 max-w-[960px] space-y-4 bg-white p-4 text-[#15213b] sm:p-5" data-community-board aria-label="펫매니저 커뮤니티">
    <div className="flex flex-wrap items-center justify-between gap-2">
      {showTitle && <h1 className="text-[24px] font-semibold leading-8">커뮤니티</h1>}
      {editor || postId || settings ? <button className={communityButton} disabled={busy} onClick={() => back()}>← {editor ? "돌아가기" : "목록"}</button> : <button className={`${communityButton} text-[#526175]`} disabled={loading} onClick={() => setSettings(true)}>내 닉네임·차단 관리</button>}
      {!editor && !postId && !settings && <button className={communityPrimary} disabled={loading || !!error} onClick={() => { setEditor("new"); setNotice(""); }}><SquarePen size={18} aria-hidden />글 쓰기</button>}
    </div>
    {notice && <p role="status" className="text-[14px] text-[#1f6b5b]">{notice}</p>}
    {editor ? <CommunityForm key={editor === "new" ? "new" : editor.id} post={editor === "new" ? undefined : editor} onSave={save} onCancel={() => setEditor(null)} /> : <>
      {!postId && !settings && <>
        <form className="flex gap-2" role="search" onSubmit={(event) => { event.preventDefault(); setPage(0); setQuery(search.trim()); }}><label className="sr-only" htmlFor="community-search">게시글 검색</label><input id="community-search" className={`${communityControl} min-w-0 flex-1`} placeholder="제목과 내용 검색" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="검색" className={`${communityButton} border border-[#dbe2ea]`}><Search size={20} aria-hidden /></button></form>
        <div className="flex flex-wrap gap-1" aria-label="말머리 필터">{[["", "전체"], ...Object.entries(COMMUNITY_CATEGORIES)].map(([key, label]) => <button key={key} type="button" aria-pressed={category === key} className={`${communityButton} ${category === key ? "bg-[#f1f3f7] text-[#15213b]" : "text-[#526175]"}`} onClick={() => { setCategory(key); setPage(0); }}>{label}</button>)}</div>
      </>}
      {loading ? <p role="status" className="py-8 text-[14px] text-[#526175]">커뮤니티를 불러오고 있습니다.</p> : error ? <div className="space-y-3 py-6"><p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p><button className={communityButton} onClick={refresh}>다시 시도</button></div> : settings && data ? <div className="space-y-5">
        <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); setError(""); try { await mutate({ action: "profile", nickname }); setNotice("닉네임이 저장되었습니다."); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); } }}><label className="block space-y-2 text-[14px] font-medium">닉네임<input required minLength={2} maxLength={24} disabled={busy} className={`${communityControl} block w-full`} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label><button disabled={busy} className={communityPrimary}>닉네임 저장</button></form>
        <section className="space-y-2"><h2 className="text-[16px] font-medium">차단한 이용자</h2>{data.blockedUsers.length ? data.blockedUsers.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 border-b border-[#e8edf3]"><span className="text-[14px] [overflow-wrap:anywhere]">{user.nickname}</span><button className={communityButton} disabled={busy} onClick={async () => { try { await mutate({ action: "unblock", id: user.id }); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "차단을 해제하지 못했습니다."); } }}>차단 해제</button></div>) : <p className="text-[14px] text-[#526175]">차단한 이용자가 없습니다.</p>}</section>
      </div> : postId && data?.post ? <CommunityDetail key={data.post.id} post={data.post} comments={data.comments ?? []} busy={busy} page={page} hasMore={data.hasMore} onPage={setPage} onEdit={() => setEditor(data.post!)} onIntent={openIntent} onComment={async (id, body) => { await mutate({ action: "create_comment", id, postId, body }); setNotice("댓글이 등록되었습니다."); refresh(); }} /> : <>
        {data?.posts?.length ? <div className="divide-y divide-[#e8edf3]">{data.posts.map((post) => <button key={post.id} type="button" className="block w-full space-y-2 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" onClick={() => { setPostId(post.id); setPage(0); setNotice(""); }}><p className="text-[13px] text-[#526175]">{COMMUNITY_CATEGORIES[post.category]}</p><h2 className="text-[16px] font-medium leading-6 [overflow-wrap:anywhere]">{post.title}</h2><p className="line-clamp-2 text-[14px] leading-5 text-[#526175] [overflow-wrap:anywhere]">{post.body}</p><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-[#526175]"><span className="[overflow-wrap:anywhere]">{post.authorName}</span><span>{communityDate(post.createdAt)}</span><span className="inline-flex items-center gap-1"><MessageSquare size={14} aria-hidden />댓글 {post.commentCount}</span>{post.images.length > 0 && <span>사진 {post.images.length}</span>}</div></button>)}</div> : <p className="py-10 text-center text-[16px] text-[#526175]">{query || category ? "조건에 맞는 글이 없습니다." : "아직 게시글이 없습니다. 첫 이야기를 남겨 주세요."}</p>}
        {(page > 0 || data?.hasMore) && <div className="flex items-center justify-center gap-3"><button className={communityButton} disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span className="text-[14px]">{page + 1}</span><button className={communityButton} disabled={!data?.hasMore} onClick={() => setPage(page + 1)}>다음</button></div>}
      </>}
    </>}
    {intent && <dialog ref={dialogRef} aria-label={intent.action === "report" ? "신고하기" : intent.action === "block" ? "작성자 차단" : "삭제하기"} onCancel={(event) => { event.preventDefault(); if (!busy) setIntent(null); }} className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-[420px] rounded-[14px] border border-[#e8edf3] bg-white p-5 text-[#15213b] backdrop:bg-black/30">
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault(); setDialogError("");
        try {
          const payload = intent.action.startsWith("delete_") ? { action: intent.action, id: intent.targetId } : { ...intent, reason };
          await mutate(payload); setIntent(null);
          if (intent.action === "delete_post" || intent.action === "block") { setPostId(null); setPage(0); }
          setNotice(intent.action === "report" ? "신고가 접수되었습니다. 운영자가 확인하겠습니다." : intent.action === "block" ? "작성자를 차단했습니다." : "삭제되었습니다."); refresh();
        } catch (cause) { setDialogError(cause instanceof Error ? cause.message : "처리하지 못했습니다."); }
      }}>
        <h2 className="text-[20px] font-semibold">{intent.action === "report" ? "신고하기" : intent.action === "block" ? "작성자를 차단할까요?" : "삭제할까요?"}</h2>
        {intent.action === "report" ? <label className="block space-y-2 text-[14px] font-medium">신고 사유<textarea required minLength={2} maxLength={500} className={`${communityControl} block w-full`} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></label> : <p className="text-[14px] leading-5 text-[#526175]">{intent.action === "block" ? "이 이용자와 서로의 글·댓글이 보이지 않습니다. 차단 관리에서 해제할 수 있습니다." : "삭제한 내용은 복구할 수 없습니다."}</p>}
        {dialogError && <p role="alert" className="text-[14px] text-[#9a5e4e]">{dialogError}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} className={communityButton} onClick={() => setIntent(null)}>취소</button><button type="submit" disabled={busy} className={communityPrimary}>{busy ? "처리 중…" : intent.action === "report" ? "신고 접수" : intent.action === "block" ? "차단하기" : "삭제하기"}</button></div>
      </form>
    </dialog>}
  </section>;
}
