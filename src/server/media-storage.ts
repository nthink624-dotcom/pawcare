import { createHash, createHmac } from "node:crypto";

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

type RemoveObjectsInput = {
  bucket: string;
  paths: string[];
};

type R2Config = {
  accountId: string;
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

function getMediaStorageProvider(): StorageProvider {
  return process.env.MEDIA_STORAGE_PROVIDER === "r2" ? "r2" : "supabase";
}

function getSupabaseStorageAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("Supabase media storage connection is unavailable.", 503);
  }
  return admin;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new OwnerApiError(`${name} is required for R2 media storage.`, 503);
  }
  return value;
}

function getR2Config(bucket: string): R2Config {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const configuredBucket = process.env.R2_BUCKET?.trim() || bucket;

  return {
    accountId,
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: configuredBucket,
    endpoint:
      process.env.R2_ENDPOINT?.trim().replace(/\/$/, "") ||
      `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date: Date) {
  return toAmzDate(date).slice(0, 8);
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, AWS_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function buildR2SignedUrl(params: {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  path: string;
  expiresInSeconds: number;
}) {
  const config = getR2Config(params.bucket);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const host = new URL(config.endpoint).host;
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
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", getSigningKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");

  query.set("X-Amz-Signature", signature);

  return `${config.endpoint}${canonicalUri}?${query.toString()}`;
}

export function getMediaStorageInfo() {
  return {
    provider: getMediaStorageProvider(),
  };
}

export async function createMediaSignedUploadUrl(input: CreateSignedUploadUrlInput) {
  if (getMediaStorageProvider() === "r2") {
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
      headers: {
        "Content-Type": input.contentType,
      },
      expiresInSeconds: input.expiresInSeconds ?? DEFAULT_SIGNED_UPLOAD_SECONDS,
    };
  }

  const admin = getSupabaseStorageAdmin();
  const signedUpload = await admin.storage.from(input.bucket).createSignedUploadUrl(input.path);
  if (signedUpload.error || !signedUpload.data) {
    throw new OwnerApiError(signedUpload.error?.message ?? "Could not create media upload URL.", 500);
  }

  return {
    provider: "supabase" as const,
    bucket: input.bucket,
    path: input.path,
    signedUrl: signedUpload.data.signedUrl,
    token: signedUpload.data.token,
    method: "SUPABASE_SIGNED_UPLOAD" as const,
    headers: {},
    expiresInSeconds: DEFAULT_SIGNED_UPLOAD_SECONDS,
  };
}

export async function createMediaSignedReadUrl(input: CreateSignedReadUrlInput) {
  if (getMediaStorageProvider() === "r2") {
    return buildR2SignedUrl({
      method: "GET",
      bucket: input.bucket,
      path: input.path,
      expiresInSeconds: input.expiresInSeconds,
    });
  }

  const admin = getSupabaseStorageAdmin();
  const signedUrl = await admin.storage.from(input.bucket).createSignedUrl(input.path, input.expiresInSeconds);
  if (signedUrl.error || !signedUrl.data) {
    throw new OwnerApiError(signedUrl.error?.message ?? "Could not create media signed URL.", 500);
  }

  return signedUrl.data.signedUrl;
}

export async function removeMediaStorageObjects(input: RemoveObjectsInput) {
  if (!input.paths.length) return;

  if (getMediaStorageProvider() === "r2") {
    for (const path of input.paths) {
      const signedUrl = buildR2SignedUrl({
        method: "DELETE",
        bucket: input.bucket,
        path,
        expiresInSeconds: 60,
      });
      const response = await fetch(signedUrl, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 delete failed for ${path}: ${response.status}`);
      }
    }
    return;
  }

  const admin = getSupabaseStorageAdmin();
  const removeResult = await admin.storage.from(input.bucket).remove(input.paths);
  if (removeResult.error) {
    throw new Error(removeResult.error.message);
  }
}
