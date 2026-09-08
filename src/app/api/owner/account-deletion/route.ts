import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { removeMediaStorageObjects, verifyMediaStorageObjectsAbsent } from "@/server/media-storage";

export const runtime = "nodejs";

const requestSchema = z.object({
  confirmation: z.literal(true),
  currentPassword: z.string().min(1).max(1024),
  idempotencyKey: z.string().uuid(),
});

type DeletionClaim = {
  request_id: string;
  state: "prepared" | "data_purged" | "terminal";
  shop_ids: string[];
};

type StorageTarget = {
  bucket: string;
  storage_path: string;
};

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function hashIdempotencyKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function messageForDeletionError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  if (message.includes("OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL")) {
    return { status: 409, message: "결제·환불 상태가 확정된 뒤 탈퇴할 수 있어요." };
  }
  if (message.includes("OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED")) {
    return { status: 409, message: "보존 대상 결제 기록을 확인 중이라 지금은 탈퇴를 진행할 수 없어요." };
  }
  if (message.includes("OWNER_ACCOUNT_DELETION_OWNER_NOT_FOUND")) {
    return { status: 403, message: "오너 계정을 확인하지 못했어요." };
  }
  if (message.includes("OWNER_ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT")) {
    return { status: 409, message: "이 탈퇴 요청은 다시 확인해 주세요." };
  }
  return { status: 503, message: "탈퇴 처리를 안전하게 시작하지 못했어요. 잠시 후 다시 시도해 주세요." };
}

function readClaim(value: unknown): DeletionClaim | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<DeletionClaim>;
  if (
    typeof candidate.request_id !== "string" ||
    !["prepared", "data_purged", "terminal"].includes(candidate.state ?? "") ||
    !Array.isArray(candidate.shop_ids) ||
    !candidate.shop_ids.every((shopId) => typeof shopId === "string")
  ) {
    return null;
  }

  return candidate as DeletionClaim;
}

async function removeShopStorage(params: {
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  shopIds: string[];
}) {
  if (params.shopIds.length === 0) return null;

  const assetsResult = await params.admin
    .from("media_assets")
    .select("id,bucket,storage_path")
    .in("shop_id", params.shopIds);
  if (assetsResult.error) return assetsResult.error;

  const assets = (assetsResult.data ?? []) as Array<StorageTarget & { id: unknown }>;
  const assetIds = assets.map((asset) => asset.id).filter((id): id is string => typeof id === "string");
  const variantsResult = assetIds.length
    ? await params.admin.from("media_variants").select("bucket,storage_path").in("media_asset_id", assetIds)
    : { data: [], error: null };
  if (variantsResult.error) return variantsResult.error;

  const targets = [...assets, ...(variantsResult.data ?? [])] as StorageTarget[];
  if (targets.some((target) => !target.bucket || !target.storage_path)) {
    return new Error("Media storage target is incomplete.");
  }

  const byBucket = new Map<string, Set<string>>();
  for (const target of targets) {
    const paths = byBucket.get(target.bucket) ?? new Set<string>();
    paths.add(target.storage_path);
    byBucket.set(target.bucket, paths);
  }

  try {
    for (const [bucket, paths] of byBucket) {
      const exactPaths = [...paths];
      await removeMediaStorageObjects({ bucket, paths: exactPaths });
      const absent = await verifyMediaStorageObjectsAbsent({ bucket, paths: exactPaths });
      if (!absent) return new Error("Media storage residue detected.");
    }
  } catch (error) {
    return error instanceof Error ? error : new Error("Media storage cleanup failed.");
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "탈퇴 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const body = requestSchema.parse(await request.json());
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const authClient = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!authClient || !admin) {
      return NextResponse.json({ message: "탈퇴 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const userResult = await authClient.auth.getUser(accessToken);
    const user = userResult.data.user;
    if (userResult.error || !user?.email) {
      return NextResponse.json({ message: "로그인을 다시 확인해 주세요." }, { status: 401 });
    }

    // Re-authenticate before any stateful deletion request. This session is never returned or logged.
    const passwordResult = await authClient.auth.signInWithPassword({ email: user.email, password: body.currentPassword });
    if (passwordResult.error || passwordResult.data.user?.id !== user.id) {
      return NextResponse.json({ message: "현재 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const claimResult = await admin.rpc("claim_owner_account_deletion_v1", {
      p_owner_user_id: user.id,
      p_idempotency_key_hash: hashIdempotencyKey(body.idempotencyKey),
    });
    if (claimResult.error) {
      const mapped = messageForDeletionError(claimResult.error);
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }

    const claim = readClaim(claimResult.data);
    if (!claim) {
      return NextResponse.json({ message: "탈퇴 요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }
    if (claim.state === "terminal") {
      return NextResponse.json({ success: true });
    }

    if (claim.state === "prepared") {
      const storageError = await removeShopStorage({ admin, shopIds: claim.shop_ids });
      if (storageError) {
        return NextResponse.json({ message: "첨부 파일을 안전하게 삭제하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
      }

      const signOutResult = await admin.auth.admin.signOut(accessToken, "global");
      if (signOutResult.error) {
        return NextResponse.json({ message: "로그아웃을 완료하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
      }

      const purgeResult = await admin.rpc("finalize_owner_account_deletion_v1", {
        p_request_id: claim.request_id,
        p_owner_user_id: user.id,
      });
      if (purgeResult.error) {
        return NextResponse.json({ message: "개인정보 삭제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
      }
    }

    const deleteUserResult = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserResult.error) {
      return NextResponse.json({ message: "계정 종료를 완료하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }

    const completeResult = await admin.rpc("complete_owner_account_deletion_v1", { p_request_id: claim.request_id });
    if (completeResult.error) {
      return NextResponse.json({ message: "계정 종료 상태를 기록하지 못했어요. 지원팀에 문의해 주세요." }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "현재 비밀번호와 탈퇴 확인을 다시 입력해 주세요." }, { status: 400 });
    }
    return NextResponse.json({ message: "탈퇴 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
