import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import sharp from "sharp";

const state = {};
function reset() {
  Object.assign(state, {
    existing: new Set(), signCalls: [], uploads: [], removes: [], queue: [], deletedQueue: [], rpcCalls: [],
    failUpload: () => false, attached: [],
  });
}
reset();

function storage(bucket) {
  return {
    async createSignedUrls(paths, seconds) {
      state.signCalls.push({ bucket, paths: [...paths], seconds });
      return {
        error: null,
        data: paths.map((path) => state.existing.has(`${bucket}/${path}`)
          ? { path, signedUrl: `https://signed.test/${bucket}/${path}?call=${state.signCalls.length}`, error: null }
          : { path, signedUrl: null, error: "Either the object does not exist or you do not have access to it" }),
      };
    },
    async upload(path, body, options) {
      state.uploads.push({ bucket, path, body, options });
      if (state.failUpload(path)) return { data: null, error: { message: "upload failed" } };
      state.existing.add(`${bucket}/${path}`);
      return { data: { path }, error: null };
    },
    async remove(paths) {
      state.removes.push({ bucket, paths: [...paths] });
      for (const path of paths) state.existing.delete(`${bucket}/${path}`);
      return { data: [], error: null };
    },
  };
}

function query(table) {
  const ops = [];
  const result = () => {
    const names = ops.map(([name]) => name);
    if (table === "community_media_deletions" && names.includes("delete")) {
      state.deletedQueue.push(...ops.find(([name]) => name === "in")[2]);
      return { error: null };
    }
    if (table === "community_media_deletions") return { data: state.queue.map((object_path) => ({ object_path })), error: null };
    if (table === "community_media_assets") return { data: state.attached.map((object_path) => ({ object_path })), error: null };
    return { data: null, error: null };
  };
  const builder = new Proxy({}, {
    get(_, prop) {
      if (prop === "then") return (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      if (prop === "maybeSingle") return async () => result();
      return (...args) => { ops.push([prop, ...args]); return builder; };
    },
  });
  return builder;
}

const admin = {
  storage: { from: storage },
  from: query,
  async rpc(name, params) {
    state.rpcCalls.push({ name, params });
    return { data: { id: params.p_payload.id }, error: null };
  },
};

class OwnerApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
mock.module(new URL("../../src/lib/supabase/server.ts", import.meta.url).href, { namedExports: { getSupabaseAdmin: () => admin } });
mock.module(new URL("../../src/server/owner-api-auth.ts", import.meta.url).href, { namedExports: { OwnerApiError } });

const service = await import("../../src/server/community/service.ts");
const { communityThumbnailPath, createCommunityThumbnail, resolveCommunityImages, cleanCommunityMedia, mutateCommunity, COMMUNITY_THUMBNAIL_SIZE } = service;

const photo = (width, height) => sharp({ create: { width, height, channels: 3, background: "#c08040" } }).png().toBuffer();
const post = (...objectPaths) => ({ id: "p", images: objectPaths.map((objectPath, index) => ({ mediaAssetId: `m${index}`, objectPath })) });

describe("community photo display copies", () => {
  beforeEach(reset);

  it("derives the display path next to the original", () => {
    assert.equal(communityThumbnailPath("user-1/0f1e.webp"), "user-1/0f1e.thumb.webp");
    assert.equal(communityThumbnailPath("user-1/legacy"), "user-1/legacy.thumb.webp");
  });

  it("creates an 800px WebP copy and never enlarges small photos", async () => {
    const large = await sharp(await createCommunityThumbnail(await photo(1600, 1200))).metadata();
    assert.deepEqual([large.format, large.width, large.height], ["webp", COMMUNITY_THUMBNAIL_SIZE, 600]);
    const small = await sharp(await createCommunityThumbnail(await photo(400, 300))).metadata();
    assert.deepEqual([small.width, small.height], [400, 300]);
  });

  it("lists use the display copy, fall back to the original, and sign once per batch", async () => {
    state.existing = new Set(["community-images/u/new.webp", "community-images/u/new.thumb.webp", "community-images/u/old.webp"]);
    const listed = await resolveCommunityImages({ posts: [post("u/new.webp", "u/old.webp")] }, { thumbnails: true });
    assert.equal(state.signCalls.length, 1);
    assert.deepEqual(state.signCalls[0].paths.sort(), ["u/new.thumb.webp", "u/new.webp", "u/old.thumb.webp", "u/old.webp"]);
    assert.equal(state.signCalls[0].seconds, 60);
    assert.match(listed.posts[0].images[0].url, /u\/new\.thumb\.webp/);
    assert.match(listed.posts[0].images[1].url, /u\/old\.webp/);

    // Repeated reads reuse the same links, including the remembered absent copy.
    const again = await resolveCommunityImages({ posts: [post("u/new.webp", "u/old.webp")] }, { thumbnails: true });
    assert.equal(state.signCalls.length, 1);
    assert.deepEqual(again.posts[0].images.map((image) => image.url), listed.posts[0].images.map((image) => image.url));
  });

  it("detail keeps the full-size original", async () => {
    state.existing = new Set(["community-images/u/detail.webp", "community-images/u/detail.thumb.webp"]);
    const detail = await resolveCommunityImages({ post: post("u/detail.webp") });
    assert.deepEqual(state.signCalls[0].paths, ["u/detail.webp"]);
    assert.match(detail.post.images[0].url, /u\/detail\.webp/);
  });

  it("a missing original still fails the read", async () => {
    state.existing = new Set(["community-images/u/gone.thumb.webp"]);
    await assert.rejects(resolveCommunityImages({ posts: [post("u/gone.webp")] }, { thumbnails: true }), (error) => error.status === 503);
  });

  it("queue cleanup removes display copies with their originals", async () => {
    state.queue = ["u/a.webp", "u/clip.mp4"];
    await cleanCommunityMedia();
    const images = state.removes.find((call) => call.bucket === "community-images");
    const videos = state.removes.find((call) => call.bucket === "community-videos");
    assert.deepEqual(images.paths, ["u/a.webp", "u/a.thumb.webp"]);
    assert.deepEqual(videos.paths, ["u/clip.mp4"]);
    assert.deepEqual(state.deletedQueue.sort(), ["u/a.webp", "u/clip.mp4"]);
  });

  it("uploads the display copy beside each new photo", async () => {
    const file = new File([await photo(1600, 1200)], "a.png", { type: "image/png" });
    const owner = { userId: "user-1", shopId: "shop-1", role: "owner", staffId: null };
    await mutateCommunity(owner, { action: "create_post", id: "post-1", title: "t", body: "b", category: "lounge" }, [file]);
    const [original, copy] = [...state.uploads].sort((a, b) => a.path.length - b.path.length);
    assert.match(original.path, /^user-1\/[0-9a-f-]+\.webp$/);
    assert.equal(copy.path, communityThumbnailPath(original.path));
    assert.deepEqual(copy.options, { contentType: "image/webp", upsert: false });
    assert.equal((await sharp(copy.body).metadata()).width, COMMUNITY_THUMBNAIL_SIZE);
    assert.deepEqual(state.rpcCalls[0].params.p_payload.newMedia.map((media) => media.objectPath), [original.path]);
  });

  it("a failed original upload removes both fresh paths and keeps the post unsaved", async () => {
    state.failUpload = (path) => !path.endsWith(".thumb.webp");
    const file = new File([await photo(800, 600)], "a.png", { type: "image/png" });
    const owner = { userId: "user-1", shopId: "shop-1", role: "owner", staffId: null };
    await assert.rejects(mutateCommunity(owner, { action: "create_post", id: "post-2", title: "t", body: "b", category: "lounge" }, [file]), (error) => error.status === 503);
    const original = state.uploads.find((upload) => !upload.path.endsWith(".thumb.webp")).path;
    assert.deepEqual(state.removes.at(-1).paths, [original, communityThumbnailPath(original)]);
    assert.equal(state.existing.size, 0);
    assert.equal(state.rpcCalls.length, 0);
  });
});
