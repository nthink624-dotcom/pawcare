"use client";

import { useId, useRef, useState, type RefObject } from "react";
import {
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconDots,
  IconMessage2 as MessageSquare,
  IconArrowBackUp as Reply,
} from "@tabler/icons-react";
import type { CommunityComment, CommunityCommentVote } from "../../contracts/community";
import { SocialCard } from "./social-card";
import styles from "./reddit-nested-thread-reply.module.css";

export type CommentType = CommunityComment;
type ModerationAction = "report" | "block" | "delete_comment";
type ThreadProps = {
  comments: CommentType[];
  authorName: string;
  busy: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onComment: (id: string, body: string, parentId: string | null) => Promise<void>;
  onVote: (commentId: string, value: CommunityCommentVote) => Promise<void>;
  onModerate: (action: ModerationAction, commentId: string) => void;
};

const commentDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

function CommentActionsMenu({ comment, busy, onModerate }: Pick<ThreadProps, "busy" | "onModerate"> & { comment: CommentType }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const select = (action: ModerationAction) => {
    setOpen(false);
    triggerRef.current?.focus();
    onModerate(action, comment.id);
  };

  return <div className={styles.more} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  }}>
    <button ref={triggerRef} type="button" aria-label="댓글 더보기" aria-expanded={open} aria-controls={open ? panelId : undefined} disabled={busy} onClick={() => setOpen((value) => !value)}>
      <IconDots size={20} aria-hidden />
    </button>
    {open && <div id={panelId} className={styles.morePanel} role="group" aria-label="댓글 관리">
      {comment.isMine ? <button type="button" disabled={busy} onClick={() => select("delete_comment")}>삭제</button> : <>
        <button type="button" disabled={busy} onClick={() => select("report")}>신고</button>
        <button type="button" disabled={busy} onClick={() => select("block")}>차단</button>
      </>}
    </div>}
  </div>;
}

function CommentComposer({ authorName, busy, parentId = null, inputRef, onComment, onCancel, onDone }: Pick<ThreadProps, "authorName" | "busy" | "inputRef" | "onComment"> & {
  parentId?: string | null; onCancel?: () => void; onDone?: () => void;
}) {
  const generatedId = useId();
  const fieldId = parentId ? generatedId : "community-comment";
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const mutationId = useRef<string | null>(null);
  const submitting = useRef(false);
  return <form className={styles.composer} onSubmit={async (event) => {
    event.preventDefault();
    if (busy || submitting.current || !body.trim()) return;
    submitting.current = true; setPending(true); setError("");
    mutationId.current ??= crypto.randomUUID();
    try {
      await onComment(mutationId.current, body.trim(), parentId);
      setBody(""); mutationId.current = null; onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 등록하지 못했습니다. 다시 시도해 주세요.");
    } finally { submitting.current = false; setPending(false); }
  }}>
    <label htmlFor={fieldId}>{parentId ? "답글 쓰기" : "댓글 쓰기"}</label>
    <textarea ref={inputRef} id={fieldId} value={body} rows={3} maxLength={2000} required disabled={pending}
      placeholder={parentId ? "답글을 남겨 주세요." : "경험이나 생각을 나눠 주세요."}
      onChange={(event) => { setBody(event.target.value); }}
      aria-describedby={error ? `${generatedId}-error` : undefined} />
    {error && <p className={styles.error} id={`${generatedId}-error`} role="alert">{error}</p>}
    <div className={styles.composerFooter}>
      <span>{authorName}으로 작성</span>
      <div>
        {onCancel ? <button type="button" disabled={pending} onClick={onCancel}>취소</button> : <button type="button" disabled={pending || !body} onClick={() => { setBody(""); setError(""); mutationId.current = null; }}>지우기</button>}
        <button type="submit" className={styles.primary} disabled={busy || pending || !body.trim()}>
          <MessageSquare size={16} aria-hidden />{pending ? "등록 중…" : parentId ? "답글 등록" : "댓글 등록"}
        </button>
      </div>
    </div>
  </form>;
}

function CommentRow({ comment, childrenByParent, depth, parentName, ...props }: ThreadProps & {
  comment: CommentType; childrenByParent: Map<string, CommentType[]>; depth: number; parentName?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [replying, setReplying] = useState(false);
  const [voteError, setVoteError] = useState("");
  const voting = useRef(false);
  const children = childrenByParent.get(comment.id) ?? [];
  const childId = useId();
  async function vote(value: -1 | 1) {
    if (props.busy || voting.current) return;
    voting.current = true; setVoteError("");
    try { await props.onVote(comment.id, comment.vote === value ? 0 : value); }
    catch (cause) { setVoteError(cause instanceof Error ? cause.message : "추천을 저장하지 못했습니다."); }
    finally { voting.current = false; }
  }
  const collapseButton = children.length > 0 && <button type="button" className={styles.collapse} aria-expanded={expanded} aria-controls={childId} onClick={() => setExpanded((value) => !value)}>
    {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}{expanded ? "답글 접기" : `답글 ${children.length}개 펼치기`}
  </button>;
  const author = comment.unavailable ? undefined : {
    name: comment.authorName,
    avatar: <span className={styles.avatar} aria-hidden>{Array.from(comment.authorName).slice(0, 2).join("")}</span>,
    dateTime: comment.createdAt,
    dateLabel: commentDateFormatter.format(new Date(comment.createdAt)),
    badges: <>
      {comment.isPostAuthor && <span className={styles.badge}>글쓴이</span>}
      {comment.isMine && <span className={styles.mine}>내 댓글</span>}
    </>,
  };

  return <div className={styles.branch} data-comment-id={comment.id}>
    <SocialCard
      label={comment.unavailable ? "볼 수 없는 댓글" : `${comment.authorName}님의 댓글`}
      author={author}
      more={author && <CommentActionsMenu comment={comment} busy={props.busy} onModerate={props.onModerate} />}
      actions={comment.unavailable ? collapseButton : <>
          <div className={styles.votes} role="group" aria-label="댓글 추천">
            <button type="button" aria-label={comment.vote === 1 ? "댓글 추천 취소" : "댓글 추천"} aria-pressed={comment.vote === 1} disabled={props.busy} onClick={() => void vote(1)}><ChevronUp size={19} aria-hidden /></button>
            <span aria-label={`추천 점수 ${comment.score}`} aria-live="polite">{comment.score}</span>
            <button type="button" aria-label={comment.vote === -1 ? "댓글 비추천 취소" : "댓글 비추천"} aria-pressed={comment.vote === -1} disabled={props.busy} onClick={() => void vote(-1)}><ChevronDown size={19} aria-hidden /></button>
          </div>
          {depth < 7 && <button type="button" disabled={props.busy} aria-expanded={replying} onClick={() => setReplying((value) => !value)}><Reply size={16} aria-hidden />답글</button>}
          {collapseButton}
      </>}
    >
      {comment.unavailable ? <p className={styles.unavailable}>볼 수 없는 댓글입니다.</p> : <>
        {depth >= 2 && parentName && <p className={styles.replyTo}>{parentName}님에게 답글</p>}
        <p className={styles.body}>{comment.body}</p>
        {voteError && <p className={styles.error} role="alert">{voteError}</p>}
      </>}
    </SocialCard>
    {!comment.unavailable && replying && <div className={styles.replyComposer}>
      <CommentComposer authorName={props.authorName} busy={props.busy} parentId={comment.id} onComment={props.onComment} onCancel={() => setReplying(false)} onDone={() => setReplying(false)} />
    </div>}
    {children.length > 0 && <div id={childId} hidden={!expanded} className={depth < 2 ? styles.children : styles.deepChildren}>
      {children.map((child) => <CommentRow key={child.id} {...props} comment={child} depth={depth + 1} parentName={comment.unavailable ? undefined : comment.authorName} childrenByParent={childrenByParent} />)}
    </div>}
  </div>;
}

/** Controlled thread: the existing authenticated community API owns all rows and votes. */
export function CommentThread(props: ThreadProps) {
  const ids = new Set(props.comments.map((comment) => comment.id));
  const childrenByParent = new Map<string, CommentType[]>();
  const roots: CommentType[] = [];
  for (const comment of props.comments) {
    if (comment.parentId && ids.has(comment.parentId) && comment.parentId !== comment.id) {
      const siblings = childrenByParent.get(comment.parentId) ?? [];
      siblings.push(comment); childrenByParent.set(comment.parentId, siblings);
    } else roots.push(comment);
  }
  return <div className={styles.thread} data-comment-thread>
    <CommentComposer authorName={props.authorName} busy={props.busy} inputRef={props.inputRef} onComment={props.onComment} />
    <div className={styles.list}>
      {roots.length ? roots.map((comment) => <CommentRow key={comment.id} {...props} comment={comment} depth={0} childrenByParent={childrenByParent} />)
        : <p className={styles.empty}>아직 댓글이 없습니다. 첫 이야기를 남겨 주세요.</p>}
    </div>
  </div>;
}
