import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, type OwnerShopContext } from "@/server/owner-api-auth";
import { COMMUNITY_ATTACHMENT_LIMIT, type CommunityVideoUpload } from "@petmanager/shared/contracts/community";
import type { CommunityMutation } from "./schema";

const BUCKET = "community-images";
const VIDEO_BUCKET = "community-videos";
const isVideo = (path: string) => path.endsWith(".mp4");
const videoInvalid = "동영상 파일을 다시 선택해 주세요.";
const PHOTO_UPLOAD = { contentType: "image/webp", upsert: false } as const;
/** Longest side of the feed/saved display copy. The detail view keeps the 1600px original. */
export const COMMUNITY_THUMBNAIL_SIZE = 800;
/**
 * The display copy lives next to its original (same owner folder) and is never a
 * database row: every cleanup that removes an original removes this path with it.
 */
export function communityThumbnailPath(objectPath: string) {
  return `${objectPath.replace(/\.[^./]+$/, "")}.thumb.webp`;
}
export async function createCommunityThumbnail(photo: Buffer) {
  return sharp(photo, { limitInputPixels: 20000000, animated: false })
    .resize(COMMUNITY_THUMBNAIL_SIZE, COMMUNITY_THUMBNAIL_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 }).toBuffer();
}
const withThumbnails = (paths: string[]) => paths.flatMap((path) => [path, communityThumbnailPath(path)]);
export function communityAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("커뮤니티 연결을 확인해 주세요.", 503);
  return admin;
}
export function communityDatabaseError(error: { message: string; code?: string }): never {
  if (error.message.includes("COMMUNITY_NOT_FOUND")) throw new OwnerApiError("글이 삭제되었거나 볼 수 없습니다.", 404);
  if (error.message.includes("COMMUNITY_FORBIDDEN")) throw new OwnerApiError("이 작업을 수행할 권한이 없습니다.", 403);
  if (error.message.includes("COMMUNITY_CONFLICT")) throw new OwnerApiError("글이 변경되었습니다. 다시 열어 수정해 주세요.", 409);
  if (error.message.includes("COMMUNITY_RATE_LIMIT")) throw new OwnerApiError("오늘 작성 가능한 횟수를 초과했습니다. 나중에 다시 시도해 주세요.", 429);
  if (error.message.includes("COMMUNITY_INVALID_VIDEO")) throw new OwnerApiError(videoInvalid, 400);
  if (error.code === "23505" || error.code === "23514" || error.message.includes("COMMUNITY_INVALID")) throw new OwnerApiError("입력 내용과 사진 개수를 확인해 주세요.", 400);
  throw new OwnerApiError("커뮤니티를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
}
export async function communityDispatch(owner: OwnerShopContext, action: string, payload: unknown) {
  if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
  const { data, error } = await communityAdmin().rpc("community_dispatch", {
    p_user: owner.userId, p_shop: owner.shopId, p_action: action, p_payload: payload,
  });
  if (error) communityDatabaseError(error);
  return data;
}
let mediaCleanup: Promise<void> | null = null;
/** Opportunistic, retryable cleanup. Queue rows stay until Storage acknowledges deletion. */
export function cleanCommunityMedia() {
  // Parallel feed/saved reads would otherwise claim the same queue rows twice.
  mediaCleanup ??= runCommunityMediaCleanup().finally(() => { mediaCleanup = null; });
  return mediaCleanup;
}
async function runCommunityMediaCleanup() {
  const admin = communityAdmin();
  const { data, error } = await admin.from("community_media_deletions").select("object_path")
    .lte("requested_at", new Date().toISOString()).order("requested_at").limit(50);
  if (error || !data?.length) return;
  const paths = data.map((row) => row.object_path as string);
  await Promise.all([BUCKET, VIDEO_BUCKET].map(async (bucket) => {
    const matching = paths.filter((path) => isVideo(path) === (bucket === VIDEO_BUCKET));
    if (!matching.length) return;
    const result = await admin.storage.from(bucket).remove(bucket === BUCKET ? withThumbnails(matching) : matching);
    if (!result.error) await admin.from("community_media_deletions").delete().in("object_path", matching);
  }));
}
type MediaRow = { mediaAssetId: string; objectPath: string };
type StoredPost = { images: MediaRow[] };
export async function resolveCommunityImages<T extends StoredPost>(
  result: { posts?: T[]; post?: T },
  options: { listVideos?: boolean; thumbnails?: boolean } = {},
) {
  const posts = result.posts ?? (result.post ? [result.post] : []);
  const photoPaths = posts.flatMap((post) => post.images.map((media) => media.objectPath).filter((path) => !isVideo(path)));
  // Feed/saved lists show the display copy. Photos uploaded before display copies
  // existed have none and keep showing the original. Both are signed in one batch.
  const thumbnailPaths = options.thumbnails ? photoPaths.map(communityThumbnailPath) : [];
  const videoPosts = result.post ? [result.post] : options.listVideos ? posts : [];
  const videoPaths = videoPosts.flatMap((post) => post.images.map((media) => media.objectPath).filter(isVideo));
  const [photos, videos] = await Promise.all([
    signCommunityMedia(BUCKET, [...photoPaths, ...thumbnailPaths], 60, new Set(thumbnailPaths)),
    signCommunityMedia(VIDEO_BUCKET, videoPaths, 300),
  ]);
  const photoUrl = (objectPath: string) =>
    (options.thumbnails && photos.get(communityThumbnailPath(objectPath))) || photos.get(objectPath)!;
  function project(post: T) {
    const video = post.images.find((media) => isVideo(media.objectPath));
    const videoUrl = video && videos.get(video.objectPath);
    return {
      ...post,
      images: post.images.filter((media) => !isVideo(media.objectPath))
        .map((media) => ({ mediaAssetId: media.mediaAssetId, url: photoUrl(media.objectPath) })),
      ...(video ? { hasVideo: true } : {}),
      ...(video && videoUrl ? { video: { mediaAssetId: video.mediaAssetId, url: videoUrl } } : {}),
    };
  }
  return {
    ...result,
    ...(result.posts ? { posts: result.posts.map(project) } : {}),
    ...(result.post ? { post: project(result.post) } : {}),
  };
}

// Reuse a signed link only during the first third of its lifetime, so every link
// handed out still has at least two thirds of its expiry left. Repeated reads
// (feed + saved list, focus refresh, reopening the lounge) then return the same
// URL: the browser reuses the downloaded image and the signing round trip is skipped.
// Visibility is still decided per request by community_dispatch; only paths it
// returned are resolved here.
const signedMedia = new Map<string, { url: Promise<string | null>; reuseUntil: number }>();
const SIGNED_MEDIA_LIMIT = 1000;
const signFailure = () => new OwnerApiError("첨부 파일을 불러오지 못했습니다. 다시 시도해 주세요.", 503);

/** `optional` paths may be absent from Storage (display copies): they get no URL instead of failing the read. */
async function signCommunityMedia(bucket: string, paths: string[], seconds: number, optional: ReadonlySet<string> = new Set()) {
  if (!paths.length) return new Map<string, string>();
  const now = Date.now();
  for (const [key, entry] of signedMedia) if (entry.reuseUntil <= now) signedMedia.delete(key);
  const unique = [...new Set(paths)];
  const urls = new Map<string, Promise<string | null>>();
  const missing: string[] = [];
  for (const path of unique) {
    const cached = signedMedia.get(`${bucket}/${path}`);
    if (cached) urls.set(path, cached.url); else missing.push(path);
  }
  if (missing.length) {
    const batch = communityAdmin().storage.from(bucket).createSignedUrls(missing, seconds).then(({ data, error }) => {
      if (error || !data) throw signFailure();
      return new Map(data.flatMap((media) => media.path && media.signedUrl && !media.error ? [[media.path, media.signedUrl] as const] : []));
    });
    const reuseUntil = now + (seconds * 1000) / 3;
    for (const path of missing) {
      const key = `${bucket}/${path}`;
      // An absent optional copy is remembered for the same short window as a link.
      const url = batch.then((signed) => signed.get(path) ?? (optional.has(path) ? null : Promise.reject(signFailure())));
      const entry = { url, reuseUntil };
      urls.set(path, url);
      signedMedia.set(key, entry);
      url.catch(() => { if (signedMedia.get(key) === entry) signedMedia.delete(key); });
    }
    while (signedMedia.size > SIGNED_MEDIA_LIMIT) signedMedia.delete(signedMedia.keys().next().value!);
  }
  const resolved = await Promise.all(Array.from(urls, async ([path, url]) => [path, await url] as const));
  if (resolved.some(([path, url]) => !url && !optional.has(path))) throw signFailure();
  return new Map(resolved.flatMap(([path, url]) => url ? [[path, url] as const] : []));
}

async function prepareVideo(owner: OwnerShopContext, payload: Extract<CommunityMutation, { action: "prepare_video" }>): Promise<CommunityVideoUpload> {
  const admin = communityAdmin();
  const { data: path, error } = await admin.rpc("community_reserve_video", {
    p_user: owner.userId, p_shop: owner.shopId, p_post: payload.id, p_upload: payload.uploadId, p_bytes: payload.bytes,
  });
  if (error) communityDatabaseError(error);
  if (typeof path !== "string") throw new OwnerApiError(videoInvalid, 400);
  const storage = admin.storage.from(VIDEO_BUCKET);
  const { data: existing } = await storage.info(path);
  if (existing) {
    if (existing.size !== payload.bytes || existing.contentType !== "video/mp4") throw new OwnerApiError(videoInvalid, 400);
    return { uploaded: true };
  }
  const { data, error: uploadError } = await storage.createSignedUploadUrl(path, { upsert: false });
  if (uploadError || !data?.signedUrl) throw new OwnerApiError("동영상 업로드를 준비하지 못했습니다. 다시 시도해 주세요.", 503);
  return { uploaded: false, uploadUrl: data.signedUrl };
}

async function validateUploadedVideo(owner: OwnerShopContext, postId: string, uploadId: string) {
  const admin = communityAdmin();
  const { data: pending, error } = await admin.from("community_video_uploads").select("object_path,bytes")
    .eq("id", uploadId).eq("author_id", owner.userId).eq("post_id", postId)
    .eq("attached", false).gte("expires_at", new Date().toISOString()).maybeSingle();
  if (error) communityDatabaseError(error);
  if (!pending) throw new OwnerApiError(videoInvalid, 400);
  const storage = admin.storage.from(VIDEO_BUCKET);
  const path = pending.object_path as string;
  const { data: object } = await storage.info(path);
  if (!object || object.size !== pending.bytes || object.contentType !== "video/mp4") throw new OwnerApiError(videoInvalid, 400);
  const { data } = await storage.createSignedUrl(path, 30);
  if (!data?.signedUrl) throw new OwnerApiError("동영상을 확인하지 못했습니다. 다시 시도해 주세요.", 503);

  // Verify the container signature without reading or transcoding the whole clip.
  const response = await fetch(data.signedUrl, { headers: { Range: "bytes=0-11" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  const reader = response.body?.getReader();
  const header = Buffer.alloc(12);
  let read = 0;
  if (reader) {
    try {
      while (response.ok && read < header.length) {
        const { value, done } = await reader.read();
        if (done) break;
        read += Buffer.from(value).copy(header, read);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  if (!response.ok || read < 12 || header.toString("ascii", 4, 8) !== "ftyp") throw new OwnerApiError(videoInvalid, 400);
}

export async function mutateCommunity(owner: OwnerShopContext, payload: CommunityMutation, files: File[]) {
  if (files.length && !["create_post", "update_post"].includes(payload.action)) throw new OwnerApiError("사진을 첨부할 수 없는 작업입니다.", 400);
  if (payload.action === "prepare_video") return prepareVideo(owner, payload);

  // Check ownership/revision before touching Storage. Creates retry with the same ID.
  if (payload.action === "create_post") {
    const { data, error } = await communityAdmin().from("community_posts").select("id,author_id,title,body,category").eq("id", payload.id).maybeSingle();
    if (error) communityDatabaseError(error);
    if (data) {
      if (data.author_id !== owner.userId || data.title !== payload.title || data.body !== payload.body || data.category !== payload.category) throw new OwnerApiError("다른 내용으로 이미 등록된 요청입니다.", 409);
      return { id: data.id };
    }
  }
  let retainedMediaIds: string[] = [];
  const videoUploadId = "videoUploadId" in payload ? payload.videoUploadId : undefined;
  if (payload.action === "update_post") {
    const detail = await communityDispatch(owner, "detail", { postId: payload.id });
    if (!detail.post.isMine) throw new OwnerApiError("본인이 작성한 글만 수정할 수 있습니다.", 403);
    if (new Date(detail.post.updatedAt).getTime() !== new Date(payload.expectedUpdatedAt).getTime()) throw new OwnerApiError("글이 변경되었습니다. 다시 열어 수정해 주세요.", 409);
    const currentMedia = detail.post.images as MediaRow[];
    if (payload.retainedMediaIds.some((id) => !currentMedia.some((media) => media.mediaAssetId === id))) {
      throw new OwnerApiError("첨부 파일을 다시 확인해 주세요.", 400);
    }
    retainedMediaIds = currentMedia.filter((media) => isVideo(media.objectPath)
      ? !payload.removeVideo && !videoUploadId : payload.retainedMediaIds.includes(media.mediaAssetId))
      .map((media) => media.mediaAssetId);
  }
  if (files.length + retainedMediaIds.length + (videoUploadId ? 1 : 0) > COMMUNITY_ATTACHMENT_LIMIT) {
    throw new OwnerApiError("첨부 파일은 동영상을 포함해 3개까지 올릴 수 있습니다.", 400);
  }
  if (videoUploadId && (payload.action === "create_post" || payload.action === "update_post")) {
    await validateUploadedVideo(owner, payload.id, videoUploadId);
  }
  const admin = communityAdmin();
  const newMedia: MediaRow[] = [];
  try {
    for (const file of files) {
      if (file.size > 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new OwnerApiError("사진 형식과 크기를 확인해 주세요.", 400);
      let buffer: Buffer;
      try {
        buffer = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20000000, animated: false })
          .rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      } catch { throw new OwnerApiError("사진 파일을 읽지 못했습니다. 다른 사진을 선택해 주세요.", 400); }
      if (buffer.length > 1024 * 1024) throw new OwnerApiError("사진 크기가 큽니다. 더 작은 사진을 선택해 주세요.", 400);
      // The display copy is an optimisation: without it, lists fall back to the original.
      const thumbnail = await createCommunityThumbnail(buffer).catch(() => null);
      const mediaAssetId = randomUUID();
      const objectPath = `${owner.userId}/${mediaAssetId}.webp`;
      const storage = admin.storage.from(BUCKET);
      const [{ error }] = await Promise.all([
        storage.upload(objectPath, buffer, PHOTO_UPLOAD).catch((cause: unknown) => ({ error: cause })),
        thumbnail && storage.upload(communityThumbnailPath(objectPath), thumbnail, PHOTO_UPLOAD).catch(() => undefined),
      ]);
      if (error) {
        // Fresh, never-committed paths: removing them cannot touch a stored post.
        await storage.remove(withThumbnails([objectPath])).catch(() => undefined);
        throw new OwnerApiError("사진을 올리지 못했습니다. 작성한 내용을 유지하고 다시 시도해 주세요.", 503);
      }
      newMedia.push({ mediaAssetId, objectPath });
    }
    const input = { ...payload, retainedMediaIds, newMedia };
    let result;
    if (videoUploadId) {
      const { data, error } = await admin.rpc("community_save_post_with_video", {
        p_user: owner.userId, p_shop: owner.shopId, p_action: payload.action, p_payload: input, p_upload: videoUploadId,
      });
      if (error) communityDatabaseError(error);
      result = data;
    } else {
      result = await communityDispatch(owner, payload.action, input);
    }
    // Content is already committed. A Storage outage must not turn its
    // acknowledged result into an ambiguous failure; the durable queue retries.
    await cleanCommunityMedia().catch(() => undefined);
    return { id: result.id, success: true, ...(result.reaction ? { reaction: result.reaction } : {}), ...(result.commentReaction ? { commentReaction: result.commentReaction } : {}) };
  } catch (error) {
    // A transport timeout can follow a committed transaction. Only remove objects
    // that a successful follow-up DB read confirms are unattached.
    if (newMedia.length) {
      const { data, error: readError } = await admin.from("community_media_assets").select("object_path").in("media_asset_id", newMedia.map((m) => m.mediaAssetId));
      if (!readError) {
        const attached = new Set((data ?? []).map((m) => m.object_path));
        const unattached = newMedia.filter((m) => !attached.has(m.objectPath)).map((m) => m.objectPath);
        if (unattached.length) await admin.storage.from(BUCKET).remove(withThumbnails(unattached));
      }
    }
    throw error;
  }
}
