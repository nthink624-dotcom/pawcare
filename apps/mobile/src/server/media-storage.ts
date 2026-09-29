import { createHash, createHmac } from "node:crypto";

import { requireHttpsTransportUrl } from "@/lib/https-transport-url";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";

type StorageProvider = "supabase" | "r2";

type CreateSignedUploadUrlInput = {
  bucket: string;
  path: string;
  contentType: string;
  expiresInSeconds?: number;
};

type CreateSignedReadUrlInput = {
  bucket: string;
  path: string;
  expiresInSeconds: number;
};

type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

const DEFAULT_SIGNED_UPLOAD_SECONDS = 2 * 60 * 60;
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function hasCompleteR2Config() {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim(),
  );
}

function getMediaStorageProvider(): StorageProvider {
  const configured = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (configured === "supabase") return "supabase";
  const r2Requested = configured === "r2" || (!configured && process.env.VERCEL_ENV === "production");
  // Keep private uploads available during a partially configured R2 rollout.
  // Production still uses R2 whenever all required credentials are present.
  return r2Requested && hasCompleteR2Config() ? "r2" : "supabase";
}

function getMediaStorageProviderForPath(path: string): StorageProvider {
  const explicitProvider = path.match(/^(?:transient|retained)\/(supabase|r2)\//)?.[1];
  if (explicitProvider === "supabase" || explicitProvider === "r2") return explicitProvider;
  if (/^(?:transient|retained)\/shops\//.test(path) || path.startsWith("shops/")) {
    return getMediaStorageProvider();
  }
  // Mobile uploads created before the R2 cutover used <shopId>/... in Supabase Storage.
  return "supabase";
}

export function getMediaStorageInfo() {
  return { provider: getMediaStorageProvider() };
}

function getSupabaseStorageAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("Supabase 미디어 저장소 연결을 확인해 주세요.", 503);
  return admin;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new OwnerApiError(`${name} 설정을 확인해 주세요.`, 503);
  return value;
}

function getR2Config(bucket: string): R2Config {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: process.env.R2_BUCKET?.trim() || bucket,
    endpoint:
      process.env.R2_ENDPOINT?.trim().replace(/\/$/, "") ||
      `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function encodePath(path: string) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, AWS_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function buildR2SignedUrl(params: {
  method: "GET" | "PUT";
  bucket: string;
  path: string;
  expiresInSeconds: number;
}) {
  const config = getR2Config(params.bucket);
  const endpoint = requireHttpsTransportUrl(config.endpoint, "R2 미디어 저장소 주소", {
    allowLoopbackInDevelopment: true,
  });
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodeURIComponent(config.bucket)}/${encodePath(params.path)}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": AWS_ALGORITHM,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(params.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });
  query.sort();

  const canonicalRequest = [
    params.method,
    canonicalUri,
    query.toString(),
    `host:${host}\n`,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", getSigningKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");
  query.set("X-Amz-Signature", signature);
  return `${endpoint}${canonicalUri}?${query.toString()}`;
}

export async function createMediaSignedUploadUrl(input: CreateSignedUploadUrlInput) {
  if (getMediaStorageProviderForPath(input.path) === "r2") {
    return {
      provider: "r2" as const,
      bucket: input.bucket,
      path: input.path,
      signedUrl: buildR2SignedUrl({
        method: "PUT",
        bucket: input.bucket,
        path: input.path,
        expiresInSeconds: input.expiresInSeconds ?? DEFAULT_SIGNED_UPLOAD_SECONDS,
      }),
      token: null,
      method: "PUT" as const,
      headers: { "Content-Type": input.contentType },
    };
  }

  const signed = await getSupabaseStorageAdmin().storage.from(input.bucket).createSignedUploadUrl(input.path);
  if (signed.error || !signed.data) {
    throw new OwnerApiError(signed.error?.message ?? "사진 업로드 주소를 만들지 못했습니다.", 500);
  }
  return {
    provider: "supabase" as const,
    bucket: input.bucket,
    path: input.path,
    signedUrl: signed.data.signedUrl,
    token: signed.data.token,
    method: "SUPABASE_SIGNED_UPLOAD" as const,
    headers: {},
  };
}

export async function createMediaSignedReadUrl(input: CreateSignedReadUrlInput) {
  if (getMediaStorageProviderForPath(input.path) === "r2") {
    return buildR2SignedUrl({
      method: "GET",
      bucket: input.bucket,
      path: input.path,
      expiresInSeconds: input.expiresInSeconds,
    });
  }

  const signed = await getSupabaseStorageAdmin().storage
    .from(input.bucket)
    .createSignedUrl(input.path, input.expiresInSeconds);
  if (signed.error || !signed.data) {
    throw new OwnerApiError(signed.error?.message ?? "사진 조회 주소를 만들지 못했습니다.", 500);
  }
  return signed.data.signedUrl;
}
