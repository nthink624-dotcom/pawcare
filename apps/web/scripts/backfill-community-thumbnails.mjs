// Creates the feed/saved display copy (".thumb.webp") for community photos uploaded
// before display copies existed. Dry run by default: it only counts. Writing needs
// `--apply` and an explicit `--project-ref` that matches the env file's Supabase URL.
//
//   node scripts/backfill-community-thumbnails.mjs --project-ref <ref> [--env .env.local] [--apply]
//
// Prints counts and a masked project ref only (no object paths, user IDs or keys).
// Keep the image settings in sync with COMMUNITY_THUMBNAIL_SIZE / createCommunityThumbnail
// in src/server/community/service.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "community-images";
const THUMBNAIL_SIZE = 800;
const THUMBNAIL_QUALITY = 75;
const PAGE = 100;

export function communityThumbnailPath(objectPath) {
  return `${objectPath.replace(/\.[^./]+$/, "")}.thumb.webp`;
}

function parseArgs(argv) {
  const args = { apply: false, env: ".env.local", projectRef: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--env") args.env = argv[++index] ?? "";
    else if (arg === "--project-ref") args.projectRef = argv[++index] ?? "";
    else throw new Error(`알 수 없는 인수: ${arg}`);
  }
  return args;
}

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const maskRef = (ref) => (ref && ref.length >= 10 ? `${ref.slice(0, 6)}...${ref.slice(-4)}` : ref || "(missing)");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const env = parseEnv(fs.readFileSync(path.resolve(root, args.env), "utf8"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = url.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/)?.[1] ?? "";
  if (!ref || !key) throw new Error("env 파일에서 Supabase URL 또는 서버 키를 찾지 못했습니다.");
  if (!args.projectRef || args.projectRef !== ref) {
    throw new Error(`--project-ref 가 env 대상(${maskRef(ref)})과 일치해야 합니다.`);
  }
  console.log(`대상 프로젝트: ${maskRef(ref)} · 모드: ${args.apply ? "적용(쓰기)" : "점검(쓰기 없음)"}`);

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const storage = admin.storage.from(BUCKET);
  const counts = { photos: 0, existing: 0, missing: 0, created: 0, skippedDeleted: 0, failed: 0 };

  for (let from = 0; ; from += PAGE) {
    const { data: rows, error } = await admin.from("community_media_assets")
      .select("object_path").order("object_path").range(from, from + PAGE - 1);
    if (error) throw new Error("사진 목록을 읽지 못했습니다.");
    const photos = (rows ?? []).map((row) => row.object_path).filter((objectPath) => !objectPath.endsWith(".mp4"));
    counts.photos += photos.length;
    if (photos.length) {
      // Signing is read-only and reports absent objects per path.
      const { data: signed, error: signError } = await storage.createSignedUrls(photos.map(communityThumbnailPath), 10);
      if (signError || !signed) throw new Error("기존 썸네일 여부를 확인하지 못했습니다.");
      const present = new Set(signed.filter((item) => item.signedUrl && !item.error).map((item) => item.path));
      for (const objectPath of photos) {
        const thumbnailPath = communityThumbnailPath(objectPath);
        if (present.has(thumbnailPath)) { counts.existing += 1; continue; }
        counts.missing += 1;
        if (!args.apply) continue;
        try {
          const { data: original, error: downloadError } = await storage.download(objectPath);
          if (downloadError || !original) throw new Error("download");
          const thumbnail = await sharp(Buffer.from(await original.arrayBuffer()), { limitInputPixels: 20000000, animated: false })
            .rotate()
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: THUMBNAIL_QUALITY }).toBuffer();
          const { error: uploadError } = await storage.upload(thumbnailPath, thumbnail, { contentType: "image/webp", upsert: false });
          if (uploadError) throw new Error("upload");
          // A post deleted meanwhile has already queued its original for cleanup; do not leave its copy behind.
          const { data: stillAttached, error: readError } = await admin.from("community_media_assets")
            .select("object_path").eq("object_path", objectPath).maybeSingle();
          if (!readError && !stillAttached) {
            await storage.remove([thumbnailPath]);
            counts.skippedDeleted += 1;
          } else counts.created += 1;
        } catch {
          counts.failed += 1;
        }
      }
    }
    if ((rows ?? []).length < PAGE) break;
  }
  console.log(`사진 ${counts.photos}장 · 썸네일 있음 ${counts.existing} · 없음 ${counts.missing}`);
  if (args.apply) console.log(`생성 ${counts.created} · 삭제된 글이라 정리 ${counts.skippedDeleted} · 실패 ${counts.failed}`);
  if (counts.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "썸네일 보충에 실패했습니다.");
    process.exitCode = 1;
  });
}
