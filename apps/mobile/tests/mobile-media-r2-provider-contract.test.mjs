import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile media uses server-signed R2 URLs while preserving legacy Supabase reads", async () => {
  const [storage, service, client] = await Promise.all([
    source("src/server/media-storage.ts"),
    source("src/server/owner-media-service.ts"),
    source("src/lib/media/owner-media-client.ts"),
  ]);

  assert.match(storage, /configured === "r2"/);
  assert.match(storage, /configured && configured !== "r2" && configured !== "supabase"[\s\S]*MEDIA_STORAGE_PROVIDER must be set to r2/);
  assert.match(storage, /Production media storage must use Cloudflare R2/);
  assert.match(storage, /Cloudflare R2 media storage is not fully configured/);
  assert.match(storage, /return r2Requested \? "r2" : "supabase"/);
  assert.match(storage, /R2_ACCESS_KEY_ID/);
  assert.match(storage, /R2_SECRET_ACCESS_KEY/);
  assert.match(storage, /Mobile uploads created before the R2 cutover/);
  assert.match(service, /createMediaSignedUploadUrl/);
  assert.match(service, /createMediaSignedReadUrl/);
  assert.doesNotMatch(service, /supabase\.storage/);
  assert.match(client, /params\.method === "PUT" && params\.signedUrl/);
  assert.match(client, /uploadToSignedUrl/);
});
