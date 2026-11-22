"use client";
import type { CommunityPost } from "../../contracts/community";
import type { CommunityReactionControls } from "./community-post-actions";
import { CommunityPostCard } from "./community-presentation";
import styles from "./community.module.css";

export function CommunityFeed({ posts, onOpen, controls }: {
  posts: CommunityPost[]; onOpen: (id: string) => void; controls: (post: CommunityPost) => CommunityReactionControls;
}) {
  return <div className={styles.feed} data-community-feed>{posts.map((post) => <CommunityPostCard key={post.id} post={post} reactions={controls(post)} onOpen={() => onOpen(post.id)} />)}</div>;
}
