"use client";
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { IconArrowLeft, IconPencilPlus } from "@tabler/icons-react";
import { type CommunityApi, type CommunityPost, type CommunityResponse, type CommunityMutationResult, type CommunityReactionAction, type CommunityCommentVote } from "../../contracts/community";
import { CommunityForm, communityButton, communityControl, communityPrimary, type CommunityDraft } from "./community-form";
import { CommunityDetail, type CommunityIntent } from "./community-detail";
import { CommunityAvatar, CommunityNotice, CommunityStatus } from "./community-presentation";
import { CommunitySettings } from "./community-settings";
import { CommunitySidebar, type CommunitySideView } from "./community-sidebar";
import { CommunityFeed } from "./community-feed";
import styles from "./community.module.css";

export default function CommunityBoard({ shopId, api, shopName, showTitle = true, backActionRef, profileView }: {
  shopId: string; api: CommunityApi; shopName?: string; showTitle?: boolean; backActionRef?: RefObject<(() => boolean) | null>;
  profileView?: { open: boolean; onOpenChange: (open: boolean) => void };
}) {
  const areaId = useId();
  const [selectedArea, setSelectedArea] = useState<"discussion" | "resources">("discussion");
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [sideView, setSideView] = useState<CommunitySideView>("saved");
  const [savedRevision, setSavedRevision] = useState(0);
  const [actionError, setActionError] = useState("");
  const [pendingReaction, setPendingReaction] = useState<{ postId: string; action: CommunityReactionAction } | null>(null);
  const reactingRef = useRef(false);
  const loadedViewRef = useRef("");
  const activeReadRef = useRef<AbortController | null>(null);
  const [postId, setPostId] = useState<string | null>(null); const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<CommunityPost | "new" | null>(null);
  const [localProfileOpen, setLocalProfileOpen] = useState(false);
  const settings = profileView?.open ?? localProfileOpen;
  const setSettings = profileView?.onOpenChange ?? setLocalProfileOpen;
  const profileHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeArea = settings ? "discussion" : selectedArea;
  const selectArea = (area: "discussion" | "resources") => {
    if (area === "resources" && settings) setSettings(false);
    setSelectedArea(area);
  };
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<CommunityIntent | null>(null); const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState(""); const dialogRef = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState(0); const sequence = useRef(0);
  const base = `/api/owner/community?shopId=${encodeURIComponent(shopId)}`;
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const current = ++sequence.current; const abort = new AbortController();
    activeReadRef.current = abort;
    const view = JSON.stringify([base, page, postId]);
    const backgroundRead = loadedViewRef.current === view;
    if (!backgroundRead) setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (postId) params.set("postId", postId);
    void api<CommunityResponse>(`${base}&${params}`, { cache: "no-store", signal: abort.signal }).then((result) => {
      if (current !== sequence.current || abort.signal.aborted) return;
      loadedViewRef.current = view;
      setData(result); setLoading(false); setActionError("");
    }).catch((cause) => { if (!abort.signal.aborted && current === sequence.current) {
      const message = cause instanceof Error ? cause.message : "게시글을 불러오지 못했습니다.";
      const denied = cause && typeof cause === "object" && "status" in cause && Number(cause.status) >= 400 && Number(cause.status) < 500;
      if (backgroundRead && !denied) setActionError(message);
      else setError(message);
      setLoading(false);
    } });
    return () => { abort.abort(); sequence.current++; };
  }, [api, base, page, postId, revision]);
  useEffect(() => {
    const onFocus = () => { if (!reactingRef.current) setRevision((value) => value + 1); };
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
    if (activeArea === "resources") { setSelectedArea("discussion"); return true; }
    if (intent) { setIntent(null); return true; }
    if (settings) { setSettings(false); return true; }
    if (editor) { setEditor(null); return true; }
    if (postId) { setPostId(null); setPage(0); return true; }
    return false;
  }, [busy, editor, intent, postId, settings, setSettings, activeArea]);
  useEffect(() => { if (backActionRef) backActionRef.current = back; return () => { if (backActionRef) backActionRef.current = null; }; }, [back, backActionRef]);
  useEffect(() => {
    if (settings) profileHeadingRef.current?.focus();
  }, [settings]);
  async function mutate(payload: unknown, photos: File[] = []) {
    setBusy(true);
    try {
      if (photos.length) {
        const form = new FormData(); form.set("payload", JSON.stringify(payload)); photos.forEach((file) => form.append("photos", file));
        return await api<CommunityMutationResult>(base, { method: "POST", body: form });
      }
      return await api<CommunityMutationResult>(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } finally { setBusy(false); }
  }
  async function save(draft: CommunityDraft) {
    const { photos, ...payload } = draft;
    const result = await mutate({ ...payload, action: editor === "new" ? "create_post" : "update_post" }, photos);
    setEditor(null); setPostId(result.id ?? draft.id); setPage(0); setNotice("게시글이 저장되었습니다."); refresh();
  }
  const openIntent = (value: CommunityIntent) => { setIntent(value); setReason(""); setDialogError(""); };
  const openEditor = () => { setSelectedArea("discussion"); setEditor("new"); setNotice(""); setActionError(""); };
  const openProfile = () => { setSettings(true); setNotice(""); setActionError(""); };
  const openPost = (id: string) => { if (editor) return; setSelectedArea("discussion"); setSettings(false); setPostId(id); setPage(0); setNotice(""); setActionError(""); };
  async function reactToPost(post: CommunityPost, action: CommunityReactionAction) {
    if (busy || loading || reactingRef.current) return;
    activeReadRef.current?.abort(); sequence.current++;
    reactingRef.current = true; setActionError(""); setNotice("");
    setPendingReaction({ postId: post.id, action });
    try {
      const result = await mutate({ action, postId: post.id, active: action === "like" ? !post.liked : !post.saved });
      const reaction = result.reaction;
      if (!reaction || reaction.id !== post.id) throw new Error("반응 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
      setData((previous) => {
        if (!previous) return previous;
        const update = (item: CommunityPost) => item.id === reaction.id ? { ...item, ...reaction } : item;
        return { ...previous, posts: previous.posts?.map(update), post: previous.post ? update(previous.post) : undefined };
      });
      if (action === "save") {
        setNotice(reaction.saved ? "게시물을 저장했습니다." : "저장을 해제했습니다.");
        setSavedRevision((value) => value + 1);
      }
      return reaction;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "반응을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      reactingRef.current = false; setPendingReaction(null);
    }
  }
  async function voteOnComment(commentId: string, value: CommunityCommentVote) {
    if (busy || loading || reactingRef.current || !postId) return;
    activeReadRef.current?.abort(); sequence.current++;
    reactingRef.current = true; setActionError("");
    try {
      const result = await mutate({ action: "vote_comment", postId, commentId, value });
      if (!result.commentReaction || result.commentReaction.id !== commentId) throw new Error("추천 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
      const reaction = result.commentReaction;
      setData((previous) => previous ? { ...previous, comments: previous.comments?.map((comment) => comment.id === commentId ? { ...comment, ...reaction } : comment) } : previous);
    } finally { reactingRef.current = false; }
  }
  const reactionControls = (post: CommunityPost) => ({
    busy: busy || loading,
    pendingAction: pendingReaction?.postId === post.id ? pendingReaction.action : undefined,
    onReact: reactToPost,
  });
  const noShop = error === "소유한 매장이 없습니다.";
  const showFeed = !postId && !settings && !editor;
  const showComposer = showFeed && !loading && !error && !!data;
  return <section className={styles.root} data-community-board aria-label="사장님 라운지">
    <div className={styles.areaTabs} role="tablist" aria-label="라운지 영역" onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); const nextArea = activeArea === "discussion" ? "resources" : "discussion"; selectArea(nextArea);
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-area="${nextArea}"]`)?.focus();
    }}>
      <button type="button" role="tab" data-owner-control-size="content" id={areaId + "-discussion-tab"} aria-selected={activeArea === "discussion"} aria-controls={areaId + "-discussion"} data-area="discussion" tabIndex={activeArea === "discussion" ? 0 : -1} onClick={() => selectArea("discussion")}>게시글</button>
      <button type="button" role="tab" data-owner-control-size="content" id={areaId + "-resources-tab"} aria-selected={activeArea === "resources"} aria-controls={areaId + "-resources"} data-area="resources" tabIndex={activeArea === "resources" ? 0 : -1} onClick={() => selectArea("resources")}>모아보기</button>
    </div>
    <div className={styles.workspace}>
    <section className={styles.discussionPanel} id={areaId + "-discussion"} role="tabpanel" aria-label="라운지 게시글" data-area-active={activeArea === "discussion"} data-discussion-panel>
    {settings && <header className={styles.heading}>
      {showTitle ? <h1 ref={profileHeadingRef} tabIndex={-1}>내 라운지 프로필</h1> : <h2 ref={profileHeadingRef} tabIndex={-1}>내 라운지 프로필</h2>}
    </header>}
    {notice && <CommunityNotice>{notice}</CommunityNotice>}
    {actionError && <p role="alert" className={styles.actionError}>{actionError}</p>}
    {showComposer && <div className={styles.composer}>
      <button type="button" className={styles.composerProfile} data-owner-control-size="content" onClick={openProfile} disabled={busy} aria-label={`${data.viewer.nickname} 프로필`}>
        <CommunityAvatar name={data.viewer.nickname} />
      </button>
      <button type="button" className={styles.composerTrigger} data-owner-control-size="content" onClick={openEditor} disabled={busy} aria-label="글 쓰기">
        <span className={styles.composerPrompt}>어떤 이야기를 나눠볼까요?</span>
        <span className={styles.composerAction}><IconPencilPlus size={18} stroke={1.7} aria-hidden />글 쓰기</span>
      </button>
    </div>}
    <div className={styles.boardContent}><div className={styles.content}>
      {(settings || (postId && !editor)) && <div className={styles.backRow}><button type="button" className={styles.quietButton} disabled={busy} onClick={() => back()}><IconArrowLeft size={17} aria-hidden />{settings && (postId || editor) ? "뒤로" : "목록"}</button></div>}
      {editor && <div hidden={settings}><CommunityForm key={editor === "new" ? "new" : editor.id} post={editor === "new" ? undefined : editor} authorName={data?.viewer.nickname} onSave={save} onCancel={() => setEditor(null)} /></div>}
      {(!editor || settings) && <>
        {loading ? <div className={styles.loading} role="status"><span className="sr-only">라운지를 불러오고 있습니다.</span>{[0, 1].map((item) => <div className={styles.skeleton} key={item} aria-hidden><span /><span /><span /></div>)}</div> : error ? <div className={styles.feedState}><CommunityStatus kind={noShop ? "no-shop" : "error"} title={noShop ? "연결된 매장이 없습니다" : "게시글을 불러오지 못했어요"} description={noShop ? "매장을 연결하면 사장님들과 이야기를 나눌 수 있어요." : undefined} onRetry={refresh} /></div> : settings && data ? <CommunitySettings nickname={data.viewer.nickname} shopName={shopName} blockedUsers={data.blockedUsers} busy={busy} onSave={async (nickname) => { await mutate({ action: "profile", nickname }); setNotice("표시 이름을 저장했어요."); refresh(); }} onUnblock={async (id) => { await mutate({ action: "unblock", id }); refresh(); }} /> : postId && data?.post ? <CommunityDetail key={data.post.id} post={data.post} comments={data.comments ?? []} busy={busy} page={page} hasMore={data.hasMore} onPage={setPage} onEdit={() => setEditor(data.post!)} onIntent={openIntent} authorName={data.viewer.nickname} reactions={reactionControls(data.post)} onVote={voteOnComment} onComment={async (id, body, parentId) => { await mutate({ action: "create_comment", id, postId, body, parentId }); setNotice("댓글이 등록되었습니다."); refresh(); }} /> : <>
          {data?.posts?.length ? <CommunityFeed posts={data.posts} controls={reactionControls} onOpen={openPost} /> : <div className={styles.feedState}><CommunityStatus kind="feed" title="아직 올라온 이야기가 없어요" /></div>}
          {(page > 0 || data?.hasMore) && <nav className={styles.pagination} aria-label="게시글 페이지"><button type="button" className={communityButton} disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} 페이지</span><button type="button" className={communityButton} disabled={!data?.hasMore} onClick={() => setPage(page + 1)}>다음</button></nav>}
        </>}
      </>}
    </div></div>
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
    </section>
    <aside className={styles.resourcesPanel} id={areaId + "-resources"} role="tabpanel" aria-label="모아보기" data-area-active={activeArea === "resources"} data-resources-panel data-community-sidebar><CommunitySidebar shopId={shopId} api={api} view={sideView} onViewChange={setSideView} refreshVersion={savedRevision} busy={busy || loading || !!editor} onOpen={openPost} onToggleSave={(post) => reactToPost(post, "save")} requiresShop={noShop} /></aside>
    </div>
  </section>;
}
