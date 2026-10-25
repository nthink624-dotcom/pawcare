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

  assert.match(storage, /process\.env\.MEDIA_STORAGE_PROVIDER === "r2"/);
  assert.match(storage, /R2_ACCESS_KEY_ID/);
  assert.match(storage, /R2_SECRET_ACCESS_KEY/);
  assert.match(storage, /Mobile uploads created before the R2 cutover/);
  assert.match(service, /createMediaSignedUploadUrl/);
  assert.match(service, /createMediaSignedReadUrl/);
  assert.doesNotMatch(service, /supabase\.storage/);
  assert.match(client, /params\.method === "PUT" && params\.signedUrl/);
  assert.match(client, /uploadToSignedUrl/);
});
