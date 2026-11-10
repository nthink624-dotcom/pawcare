"use client";
import { useState } from "react";
import { COMMUNITY_CATEGORIES, type CommunityComment, type CommunityPost } from "../../contracts/community";
import { communityButton, communityControl, communityPrimary } from "./community-form";

export function communityDate(value: string) { return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
export type CommunityTarget = { targetType: "post" | "comment"; targetId: string };
export type CommunityIntent = CommunityTarget & { action: "report" | "block" | "delete_post" | "delete_comment" };
export function CommunityDetail({ post, comments, busy, page, hasMore, onPage, onEdit, onIntent, onComment }: {
  post: CommunityPost; comments: CommunityComment[]; busy: boolean; page: number; hasMore: boolean;
  onPage: (page: number) => void; onEdit: () => void; onIntent: (intent: CommunityIntent) => void;
  onComment: (id: string, body: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [commentId, setCommentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  return <article className="space-y-4">
    <div className="space-y-2"><p className="text-[13px] text-[#526175]">{COMMUNITY_CATEGORIES[post.category]}</p><h2 className="text-[20px] font-semibold leading-7 [overflow-wrap:anywhere]">{post.title}</h2><p className="text-[13px] text-[#526175]">{post.authorName} · {communityDate(post.createdAt)}{post.updatedAt !== post.createdAt ? " · 수정됨" : ""}</p></div>
    <p className="whitespace-pre-wrap text-[16px] font-normal leading-6 [overflow-wrap:anywhere]">{post.body}</p>
    {post.images.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{post.images.map((image, i) => <img key={image.mediaAssetId} src={image.url} alt={`게시글 첨부 사진 ${i + 1}`} className="max-h-[480px] w-full rounded-[10px] object-contain" />)}</div>}
    <div className="flex flex-wrap gap-1 text-[#526175]">{post.isMine ? <><button type="button" className={communityButton} disabled={busy} onClick={onEdit}>수정</button><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "delete_post", targetType: "post", targetId: post.id })}>삭제</button></> : <><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "report", targetType: "post", targetId: post.id })}>신고</button><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "block", targetType: "post", targetId: post.id })}>작성자 차단</button></>}</div>
    <section className="space-y-3 border-t border-[#e8edf3] pt-4" aria-label="댓글"><h3 className="text-[16px] font-medium">댓글 {post.commentCount}</h3>
      {comments.length === 0 && <p className="text-[14px] text-[#526175]">아직 댓글이 없습니다.</p>}
      {comments.map((item) => <div key={item.id} className="space-y-1 border-b border-[#e8edf3] pb-3"><p className="text-[13px] text-[#526175]">{item.authorName} · {communityDate(item.createdAt)}</p><p className="whitespace-pre-wrap text-[16px] leading-6 [overflow-wrap:anywhere]">{item.body}</p><div className="flex flex-wrap gap-1 text-[#526175]">{item.isMine ? <button className={communityButton} disabled={busy} onClick={() => onIntent({ action: "delete_comment", targetType: "comment", targetId: item.id })}>삭제</button> : <><button className={communityButton} disabled={busy} onClick={() => onIntent({ action: "report", targetType: "comment", targetId: item.id })}>신고</button><button className={communityButton} disabled={busy} onClick={() => onIntent({ action: "block", targetType: "comment", targetId: item.id })}>작성자 차단</button></>}</div></div>)}
      {(page > 0 || hasMore) && <div className="flex gap-2"><button className={communityButton} disabled={busy || page === 0} onClick={() => onPage(page - 1)}>이전 댓글</button><button className={communityButton} disabled={busy || !hasMore} onClick={() => onPage(page + 1)}>다음 댓글</button></div>}
      <form className="space-y-2" onSubmit={async (event) => { event.preventDefault(); setError(""); try { await onComment(commentId, comment.trim()); setComment(""); setCommentId(crypto.randomUUID()); } catch (cause) { setError(cause instanceof Error ? cause.message : "댓글을 등록하지 못했습니다."); } }}>
        <label className="block space-y-2 text-[14px] font-medium">댓글 쓰기<textarea required rows={3} maxLength={2000} disabled={busy} className={`${communityControl} block w-full`} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        {error && <p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p>}
        <button className={communityPrimary} type="submit" disabled={busy || !comment.trim()}>댓글 등록</button>
      </form>
    </section>
  </article>;
}
