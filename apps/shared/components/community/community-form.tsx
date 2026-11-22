"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconEye, IconPhotoVideo, IconX } from "@tabler/icons-react";
import {
  COMMUNITY_ATTACHMENT_LIMIT,
  COMMUNITY_RULES,
  COMMUNITY_VIDEO_MAX_BYTES,
  type CommunityCategory,
  type CommunityPost,
} from "../../contracts/community";
import { prepareCommunityPhoto } from "../../lib/community-images";
import { CommunityAuthor } from "./community-presentation";
import styles from "./community.module.css";
import viewportStyles from "./community-compose-viewport.module.css";

export const communityControl = styles.control;
export const communityButton = styles.quietButton;
export const communityPrimary = styles.primaryButton;

export type CommunityDraft = {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  retainedMediaIds: string[];
  photos: File[];
  video: { file: File; uploadId: string } | null;
  removeVideo: boolean;
  expectedUpdatedAt?: string;
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function CommunityForm({ post, authorName, onSave, onCancel }: {
  post?: CommunityPost;
  authorName?: string;
  onSave: (draft: CommunityDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [id] = useState(() => post?.id ?? crypto.randomUUID());
  const labelId = useId();
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [retained, setRetained] = useState(post?.images ?? []);
  const [retainedVideo, setRetainedVideo] = useState(post?.video);
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<CommunityDraft["video"]>(null);
  const [previews, setPreviews] = useState<{ photos: string[]; video?: string }>({ photos: [] });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"preparing" | "saving" | null>(null);
  const busyRef = useRef(false);
  const [preview, setPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const count = retained.length + photos.length + Number(!!retainedVideo || !!video);
  const canSave = !busy && consent && title.trim() && body.trim();

  useEffect(() => {
    const dialog = dialogRef.current;
    const content = contentRef.current;
    if (!dialog || !content) return;

    const compact = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const viewport = window.visualViewport;
    let frame = 0;

    const revealField = () => {
      if (!compact.matches) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const field = document.activeElement;
        if (!field || (field !== titleRef.current && field !== bodyRef.current)) return;

        // Keep the focused field visible without moving the page behind the dialog.
        const bounds = field.getBoundingClientRect();
        const visible = content.getBoundingClientRect();
        const top = bounds.top - visible.top - 8;
        const bottom = bounds.bottom - visible.bottom + 8;
        if (top < 0) content.scrollTop += top;
        else if (bottom > 0) content.scrollTop += Math.min(top, bottom);
      });
    };

    const fitViewport = () => {
      if (!compact.matches) return;
      dialog.style.setProperty("--community-compose-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--community-compose-top", `${viewport?.offsetTop ?? 0}px`);
      revealField();
    };

    fitViewport();
    dialog.showModal();
    if (!compact.matches) titleRef.current?.focus();

    compact.addEventListener("change", fitViewport);
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    content.addEventListener("focusin", revealField);
    return () => {
      compact.removeEventListener("change", fitViewport);
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
      content.removeEventListener("focusin", revealField);
      window.cancelAnimationFrame(frame);
      dialog.close();
    };
  }, []);

  useEffect(() => {
    const photoUrls = photos.map((photo) => URL.createObjectURL(photo));
    const videoUrl = video ? URL.createObjectURL(video.file) : undefined;
    setPreviews({ photos: photoUrls, video: videoUrl });
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [photos, video]);

  async function addFiles(files: File[]) {
    if (!files.length || busyRef.current) return;
    setError("");
    const incomingVideos = files.filter((file) => file.type === "video/mp4" || (!file.type && /\.mp4$/i.test(file.name)));
    const incomingPhotos = files.filter((file) => PHOTO_TYPES.includes(file.type));
    if (incomingPhotos.length + incomingVideos.length !== files.length) {
      setError("JPG·PNG·WebP 사진 또는 MP4 동영상을 선택해 주세요.");
      return;
    }
    if (incomingVideos.length + Number(!!retainedVideo || !!video) > 1) {
      setError("동영상은 한 개만 첨부할 수 있습니다.");
      return;
    }
    if (count + files.length > COMMUNITY_ATTACHMENT_LIMIT) {
      setError("첨부 파일은 사진과 동영상을 합해 3개까지 올릴 수 있습니다.");
      return;
    }
    const incomingVideo = incomingVideos[0];
    if (incomingVideo && (incomingVideo.size < 16 || incomingVideo.size > COMMUNITY_VIDEO_MAX_BYTES)) {
      setError("12MB 이하의 MP4 동영상을 선택해 주세요.");
      return;
    }
    busyRef.current = true;
    setBusy("preparing");
    try {
      if (incomingVideo) {
        const header = new Uint8Array(await incomingVideo.slice(4, 8).arrayBuffer());
        if (String.fromCharCode(...header) !== "ftyp") throw new Error("재생할 수 있는 MP4 동영상을 선택해 주세요.");
      }
      const prepared: File[] = [];
      for (const photo of incomingPhotos) prepared.push(await prepareCommunityPhoto(photo));
      setPhotos((previous) => [...previous, ...prepared]);
      if (incomingVideo) setVideo({ file: incomingVideo, uploadId: crypto.randomUUID() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "첨부 파일을 준비하지 못했습니다.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return (
    <dialog ref={dialogRef} className={`${styles.editorDialog} ${viewportStyles.dialog}`} aria-labelledby={labelId} onCancel={(event) => {
      event.preventDefault();
      if (!busyRef.current) onCancel();
    }}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (busyRef.current || !canSave) return;
        busyRef.current = true;
        setBusy("saving");
        setError("");
        try {
          await onSave({
            id, category: post?.category ?? "lounge", title: title.trim(), body: body.trim(),
            retainedMediaIds: retained.map((media) => media.mediaAssetId), photos, video,
            removeVideo: !!post?.video && !retainedVideo, expectedUpdatedAt: post?.updatedAt,
          });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "저장하지 못했습니다. 다시 시도해 주세요.");
        } finally {
          busyRef.current = false;
          setBusy(null);
        }
      }}>
        <header className={styles.composeHeader}>
          <h2 id={labelId}>{post ? "글 수정" : "새 게시글"}</h2>
          <button type="button" className={communityButton} aria-label="작성창 닫기" disabled={!!busy} onClick={onCancel}>
            <IconX size={18} aria-hidden />
          </button>
        </header>
        <div ref={contentRef} className={`${styles.composeContent} ${viewportStyles.content}`}>
          {authorName && <div className={styles.composeAuthor}><CommunityAuthor name={authorName} /></div>}
          <div className={`${styles.composeGrid} ${viewportStyles.grid}`}>
            <div className={styles.composeFields}>
              <label htmlFor={labelId + "-title"}>제목</label>
              <input ref={titleRef} id={labelId + "-title"} required maxLength={100} className={styles.control}
                placeholder="제목을 입력해 주세요" value={title} disabled={!!busy} onChange={(event) => setTitle(event.target.value)} />
              <label htmlFor={labelId + "-body"}>내용</label>
              <textarea ref={bodyRef} id={labelId + "-body"} required maxLength={10000} rows={6} className={styles.control}
                placeholder="나누고 싶은 이야기를 적어 주세요" value={body} disabled={!!busy} onChange={(event) => setBody(event.target.value)} />
            </div>
            <fieldset className={styles.composeMedia} disabled={!!busy}>
              <legend>첨부 파일 <span className={styles.meta}>{count}/{COMMUNITY_ATTACHMENT_LIMIT}</span></legend>
              <div className={styles.dropZone} data-dragging={dragging} onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = busyRef.current ? "none" : "copy";
                setDragging(!busyRef.current);
              }} onDragLeave={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
              }} onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addFiles(Array.from(event.dataTransfer.files));
              }}>
                <IconPhotoVideo size={28} stroke={1.5} aria-hidden />
                <p>사진이나 동영상을 이곳에 놓아주세요</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,.mp4" multiple hidden
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void addFiles(files);
                  }} />
                <button type="button" className={styles.secondaryButton} disabled={count >= COMMUNITY_ATTACHMENT_LIMIT}
                  onClick={() => fileRef.current?.click()}>파일 선택</button>
                <p className={styles.meta}>총 3개 · MP4는 1개, 12MB 이하</p>
              </div>
              {count > 0 && <div className={styles.composeAttachments}>
                {retained.map((image, index) => <div key={image.mediaAssetId} className={styles.photoItem}>
                  <img src={image.url} alt={"첨부 사진 " + (index + 1)} />
                  <button type="button" className={communityButton} onClick={() => setRetained((list) => list.filter((media) => media.mediaAssetId !== image.mediaAssetId))}>사진 제외</button>
                </div>)}
                {previews.photos.map((url, index) => <div key={url} className={styles.photoItem}>
                  <img src={url} alt={"새 첨부 사진 " + (index + 1)} />
                  <button type="button" className={communityButton} onClick={() => setPhotos((list) => list.filter((_, photoIndex) => index !== photoIndex))}>사진 제외</button>
                </div>)}
                {(retainedVideo || previews.video) && <div className={styles.photoItem}>
                  <video src={retainedVideo?.url ?? previews.video} controls playsInline preload={retainedVideo ? "none" : "metadata"} aria-label="첨부 동영상 미리보기" />
                  <button type="button" className={communityButton} onClick={() => { setRetainedVideo(undefined); setVideo(null); }}>동영상 제외</button>
                </div>}
              </div>}
            </fieldset>
          </div>
          <p className={styles.rules}>{COMMUNITY_RULES}</p>
          <label className={styles.consent}>
            <input type="checkbox" required checked={consent} disabled={!!busy} onChange={(event) => setConsent(event.target.checked)} />
            글과 첨부 파일이 다른 펫매니저 이용자에게 공개되는 데 동의합니다.
          </label>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {preview && <section className={styles.preview} aria-label="작성 글 미리보기">
            <h3>{title || "제목을 입력해 주세요"}</h3><p className={styles.previewBody}>{body || "작성한 내용이 여기에 표시됩니다."}</p>
            {(retained.length > 0 || previews.photos.length > 0 || retainedVideo || previews.video) && <div className={styles.articleImages}>
              {retained.map((image) => <img key={image.mediaAssetId} src={image.url} alt="게시할 첨부 사진 미리보기" />)}
              {previews.photos.map((url) => <img key={url} src={url} alt="게시할 새 사진 미리보기" />)}
              {(retainedVideo || previews.video) && <video src={retainedVideo?.url ?? previews.video} controls playsInline preload="none" aria-label="게시할 동영상 미리보기" />}
            </div>}
          </section>}
        </div>
        <footer className={styles.composeFooter}>
          <button type="button" className={styles.secondaryButton} disabled={!!busy} aria-expanded={preview} onClick={() => setPreview(!preview)}>
            <IconEye size={17} aria-hidden />미리보기
          </button>
          <button type="submit" className={communityPrimary} disabled={!canSave}>
            <IconCheck size={17} aria-hidden />{busy === "saving" ? "저장 중…" : busy ? "첨부 준비 중…" : post ? "수정 저장" : "등록하기"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
