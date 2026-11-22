"use client";
import { useId } from "react";
import { IconBookmark, IconBookmarkFilled, IconLayoutSidebarRight, IconSpeakerphone } from "@tabler/icons-react";
import type { CommunityApi, CommunityPost, CommunityReaction } from "../../contracts/community";
import { CommunityResources } from "./community-resources";
import { CommunitySavedPosts } from "./community-saved-posts";
import { CommunityStatus } from "./community-presentation";
import styles from "./community.module.css";

export type CommunitySideView = "saved" | "resources";
export function CommunitySidebar({ view, onViewChange, requiresShop, demo = false, ...props }: {
  view: CommunitySideView; onViewChange: (view: CommunitySideView) => void;
  requiresShop: boolean; demo?: boolean;
  shopId: string; api: CommunityApi; refreshVersion: number; busy: boolean;
  onOpen: (id: string) => void; onToggleSave: (post: CommunityPost) => Promise<CommunityReaction | undefined>;
}) {
  const id = useId();
  const Bookmark = view === "saved" ? IconBookmarkFilled : IconBookmark;
  return <>
    <header className={styles.sidebarHeading}><IconLayoutSidebarRight size={20} stroke={1.7} aria-hidden /><h2>모아보기</h2></header>
    {requiresShop ? <CommunityStatus kind="no-shop" title="매장 연결 후 이용할 수 있어요" /> : <>
    <div className={styles.sidebarTabs} role="tablist" aria-label="모아보기 메뉴" onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); const next = view === "saved" ? "resources" : "saved"; onViewChange(next);
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-side-view="${next}"]`)?.focus();
    }}>
      <button type="button" role="tab" data-owner-control-size="content" id={id + "-saved-tab"} aria-controls={id + "-saved"} aria-selected={view === "saved"} tabIndex={view === "saved" ? 0 : -1} data-side-view="saved" onClick={() => onViewChange("saved")}><Bookmark size={18} stroke={1.7} aria-hidden />저장한 글</button>
      <button type="button" role="tab" data-owner-control-size="content" id={id + "-resources-tab"} aria-controls={id + "-resources"} aria-selected={view === "resources"} tabIndex={view === "resources" ? 0 : -1} data-side-view="resources" onClick={() => onViewChange("resources")}><IconSpeakerphone size={18} stroke={1.7} aria-hidden />지원금·소식</button>
    </div>
    <section id={id + "-saved"} className={styles.sideTabPanel} role="tabpanel" aria-labelledby={id + "-saved-tab"} hidden={view !== "saved"}><CommunitySavedPosts {...props} /></section>
    <section id={id + "-resources"} className={styles.sideTabPanel} role="tabpanel" aria-labelledby={id + "-resources-tab"} hidden={view !== "resources"}><CommunityResources shopId={props.shopId} api={props.api} showHeading={false} showSupportPrograms={view === "resources" && !demo} /></section>
    </>}
  </>;
}
