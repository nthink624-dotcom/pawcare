import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, type OwnerShopContext } from "@/server/owner-api-auth";
import type { CommunityMutation } from "./schema";

const BUCKET = "community-images";
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
  if (error.code === "23514" || error.message.includes("COMMUNITY_INVALID")) throw new OwnerApiError("입력 내용과 사진 개수를 확인해 주세요.", 400);
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
/** Opportunistic, retryable cleanup. Queue rows stay until Storage acknowledges deletion. */
export async function cleanCommunityMedia() {
  const admin = communityAdmin();
  const { data, error } = await admin.from("community_media_deletions").select("object_path").order("requested_at").limit(50);
  if (error || !data?.length) return;
  const paths = data.map((row) => row.object_path as string);
  const result = await admin.storage.from(BUCKET).remove(paths);
  if (!result.error) await admin.from("community_media_deletions").delete().in("object_path", paths);
}
type MediaRow = { mediaAssetId: string; objectPath: string };
type StoredPost = { images: MediaRow[] };
export async function resolveCommunityImages(result: { posts?: StoredPost[]; post?: StoredPost }) {
  const posts = result.posts ?? (result.post ? [result.post] : []);
  const paths = posts.flatMap((p) => p.images.map((image) => image.objectPath));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await communityAdmin().storage.from(BUCKET).createSignedUrls(paths, 60);
    if (error || !data || data.some((image) => image.error || !image.signedUrl)) {
      throw new OwnerApiError("사진을 불러오지 못했습니다. 다시 시도해 주세요.", 503);
    }
    data.forEach((image) => urls.set(image.path ?? "", image.signedUrl!));
  }
  return {
    ...result,
    ...(result.posts ? { posts: result.posts.map((p) => ({ ...p, images: p.images.map((m) => ({ mediaAssetId: m.mediaAssetId, url: urls.get(m.objectPath) })) })) } : {}),
    ...(result.post ? { post: { ...result.post, images: result.post.images.map((m) => ({ mediaAssetId: m.mediaAssetId, url: urls.get(m.objectPath) })) } } : {}),
  };
}
export async function mutateCommunity(owner: OwnerShopContext, payload: CommunityMutation, files: File[]) {
  if (files.length && !["create_post", "update_post"].includes(payload.action)) throw new OwnerApiError("사진을 첨부할 수 없는 작업입니다.", 400);
  if (files.length > 3 || ("retainedMediaIds" in payload && files.length + payload.retainedMediaIds.length > 3)) throw new OwnerApiError("사진은 3장까지 첨부할 수 있습니다.", 400);
  // Check ownership/revision before touching Storage. Creates retry with the same ID.
  if (payload.action === "create_post") {
    const { data, error } = await communityAdmin().from("community_posts").select("id,author_id,title,body,category").eq("id", payload.id).maybeSingle();
    if (error) communityDatabaseError(error);
    if (data) {
      if (data.author_id !== owner.userId || data.title !== payload.title || data.body !== payload.body || data.category !== payload.category) throw new OwnerApiError("다른 내용으로 이미 등록된 요청입니다.", 409);
      return { id: data.id };
    }
  }
  if (payload.action === "update_post") {
    const detail = await communityDispatch(owner, "detail", { postId: payload.id });
    if (!detail.post.isMine) throw new OwnerApiError("본인이 작성한 글만 수정할 수 있습니다.", 403);
    if (new Date(detail.post.updatedAt).getTime() !== new Date(payload.expectedUpdatedAt).getTime()) throw new OwnerApiError("글이 변경되었습니다. 다시 열어 수정해 주세요.", 409);
    if (payload.retainedMediaIds.some((id) => !detail.post.images.some((m: MediaRow) => m.mediaAssetId === id))) throw new OwnerApiError("첨부 사진을 다시 확인해 주세요.", 400);
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
      const mediaAssetId = randomUUID();
      const objectPath = `${owner.userId}/${mediaAssetId}.webp`;
      const { error } = await admin.storage.from(BUCKET).upload(objectPath, buffer, { contentType: "image/webp", upsert: false });
      if (error) throw new OwnerApiError("사진을 올리지 못했습니다. 작성한 내용을 유지하고 다시 시도해 주세요.", 503);
      newMedia.push({ mediaAssetId, objectPath });
    }
    const result = await communityDispatch(owner, payload.action, { ...payload, newMedia });
    // Content is already committed. A Storage outage must not turn its
    // acknowledged result into an ambiguous failure; the durable queue retries.
    await cleanCommunityMedia().catch(() => undefined);
    return { id: result.id, success: true };
  } catch (error) {
    // A transport timeout can follow a committed transaction. Only remove objects
    // that a successful follow-up DB read confirms are unattached.
    if (newMedia.length) {
      const { data, error: readError } = await admin.from("community_media_assets").select("object_path").in("media_asset_id", newMedia.map((m) => m.mediaAssetId));
      if (!readError) {
        const attached = new Set((data ?? []).map((m) => m.object_path));
        const unattached = newMedia.filter((m) => !attached.has(m.objectPath)).map((m) => m.objectPath);
        if (unattached.length) await admin.storage.from(BUCKET).remove(unattached);
      }
    }
    throw error;
  }
}
