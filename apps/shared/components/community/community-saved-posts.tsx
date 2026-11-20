"use client";
import { useEffect, useRef, useState } from "react";
import { IconBookmarkFilled, IconLoader2 } from "@tabler/icons-react";
import type { CommunityApi, CommunityPost, CommunityReaction, CommunityResponse } from "../../contracts/community";
import { communityButton } from "./community-form";
import { CommunityStatus } from "./community-presentation";
import styles from "./community.module.css";

export function CommunitySavedPosts({ shopId, api, refreshVersion, busy, onOpen, onToggleSave }: {
  shopId: string; api: CommunityApi; refreshVersion: number; busy: boolean;
  onOpen: (id: string) => void; onToggleSave: (post: CommunityPost) => Promise<CommunityReaction | undefined>;
}) {
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [page, setPage] = useState(0); const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const changing = useRef(false); const read = useRef<AbortController | null>(null);
  const base = `/api/owner/community?shopId=${encodeURIComponent(shopId)}&savedOnly=true`;
  useEffect(() => {
    const abort = new AbortController(); read.current = abort;
    void api<CommunityResponse>(`${base}&page=${page}`, { cache: "no-store", signal: abort.signal }).then((result) => {
      if (!abort.signal.aborted) { setData(result); setError(""); setLoading(false); }
    }).catch((cause) => { if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "저장한 글을 불러오지 못했습니다."); setLoading(false); } });
    return () => abort.abort();
  }, [api, base, page, refreshVersion, revision]);
  useEffect(() => { const refresh = () => { if (!changing.current) setRevision((value) => value + 1); }; window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, []);
  async function unsave(post: CommunityPost) {
    if (busy || changing.current) return;
    changing.current = true; read.current?.abort(); setPendingId(post.id); setError("");
    try {
      const result = await onToggleSave(post);
      if (!result || result.saved) throw new Error("저장을 해제하지 못했습니다. 다시 시도해 주세요.");
      setData((previous) => previous ? { ...previous, posts: previous.posts?.filter((item) => item.id !== post.id) } : previous);
      if (data?.page && data.posts?.length === 1) { setLoading(true); setPage(data.page - 1); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장을 해제하지 못했습니다."); }
    finally { changing.current = false; setPendingId(null); }
  }
  function changePage(next: number) { setLoading(true); setPage(next); }
  return <div data-community-saved>
    {error && <div className={styles.resourceError}><p role="alert">{error}</p><button type="button" className={communityButton} onClick={() => setRevision((value) => value + 1)}>다시 시도</button></div>}
    {loading ? <p className={styles.resourceEmpty} role="status">저장한 글을 불러오고 있습니다.</p> : data?.posts?.length ? <div className={styles.savedList}>{data.posts.map((post) => <article key={post.id} className={styles.savedItem} data-saved-post={post.id}>
      <button type="button" className={styles.savedOpen} aria-label={`저장한 게시글 열기: ${post.title}`} disabled={busy} onClick={() => onOpen(post.id)}>
        <span className={styles.savedText}><span className={styles.savedAuthor}>{post.authorName}</span><span className={styles.savedTitle}>{post.title}</span><span className={styles.savedExcerpt}>{post.body}</span></span>
        {post.images[0] && <img src={post.images[0].url} alt="" className={styles.savedThumb} loading="lazy" />}
      </button>
      <button type="button" className={styles.savedRemove} data-owner-control-size="content" aria-label={`저장 해제: ${post.title}`} title="저장 해제" aria-pressed={true} disabled={busy || !!pendingId} onClick={() => void unsave(post)}>{pendingId === post.id ? <IconLoader2 size={18} className={styles.loadingIcon} aria-hidden /> : <IconBookmarkFilled size={18} aria-hidden />}</button>
    </article>)}</div> : !error && <CommunityStatus kind="saved" title="저장한 글이 없어요" description="다시 보고 싶은 글은 저장 버튼을 눌러 모아보세요." />}
    {data && (data.page > 0 || data.hasMore) && <nav className={styles.resourcePagination} aria-label="저장한 글 페이지"><button type="button" className={communityButton} disabled={busy || loading || data.page === 0} onClick={() => changePage(data.page - 1)}>이전</button><span>{data.page + 1}</span><button type="button" className={communityButton} disabled={busy || loading || !data.hasMore} onClick={() => changePage(data.page + 1)}>다음</button></nav>}
  </div>;
}
