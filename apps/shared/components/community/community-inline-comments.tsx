"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityApi, CommunityComment, CommunityCommentReaction, CommunityCommentVote, CommunityResponse } from "../../contracts/community";
import { CommentThread } from "../ui/reddit-nested-thread-reply";
import type { CommunityIntent } from "./community-detail";
import styles from "./community.module.css";

const PREVIEW_COUNT = 3;
const SERVER_PAGE_SIZE = 20;

type ThreadPage = { comments: CommunityComment[]; count: number; hasMore: boolean };

export type InlineCommentControls = {
  api: CommunityApi;
  base: string;
  authorName: string;
  revision: number;
  onCount: (postId: string, count: number) => void;
  onComment: (postId: string, id: string, body: string, parentId: string | null) => Promise<void>;
  onVote: (postId: string, commentId: string, value: CommunityCommentVote) => Promise<CommunityCommentReaction>;
  onModerate: (intent: CommunityIntent) => void;
};

export function CommunityInlineComments({ id, postId, busy, controls }: {
  id: string; postId: string; busy: boolean; controls: InlineCommentControls;
}) {
  const { api, base, authorName, revision, onCount, onComment, onVote, onModerate } = controls;
  const [pages, setPages] = useState<ThreadPage[]>([]);
  const [posted, setPosted] = useState<CommunityComment[]>([]);
  const [visibleCount, setVisibleCount] = useState(PREVIEW_COUNT);
  const [loading, setLoading] = useState(true);
  const [failedRead, setFailedRead] = useState<{ append: boolean; savedId?: string }>();
  const readRef = useRef<AbortController | null>(null);
  const pageCount = useRef(1);
  const postedIds = useRef(new Set<string>());

  const read = useCallback(async (append = false, savedId?: string) => {
    readRef.current?.abort();
    const request = new AbortController();
    readRef.current = request;
    const { signal } = request;
    setLoading(true);
    setFailedRead(undefined);

    const fetchPage = async (page: number): Promise<ThreadPage> => {
      const params = new URLSearchParams({ postId, page: String(page) });
      const result = await api<CommunityResponse>(`${base}&${params}`, { cache: "no-store", signal });
      if (result.post?.id !== postId) throw new Error("댓글을 불러오지 못했어요.");
      return { comments: result.comments ?? [], count: result.post.commentCount, hasMore: result.hasMore };
    };

    try {
      if (append) {
        const next = await fetchPage(pageCount.current);
        if (signal.aborted) return;
        pageCount.current += 1;
        setPages((previous) => [...previous, next]);
        setVisibleCount((count) => count + PREVIEW_COUNT);
        onCount(postId, next.count);
      } else {
        const refreshed = await Promise.all(Array.from({ length: pageCount.current }, (_, page) => fetchPage(page)));
        if (signal.aborted) return;
        setPages(refreshed);
        onCount(postId, refreshed[0].count);

        if (postedIds.current.size) {
          const own = refreshed.flatMap((page) => page.comments);
          const lastPage = Math.ceil(refreshed[0].count / SERVER_PAGE_SIZE) - 1;
          // The detail API lists oldest first. A new comment may be past the pages the reader has opened.
          const loadedIds = new Set(own.map((comment) => comment.id));
          if (lastPage >= refreshed.length && Array.from(postedIds.current).some((commentId) => !loadedIds.has(commentId))) {
            own.push(...(await fetchPage(lastPage)).comments);
          }
          if (signal.aborted) return;
          const confirmed = new Map(own.map((comment) => [comment.id, comment]));
          if (savedId && !confirmed.has(savedId)) throw new Error("등록한 댓글을 확인할 수 없어요.");
          setPosted(Array.from(postedIds.current).reverse().flatMap((commentId) => {
            const comment = confirmed.get(commentId);
            return comment ? [comment] : [];
          }));
        }
      }
    } catch {
      if (!signal.aborted) setFailedRead({ append, savedId });
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api, base, postId, onCount]);

  useEffect(() => {
    void read();
    return () => readRef.current?.abort();
  }, [read, revision]);

  const loaded = new Map(pages.flatMap((page) => page.comments).map((comment) => [comment.id, comment]));
  const visible = new Map(posted.map((comment) => [comment.id, comment]));
  for (const comment of Array.from(loaded.values()).slice(0, visibleCount)) visible.set(comment.id, comment);
  const hasMore = loaded.size > visibleCount || pages.at(-1)?.hasMore;
  const retry = failedRead && <div className={styles.inlineCommentMore}>
    <p role="alert" className={styles.inlineCommentStatus}>
      {failedRead.savedId ? "댓글은 등록됐어요. 목록을 다시 불러와 주세요." : "댓글을 불러오지 못했어요."}
    </p>
    <button type="button" className={styles.quietButton} disabled={busy} onClick={() => void read(failedRead.append, failedRead.savedId)}>다시 불러오기</button>
  </div>;

  return <section id={id} className={styles.inlineComments} aria-label="게시글 댓글">
    {!failedRead?.append && retry}
    {pages.length > 0 && <CommentThread
      comments={Array.from(visible.values())}
      authorName={authorName}
      busy={busy || loading}
      onComment={async (commentId, body, parentId) => {
        await onComment(postId, commentId, body, parentId);
        if (readRef.current?.signal.aborted) return;
        postedIds.current.add(commentId);
        await read(false, commentId);
      }}
      onVote={async (commentId, value) => {
        const reaction = await onVote(postId, commentId, value);
        const update = (comment: CommunityComment) => comment.id === reaction.id ? { ...comment, ...reaction } : comment;
        setPages((previous) => previous.map((page) => ({ ...page, comments: page.comments.map(update) })));
        setPosted((previous) => previous.map(update));
      }}
      onModerate={(action, targetId) => onModerate({ action, targetType: "comment", targetId })}
    />}
    {loading && pages.length === 0 && <p role="status" className={styles.inlineCommentStatus}>댓글을 불러오는 중이에요.</p>}
    {failedRead?.append && retry}
    {!failedRead && hasMore && <div className={styles.inlineCommentMore}>
      <button type="button" className={styles.quietButton} disabled={busy || loading} aria-busy={loading} onClick={() => {
        if (loaded.size > visibleCount) setVisibleCount((count) => count + PREVIEW_COUNT);
        else void read(true);
      }}>댓글 더 보기</button>
    </div>}
  </section>;
}
