"use client";
import { useRef } from "react";
import { IconPencil as Pencil, IconShieldExclamation as ShieldAlert, IconTrash as Trash2 } from "@tabler/icons-react";
import { type CommunityComment, type CommunityPost, type CommunityCommentVote } from "../../contracts/community";
import { CommentThread } from "../ui/reddit-nested-thread-reply";
import { communityButton } from "./community-form";
import { CommunityAuthor, communityDate } from "./community-presentation";
import styles from "./community.module.css";
import { CommunityPostActions, type CommunityReactionControls } from "./community-post-actions";

export { communityDate };
export type CommunityTarget = { targetType: "post" | "comment"; targetId: string };
export type CommunityIntent = CommunityTarget & { action: "report" | "block" | "delete_post" | "delete_comment" };
export function CommunityDetail({ post, comments, busy, page, hasMore, onPage, onEdit, onIntent, onComment, onVote, authorName, reactions }: {
  post: CommunityPost; comments: CommunityComment[]; busy: boolean; page: number; hasMore: boolean; authorName?: string;
  onPage: (page: number) => void; onEdit: () => void; onIntent: (intent: CommunityIntent) => void;
  onComment: (id: string, body: string, parentId: string | null) => Promise<void>;
  onVote: (commentId: string, value: CommunityCommentVote) => Promise<void>;
  reactions: CommunityReactionControls;
}) {
  const commentRef = useRef<HTMLTextAreaElement>(null);
  return <article className={styles.detail}>
    <section className={styles.article}>
      <h2>{post.title}</h2>
      <CommunityAuthor name={post.authorName} date={post.createdAt} mine={post.isMine} />
      {post.updatedAt !== post.createdAt && <p className={styles.meta}>수정됨 · {communityDate(post.updatedAt)}</p>}
      <p className={styles.articleBody}>{post.body}</p>
      {post.images.length > 0 && <div className={styles.articleImages}>{post.images.map((image, i) => <img key={image.mediaAssetId} src={image.url} alt={"게시글 첨부 사진 " + (i + 1)} />)}</div>}
      <div className={styles.detailReactions}><CommunityPostActions post={post} onComment={() => commentRef.current?.focus()} {...reactions} /></div>
      <div className={styles.articleActions}>{post.isMine ? <><button type="button" className={communityButton} disabled={busy} onClick={onEdit}><Pencil size={15} aria-hidden />수정</button><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "delete_post", targetType: "post", targetId: post.id })}><Trash2 size={15} aria-hidden />삭제</button></> : <><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "report", targetType: "post", targetId: post.id })}><ShieldAlert size={15} aria-hidden />신고</button><button type="button" className={communityButton} disabled={busy} onClick={() => onIntent({ action: "block", targetType: "post", targetId: post.id })}>작성자 차단</button></>}</div>
    </section>
    <section aria-label="댓글">
      <div className={styles.commentsTitle}><h3>댓글 <span>{post.commentCount}</span></h3><span>등록순</span></div>
      <CommentThread comments={comments} authorName={authorName ?? "내 계정"} busy={busy} inputRef={commentRef}
        onComment={onComment} onVote={onVote}
        onModerate={(action, targetId) => onIntent({ action, targetType: "comment", targetId })} />
      {(page > 0 || hasMore) && <nav className={styles.pagination} aria-label="댓글 페이지"><button type="button" className={communityButton} disabled={busy || page === 0} onClick={() => onPage(page - 1)}>이전 댓글</button><span>{page + 1} 페이지</span><button type="button" className={communityButton} disabled={busy || !hasMore} onClick={() => onPage(page + 1)}>다음 댓글</button></nav>}
    </section>
  </article>;
}
