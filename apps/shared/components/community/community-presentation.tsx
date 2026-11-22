"use client";

import {
  IconAlertCircle,
  IconBookmark as Bookmark,
  IconRefresh,
  IconSpeakerphone,
  IconCheck as Check,
  IconMessageCircle,
  IconSettings2 as Settings2,
  IconBuildingStore as Store,
} from "@tabler/icons-react";
import { type CommunityPost } from "../../contracts/community";
import styles from "./community.module.css";
import { CommunityPostActions, type CommunityReactionControls } from "./community-post-actions";

export function communityDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CommunityAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const tone = Array.from(name).reduce((sum, letter) => sum + (letter.codePointAt(0) ?? 0), 0) % 4;
  return <span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} data-tone={tone} aria-hidden>{name.trim().slice(0, 2) || <Store size={18} aria-hidden="true" />}</span>;
}

export function CommunityAuthor({ name, date, mine = false }: { name: string; date?: string; mine?: boolean }) {
  return <div className={styles.author}>
    <CommunityAvatar name={name} />
    <div className={styles.authorText}><span className={styles.authorName}>{name}{mine && <span className={styles.mine}>내 글</span>}</span>{date && <time className={styles.meta} dateTime={date}>{communityDate(date)}</time>}</div>
  </div>;
}

export function CommunityPostCard({ post, onOpen, reactions }: { post: CommunityPost; onOpen: () => void; reactions: CommunityReactionControls }) {
  return <article className={styles.post} data-community-post={post.id}>
    <div className={styles.postTop}><CommunityAuthor name={post.authorName} date={post.createdAt} mine={post.isMine} /></div>
    <button type="button" className={styles.postTitleButton} onClick={onOpen}><h2>{post.title}</h2></button>
    <p className={styles.excerpt}>{post.body}</p>
    {post.images.length > 0 && <button className={styles.postImageButton} type="button" onClick={onOpen} aria-label={`${post.title} 첨부 사진 보기`}>
      <div className={styles.feedImages} data-count={Math.min(post.images.length, 2)}>{post.images.slice(0, 2).map((image, i) => <img key={image.mediaAssetId} src={image.url} alt={`게시글 첨부 사진 ${i + 1}`} loading="lazy" />)}</div>
      {post.images.length > 2 && <span className={styles.photoCount}>사진 {post.images.length}장</span>}
    </button>}
    <div className={styles.postFooter}><CommunityPostActions post={post} onComment={onOpen} {...reactions} /></div>
  </article>;
}

export function CommunityAside({ name, shopName, posts, onProfile, onSaved, busy }: {
  name: string; shopName?: string; posts: CommunityPost[];
  onProfile: () => void; onSaved: () => void; busy: boolean;
}) {
  const authors = [...new Set(posts.map((post) => post.authorName))].slice(0, 4);
  return <aside className={styles.aside} aria-label="라운지 둘러보기">
    <button type="button" className={styles.myProfile} onClick={onProfile} disabled={busy}>
      <CommunityAvatar name={shopName || name} />
      <span className={styles.authorText}><span className={styles.authorName}>{shopName || name}</span><span className={styles.meta}>내 라운지 프로필</span></span><Settings2 size={17} aria-hidden />
    </button>
    <button type="button" className={styles.savedEntry} onClick={onSaved} disabled={busy}><Bookmark size={19} aria-hidden />저장한 글</button>

    {authors.length > 0 && <section className={styles.asideSection}><h2>최근 이야기를 나눈 글쓴이</h2><div className={styles.authorList}>{authors.map((author) => <div className={styles.recentAuthor} key={author}><CommunityAvatar name={author} /><span>{author}</span></div>)}</div></section>}
    <p className={styles.asideNote}>고객의 개인정보는 가리고,<br />서로의 경험을 존중해 주세요.</p>
  </aside>;
}

const stateIcons = { feed: IconMessageCircle, saved: Bookmark, resources: IconSpeakerphone, "no-shop": Store, error: IconAlertCircle };

export function CommunityStatus({ kind, title, description, onRetry }: {
  kind: keyof typeof stateIcons; title: string; description?: string; onRetry?: () => void;
}) {
  const Icon = stateIcons[kind];
  return <div className={styles.state} data-kind={kind}>
    <span className={styles.stateIcon}><Icon size={22} stroke={1.6} aria-hidden /></span>
    <p className={styles.stateTitle} role={onRetry ? "alert" : undefined}>{title}</p>
    {description && <p className={styles.stateDescription}>{description}</p>}
    {onRetry && <button type="button" className={styles.secondaryButton} data-owner-control-size="content" onClick={onRetry}><IconRefresh size={16} stroke={1.7} aria-hidden />다시 시도</button>}
  </div>;
}

export function CommunityNotice({ children }: { children: string }) {
  return <p className={styles.notice} role="status"><Check size={16} aria-hidden />{children}</p>;
}
