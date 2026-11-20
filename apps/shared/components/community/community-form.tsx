"use client";
import { useEffect, useRef, useState } from "react";
import { IconCamera as Camera, IconCheck as Check, IconEye as Eye, IconX as X } from "@tabler/icons-react";
import { COMMUNITY_RULES, type CommunityCategory, type CommunityPost } from "../../contracts/community";
import { prepareCommunityPhoto } from "../../lib/community-images";
import { CommunityAuthor } from "./community-presentation";
import styles from "./community.module.css";

export const communityControl = styles.control;
export const communityButton = styles.quietButton;
export const communityPrimary = styles.primaryButton;
export type CommunityDraft = { id: string; category: CommunityCategory; title: string; body: string; retainedMediaIds: string[]; photos: File[]; expectedUpdatedAt?: string };

export function CommunityForm({ post, authorName, onSave, onCancel }: {
  post?: CommunityPost; authorName?: string; onSave: (draft: CommunityDraft) => Promise<void>; onCancel: () => void;
}) {
  const [id] = useState(() => post?.id ?? crypto.randomUUID());
  const category: CommunityCategory = post?.category ?? "lounge";
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [retained, setRetained] = useState(post?.images ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (busy || !consent || !title.trim() || !body.trim()) return;
    setBusy(true); setError("");
    try { await onSave({ id, category, title: title.trim(), body: body.trim(), retainedMediaIds: retained.map((m) => m.mediaAssetId), photos, expectedUpdatedAt: post?.updatedAt }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }}>
    <div className={styles.editorHeading}><div><h2>{post ? "글 수정" : "경험을 나눠주세요"}</h2><p>{post ? "수정한 내용은 같은 게시글에 반영됩니다." : "작은 경험도 다른 매장에는 큰 도움이 돼요."}</p></div><button type="button" className={communityButton} disabled={busy} onClick={onCancel}>취소</button></div>
    <section className={styles.editor}>
      {authorName && <div className={styles.editorAuthor}><CommunityAuthor name={authorName} /></div>}
      <label className="sr-only" htmlFor="community-post-title">제목</label><input id="community-post-title" autoFocus required maxLength={100} className={styles.titleInput} placeholder="이야기의 제목을 적어주세요" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      <label className="sr-only" htmlFor="community-post-body">내용</label><textarea id="community-post-body" required maxLength={10000} rows={8} className={styles.bodyInput} placeholder="매장에서 나누고 싶은 이야기를 적어주세요." value={body} disabled={busy} onChange={(e) => setBody(e.target.value)} />
      <fieldset className={styles.mediaField} disabled={busy}><legend className="sr-only">사진 · 최대 3장</legend>
        <div className={styles.photoGrid}>{retained.map((image, i) => <div key={image.mediaAssetId} className={styles.photoItem}><img src={image.url} alt={"첨부 사진 " + (i + 1)} /><button type="button" className={communityButton} onClick={() => setRetained(retained.filter((m) => m.mediaAssetId !== image.mediaAssetId))}><X size={15} aria-hidden />제외</button></div>)}
          {previews.map((url, i) => <div key={url} className={styles.photoItem}><img src={url} alt={"새 사진 " + (i + 1)} /><button type="button" className={communityButton} onClick={() => setPhotos(photos.filter((_, index) => index !== i))}><X size={15} aria-hidden />제외</button></div>)}</div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="커뮤니티 사진 선택" onChange={async (event) => {
          const selected = Array.from(event.target.files ?? []); event.target.value = "";
          if (selected.length + retained.length + photos.length > 3) { setError("사진은 3장까지 첨부할 수 있습니다."); return; }
          setBusy(true); setError("");
          try { const prepared = await Promise.all(selected.map(prepareCommunityPhoto)); setPhotos((previous) => [...previous, ...prepared]); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "사진을 준비하지 못했습니다."); }
          finally { setBusy(false); }
        }} />
        <div className={styles.uploadBar}><button type="button" className={communityButton} disabled={retained.length + photos.length >= 3} onClick={() => fileRef.current?.click()}><Camera size={18} aria-hidden />사진 선택</button><span className={styles.meta}>최대 3장 · {retained.length + photos.length}/3</span></div>
      </fieldset>
      <p className={styles.rules}>{COMMUNITY_RULES}</p>
      <label className={styles.consent}><input type="checkbox" required checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} />글과 사진이 다른 펫매니저 이용자에게 공개되는 데 동의합니다.</label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.editorFooter}><button type="button" className={styles.secondaryButton} disabled={busy} aria-expanded={preview} onClick={() => setPreview(!preview)}><Eye size={17} aria-hidden />미리보기</button><button type="submit" className={communityPrimary} disabled={busy || !consent || !title.trim() || !body.trim()}><Check size={17} aria-hidden />{busy ? "저장 중…" : post ? "수정 저장" : "등록하기"}</button></div>
      {preview && <section className={styles.preview} aria-label="작성 글 미리보기"><h3>{title || "제목을 입력해주세요"}</h3><p className={styles.previewBody}>{body || "작성한 내용이 여기에 표시됩니다."}</p>{(retained.length > 0 || previews.length > 0) && <div className={styles.articleImages}>{retained.map((image) => <img key={image.mediaAssetId} src={image.url} alt="게시할 첨부 사진 미리보기" />)}{previews.map((url) => <img key={url} src={url} alt="게시할 새 사진 미리보기" />)}</div>}</section>}
    </section>
  </form>;
}
