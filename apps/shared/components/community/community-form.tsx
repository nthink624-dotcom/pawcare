"use client";
import { useEffect, useRef, useState } from "react";
import { COMMUNITY_CATEGORIES, COMMUNITY_RULES, type CommunityCategory, type CommunityPost } from "../../contracts/community";
import { prepareCommunityPhoto } from "../../lib/community-images";

export const communityControl = "min-h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] font-normal leading-6 text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50";
export const communityButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-[14px] font-medium leading-5 outline-none hover:bg-[#f1f3f7] focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50";
export const communityPrimary = `${communityButton} bg-[#111a30] text-white hover:bg-[#25334e]`;
export type CommunityDraft = { id: string; category: CommunityCategory; title: string; body: string; retainedMediaIds: string[]; photos: File[]; expectedUpdatedAt?: string };

export function CommunityForm({ post, onSave, onCancel }: {
  post?: CommunityPost; onSave: (draft: CommunityDraft) => Promise<void>; onCancel: () => void;
}) {
  const [id] = useState(() => post?.id ?? crypto.randomUUID());
  const [category, setCategory] = useState<CommunityCategory>(post?.category ?? "operations");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [retained, setRetained] = useState(post?.images ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await onSave({ id, category, title: title.trim(), body: body.trim(), retainedMediaIds: retained.map((m) => m.mediaAssetId), photos, expectedUpdatedAt: post?.updatedAt }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-[20px] font-semibold">{post ? "글 수정" : "글 쓰기"}</h2><button type="button" className={communityButton} disabled={busy} onClick={onCancel}>취소</button></div>
    <label className="block space-y-2 text-[14px] font-medium">말머리<select className={`${communityControl} block w-full`} value={category} disabled={busy} onChange={(e) => setCategory(e.target.value as CommunityCategory)}>{Object.entries(COMMUNITY_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block space-y-2 text-[14px] font-medium">제목<input autoFocus required maxLength={100} className={`${communityControl} block w-full`} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></label>
    <label className="block space-y-2 text-[14px] font-medium">내용<textarea required maxLength={10000} rows={8} className={`${communityControl} block w-full resize-y`} value={body} disabled={busy} onChange={(e) => setBody(e.target.value)} /></label>
    <fieldset className="space-y-2" disabled={busy}><legend className="text-[14px] font-medium">사진 · 최대 3장</legend>
      <div className="flex flex-wrap gap-2">{retained.map((image, i) => <div key={image.mediaAssetId} className="w-24"><img src={image.url} alt={`첨부 사진 ${i + 1}`} className="h-24 w-24 rounded-[10px] object-cover" /><button type="button" className={`${communityButton} w-full`} onClick={() => setRetained(retained.filter((m) => m.mediaAssetId !== image.mediaAssetId))}>제외</button></div>)}
      {previews.map((url, i) => <div key={url} className="w-24"><img src={url} alt={`새 사진 ${i + 1}`} className="h-24 w-24 rounded-[10px] object-cover" /><button type="button" className={`${communityButton} w-full`} onClick={() => setPhotos(photos.filter((_, index) => index !== i))}>제외</button></div>)}</div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="커뮤니티 사진 선택" onChange={async (event) => {
        const selected = Array.from(event.target.files ?? []); event.target.value = "";
        if (selected.length + retained.length + photos.length > 3) { setError("사진은 3장까지 첨부할 수 있습니다."); return; }
        setBusy(true); setError("");
        try { const prepared = await Promise.all(selected.map(prepareCommunityPhoto)); setPhotos((previous) => [...previous, ...prepared]); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "사진을 준비하지 못했습니다."); }
        finally { setBusy(false); }
      }} />
      <button type="button" className={`${communityButton} border border-[#dbe2ea]`} disabled={retained.length + photos.length >= 3} onClick={() => fileRef.current?.click()}>사진 선택</button>
    </fieldset>
    <p className="text-[13px] font-normal leading-5 text-[#526175]">{COMMUNITY_RULES}</p>
    <label className="flex min-h-11 items-center gap-3 text-[14px] leading-5"><input type="checkbox" required checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 shrink-0" />글과 사진이 다른 펫매니저 이용자에게 공개되는 데 동의합니다.</label>
    {error && <p role="alert" className="text-[14px] leading-5 text-[#9a5e4e]">{error}</p>}
    <button type="submit" className={`${communityPrimary} w-full sm:w-auto`} disabled={busy || !consent || !title.trim() || !body.trim()}>{busy ? "저장 중…" : post ? "수정 저장" : "등록하기"}</button>
  </form>;
}
