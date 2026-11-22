"use client";

import { IconBookmark, IconBookmarkFilled, IconHeart, IconHeartFilled, IconLoader2, IconMessageCircle } from "@tabler/icons-react";
import type { CommunityPost, CommunityReactionAction } from "../../contracts/community";
import styles from "./community.module.css";

export type CommunityReactionControls = {
  busy: boolean;
  pendingAction?: CommunityReactionAction;
  onReact: (post: CommunityPost, action: CommunityReactionAction) => void;
};

export function CommunityPostActions({ post, onComment, commentRegion, busy, pendingAction, onReact }: CommunityReactionControls & {
  post: CommunityPost; onComment: () => void; commentRegion?: { expanded: boolean; id: string };
}) {
  const ready = typeof post.likeCount === "number" && typeof post.liked === "boolean" && typeof post.saved === "boolean";
  const LikeIcon = post.liked ? IconHeartFilled : IconHeart;
  const SaveIcon = post.saved ? IconBookmarkFilled : IconBookmark;
  return <>
    <button type="button" className={styles.reactionButton} data-owner-control-size="content" aria-label={post.liked ? "좋아요 취소" : "좋아요"} aria-pressed={!!post.liked} aria-busy={pendingAction === "like"} disabled={busy || !ready} onClick={() => onReact(post, "like")}>
      {pendingAction === "like" ? <IconLoader2 size={19} className={styles.loadingIcon} aria-hidden /> : <LikeIcon size={19} stroke={1.7} aria-hidden />}
      <span>{typeof post.likeCount === "number" ? post.likeCount.toLocaleString("ko-KR") : ""}</span>
    </button>
    <button type="button" className={styles.reactionButton} data-owner-control-size="content" disabled={busy} onClick={onComment}
      aria-expanded={commentRegion?.expanded} aria-controls={commentRegion?.expanded ? commentRegion.id : undefined}>
      <IconMessageCircle size={19} stroke={1.7} aria-hidden />댓글 {post.commentCount}
    </button>
    <button type="button" className={`${styles.reactionButton} ${styles.saveButton}`} data-owner-control-size="content" aria-label={post.saved ? "게시물 저장 해제" : "게시물 저장"} aria-pressed={!!post.saved} aria-busy={pendingAction === "save"} disabled={busy || !ready} onClick={() => onReact(post, "save")}>
      {pendingAction === "save" ? <IconLoader2 size={19} className={styles.loadingIcon} aria-hidden /> : <SaveIcon size={19} stroke={1.7} aria-hidden />}
      <span>{post.saved ? "저장됨" : "저장"}</span>
    </button>
  </>;
}
