"use client";
import { useId, useState } from "react";
import type { CommunityPost } from "../../contracts/community";
import { CommunityInlineComments, type InlineCommentControls } from "./community-inline-comments";
import type { CommunityReactionControls } from "./community-post-actions";
import { CommunityPostCard } from "./community-presentation";
import styles from "./community.module.css";

const EAGER_IMAGE_POSTS = 2;

export function CommunityFeed({ posts, onOpen, controls, comments }: {
  posts: CommunityPost[]; onOpen: (id: string) => void; controls: (post: CommunityPost) => CommunityReactionControls;
  comments: InlineCommentControls;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const threadId = useId();
  return <div className={styles.feed} data-community-feed>
    {posts.map((post, index) => {
      const expanded = expandedId === post.id;
      const reactions = controls(post);
      return <CommunityPostCard
        key={post.id}
        post={post}
        eagerImages={index < EAGER_IMAGE_POSTS}
        reactions={reactions}
        onOpen={() => onOpen(post.id)}
        onComment={() => setExpandedId((current) => current === post.id ? null : post.id)}
        commentRegion={{ expanded, id: threadId }}
      >
        {expanded && <CommunityInlineComments id={threadId} postId={post.id} busy={reactions.busy} controls={comments} />}
      </CommunityPostCard>;
    })}
  </div>;
}
