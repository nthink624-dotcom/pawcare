"use client";

import { useState } from "react";
import { IconCheck as Check, IconShieldCheck as ShieldCheck, IconBuildingStore as Store } from "@tabler/icons-react";
import { CommunityAvatar } from "./community-presentation";
import { communityButton, communityControl, communityPrimary } from "./community-form";
import styles from "./community.module.css";

export function CommunitySettings({ nickname, shopName, blockedUsers, busy, onSave, onUnblock }: {
  nickname: string; shopName?: string; blockedUsers: { id: string; nickname: string }[]; busy: boolean;
  onSave: (name: string) => Promise<void>; onUnblock: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(nickname);
  const [error, setError] = useState("");
  return <div className={styles.settings} data-community-settings>
    <section className={styles.profileCard}><div className={styles.profileCover}><Store size={32} aria-hidden /><span>매일의 작은 경험</span></div><div className={styles.profileInfo}>
      <CommunityAvatar name={shopName || nickname} large />
      <h2>{shopName || nickname}<span className={styles.badge}>우리 매장</span></h2>
      <p className={styles.profileDescription}>라운지 게시글과 댓글에 이 이름이 표시됩니다.</p>
      <form onSubmit={async (event) => { event.preventDefault(); setError(""); try { await onSave(name.trim()); } catch (cause) { setError(cause instanceof Error ? cause.message : "이름을 저장하지 못했습니다."); } }} className={styles.profileForm}>
        <label htmlFor="community-nickname">표시 이름</label>
        <input id="community-nickname" required minLength={2} maxLength={24} className={`${communityControl} ${styles.nameInput}`} disabled={busy} value={name} onChange={(event) => setName(event.target.value)} />
        {shopName && shopName.length >= 2 && shopName.length <= 24 && <button type="button" className={styles.quietButton} disabled={busy} onClick={() => setName(shopName)}>매장 이름으로 입력</button>}
        <button className={communityPrimary} disabled={busy || name.trim().length < 2}><Check size={16} aria-hidden />{busy ? "저장 중…" : "이름 저장"}</button>
      </form>
    </div></section>
    <section className={styles.panel}><div className={styles.panelTitle}><ShieldCheck size={19} aria-hidden /><h2>차단한 이용자</h2></div>{blockedUsers.length ? blockedUsers.map((user) => <div key={user.id} className={styles.blockedRow}><CommunityAvatar name={user.nickname} /><span>{user.nickname}</span><button type="button" className={communityButton} disabled={busy} onClick={async () => { setError(""); try { await onUnblock(user.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "차단을 해제하지 못했습니다."); } }}>차단 해제</button></div>) : <p className={styles.muted}>차단한 이용자가 없습니다.</p>}</section>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
