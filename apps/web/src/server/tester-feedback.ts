import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  TesterAccessDecisionAction,
  TesterAccessDecisionState,
  TesterAccessProjection,
  TesterFeedbackCategory,
  TesterFeedbackItem,
  TesterFeedbackScreenKey,
  TesterFeedbackStatus,
} from "@/lib/tester-feedback";
import {
  resolveTesterAccessDisplayState,
  resolveTesterAccessNotice,
} from "@/lib/tester-feedback";
import { createMediaSignedReadUrl, removeMediaStorageObjects, verifyMediaStorageObjectsAbsent } from "@/server/media-storage";

export class TesterFeedbackError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type TesterFeedbackRow = {
  id: string;
  shop_id: string;
  owner_user_id: string;
  category: TesterFeedbackCategory;
  body: string;
  screen_key: TesterFeedbackScreenKey;
  app_version: string;
  status: TesterFeedbackStatus;
  screenshot_media_asset_id: string | null;
  screenshot_content_type: "image/jpeg" | "image/png" | "image/webp" | null;
  screenshot_byte_size: number | null;
  screenshot_consented_at: string | null;
  screenshot_receipt_fingerprint: string | null;
  screenshot_deleted_at: string | null;
  created_at: string;
  updated_at: string;
  shops?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type TesterAccessRow = {
  shop_id: string;
  owner_user_id: string;
  cohort_position: number;
  status: "planned" | "active" | "paused" | "completed" | "excluded";
  tester_access_decision_state?: TesterAccessDecisionState | null;
  tester_access_review_due_at?: string | null;
};

const FEEDBACK_SELECT = "id,shop_id,owner_user_id,category,body,screen_key,app_version,status,screenshot_media_asset_id,screenshot_content_type,screenshot_byte_size,screenshot_consented_at,screenshot_receipt_fingerprint,screenshot_deleted_at,created_at,updated_at,shops(name)";

function requireAdminClient() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new TesterFeedbackError("피드백 데이터 연결을 확인해 주세요.", 503);
  return admin;
}

function isMissingSchema(error: DatabaseErrorLike | null | undefined) {
  const detail = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || error?.code === "42883" || detail.includes("tester_feedback") || detail.includes("hanmadi");
}

function translateSubmitError(error: DatabaseErrorLike | null | undefined) {
  const message = error?.message ?? "";
  if (isMissingSchema(error)) return new TesterFeedbackError("피드백 허브 DB 준비가 필요합니다.", 503);
  if (message.includes("PM_TESTER_FEEDBACK_MEMBER_REQUIRED")) return new TesterFeedbackError("테스터로 등록된 매장에서만 피드백을 보낼 수 있습니다.", 403);
  if (message.includes("PM_TESTER_FEEDBACK_IDEMPOTENCY_CONFLICT") || message.includes("PM_HANMADI_IDEMPOTENCY_CONFLICT")) return new TesterFeedbackError("같은 요청의 내용이 달라 피드백을 보내지 않았습니다.", 409);
  if (message.includes("PM_TESTER_FEEDBACK_RATE_LIMIT") || message.includes("PM_HANMADI_RATE_LIMIT")) return new TesterFeedbackError("피드백을 연속으로 많이 보냈습니다. 잠시 후 다시 보내 주세요.", 429);
  if (message.includes("PM_HANMADI_OWNER_SHOP_REQUIRED")) return new TesterFeedbackError("현재 매장의 대표 권한을 확인해 주세요.", 403);
  if (message.includes("PM_HANMADI_SCREENSHOT")) return new TesterFeedbackError("스크린샷 첨부를 확인하지 못했습니다. 다시 선택해 주세요.", 400);
  if (message.includes("PM_HANMADI_TESTER_REQUIRED")) return new TesterFeedbackError("테스트 매장 상태를 확인해 주세요.", 409);
  if (message.includes("PM_HANMADI_TESTER_DECISION_FINAL")) return new TesterFeedbackError("이미 종료된 테스트 기간 결정은 다시 변경하지 않습니다.", 409);
  return new TesterFeedbackError("피드백을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
}

function emptyTesterAccessProjection(schemaReady: boolean): TesterAccessProjection {
  return {
    schemaReady,
    isTester: false,
    cohortStatus: null,
    displayState: null,
    reviewDueAt: null,
    noticeKey: null,
    noticeLabel: null,
  };
}

function mapTesterAccess(row: TesterAccessRow | undefined, schemaReady: boolean): TesterAccessProjection {
  if (!row) return emptyTesterAccessProjection(schemaReady);
  const isTester = row.status !== "excluded";
  const decisionState = row.tester_access_decision_state ?? "pending";
  const reviewDueAt = row.tester_access_review_due_at ?? null;
  const notice = schemaReady
    ? resolveTesterAccessNotice({
        isTester,
        decisionState,
        reviewDueAt,
        cohortPosition: row.cohort_position,
      })
    : { noticeKey: null, noticeLabel: null };
  return {
    schemaReady,
    isTester,
    cohortStatus: row.status,
    displayState: schemaReady ? resolveTesterAccessDisplayState({ isTester, decisionState, reviewDueAt }) : null,
    reviewDueAt,
    ...notice,
  };
}

async function loadTesterAccessMap(admin: ReturnType<typeof requireAdminClient>, rows: TesterFeedbackRow[]) {
  const map = new Map<string, TesterAccessProjection>();
  const shopIds = [...new Set(rows.map((row) => row.shop_id))];
  if (shopIds.length === 0) return { map, schemaReady: true };
  let schemaReady = true;
  const result = await admin
    .from("owner_pilot_cohort_memberships")
    .select("shop_id,owner_user_id,cohort_position,status,tester_access_decision_state,tester_access_review_due_at")
    .in("shop_id", shopIds);
  let error = result.error;
  let data: unknown[] = result.data ?? [];
  if (result.error && /tester_access_(decision_state|review_due_at)/i.test(result.error.message ?? "")) {
    schemaReady = false;
    const legacyResult = await admin
      .from("owner_pilot_cohort_memberships")
      .select("shop_id,owner_user_id,cohort_position,status")
      .in("shop_id", shopIds);
    error = legacyResult.error;
    data = legacyResult.data ?? [];
  }
  if (error) {
    const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
    if (isMissingSchema(error) || detail.includes("owner_pilot_cohort_memberships")) {
      return { map, schemaReady: false };
    }
    throw new TesterFeedbackError("테스터 강조 상태를 확인하지 못했습니다.", 503);
  }
  for (const raw of data) {
    const row = raw as TesterAccessRow;
    map.set(`${row.shop_id}:${row.owner_user_id}`, mapTesterAccess(row, schemaReady));
  }
  return { map, schemaReady };
}

function mapRow(row: TesterFeedbackRow, tester = emptyTesterAccessProjection(false)): TesterFeedbackItem {
  const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: shop?.name ?? null,
    category: row.category,
    body: row.body,
    screenKey: row.screen_key,
    appVersion: row.app_version,
    status: row.status,
    tester,
    screenshot: {
      attached: Boolean(row.screenshot_media_asset_id) && !row.screenshot_deleted_at,
      contentType: row.screenshot_content_type,
      byteSize: row.screenshot_byte_size,
      consentedAt: row.screenshot_consented_at,
      receiptFingerprint: row.screenshot_receipt_fingerprint,
      deletedAt: row.screenshot_deleted_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function submitTesterFeedback(input: {
  ownerUserId: string;
  shopId: string;
  requestId: string;
  category: TesterFeedbackCategory;
  body: string;
  screenKey: TesterFeedbackScreenKey;
  appVersion: string;
  screenshot: {
    mediaAssetId: string;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    byteSize: number;
    consent: true;
  } | null;
}) {
  const admin = requireAdminClient();
  const result = await admin.rpc("submit_hanmadi_feedback_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_request_id: input.requestId,
    p_category: input.category,
    p_body: input.body,
    p_screen_key: input.screenKey,
    p_app_version: input.appVersion,
    p_screenshot_media_asset_id: input.screenshot?.mediaAssetId ?? null,
    p_screenshot_content_type: input.screenshot?.contentType ?? null,
    p_screenshot_byte_size: input.screenshot?.byteSize ?? null,
    p_screenshot_consent: input.screenshot?.consent === true,
  });
  if (result.error) throw translateSubmitError(result.error);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.feedback_id) throw new TesterFeedbackError("피드백 접수 결과를 확인하지 못했습니다.", 503);
  return {
    feedback: {
      id: String(row.feedback_id),
      category: input.category,
      screenKey: input.screenKey,
      appVersion: input.appVersion,
      status: String(row.feedback_status) as TesterFeedbackStatus,
      createdAt: String(row.created_at),
      testerEmphasis: row.is_tester === true,
      screenshotAccepted: row.screenshot_accepted === true,
    },
    replayed: row.replayed === true,
  };
}

export async function listTesterFeedback(input: {
  category?: TesterFeedbackCategory;
  status?: TesterFeedbackStatus;
  limit?: number;
}) {
  const admin = requireAdminClient();
  let query = admin
    .from("tester_feedback_submissions")
    .select(FEEDBACK_SELECT)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.category) query = query.eq("category", input.category);
  if (input.status) query = query.eq("status", input.status);
  const result = await query.returns<TesterFeedbackRow[]>();
  if (result.error) {
    if (isMissingSchema(result.error)) throw new TesterFeedbackError("피드백 허브 DB 준비가 필요합니다.", 503);
    throw new TesterFeedbackError("피드백을 불러오지 못했습니다.", 503);
  }
  const rows = (result.data ?? []) as TesterFeedbackRow[];
  const access = await loadTesterAccessMap(admin, rows);
  return rows.map((row) => mapRow(row, access.map.get(`${row.shop_id}:${row.owner_user_id}`) ?? emptyTesterAccessProjection(access.schemaReady)));
}

export async function updateTesterFeedbackStatus(input: {
  feedbackId: string;
  status: TesterFeedbackStatus;
}) {
  const admin = requireAdminClient();
  const result = await admin
    .from("tester_feedback_submissions")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.feedbackId)
    .select(FEEDBACK_SELECT)
    .single<TesterFeedbackRow>();
  if (result.error) {
    if (isMissingSchema(result.error)) throw new TesterFeedbackError("피드백 허브 DB 준비가 필요합니다.", 503);
    throw new TesterFeedbackError("피드백 상태를 저장하지 못했습니다.", 503);
  }
  const row = result.data as TesterFeedbackRow;
  const access = await loadTesterAccessMap(admin, [row]);
  return mapRow(row, access.map.get(`${row.shop_id}:${row.owner_user_id}`) ?? emptyTesterAccessProjection(access.schemaReady));
}

export async function decideTesterAccess(input: {
  feedbackId: string;
  action: TesterAccessDecisionAction;
  adminEmail: string;
  requestId: string;
}) {
  const admin = requireAdminClient();
  const feedback = await admin
    .from("tester_feedback_submissions")
    .select("shop_id,owner_user_id")
    .eq("id", input.feedbackId)
    .maybeSingle();
  if (feedback.error || !feedback.data) throw new TesterFeedbackError("피드백을 찾지 못했습니다.", 404);
  const result = await admin.rpc("decide_hanmadi_tester_access_v1", {
    p_owner_user_id: feedback.data.owner_user_id,
    p_shop_id: feedback.data.shop_id,
    p_action: input.action,
    p_admin_email: input.adminEmail,
    p_request_id: input.requestId,
  });
  if (result.error) throw translateSubmitError(result.error);
  return result.data;
}

export async function getTesterFeedbackScreenshotPreview(feedbackId: string) {
  const admin = requireAdminClient();
  const feedback = await admin
    .from("tester_feedback_submissions")
    .select("shop_id,screenshot_media_asset_id,screenshot_deleted_at")
    .eq("id", feedbackId)
    .maybeSingle();
  if (feedback.error || !feedback.data?.screenshot_media_asset_id || feedback.data.screenshot_deleted_at) {
    throw new TesterFeedbackError("확인할 스크린샷이 없습니다.", 404);
  }
  const media = await admin
    .from("media_assets")
    .select("bucket,storage_path,content_type,byte_size")
    .eq("id", feedback.data.screenshot_media_asset_id)
    .eq("shop_id", feedback.data.shop_id)
    .eq("media_kind", "feedback_screenshot")
    .eq("visibility", "private")
    .eq("status", "ready")
    .maybeSingle();
  if (media.error || !media.data) throw new TesterFeedbackError("스크린샷을 안전하게 확인할 수 없습니다.", 404);
  return {
    signedUrl: await createMediaSignedReadUrl({ bucket: media.data.bucket, path: media.data.storage_path, expiresInSeconds: 60 }),
    contentType: media.data.content_type,
    byteSize: media.data.byte_size,
  };
}

export async function hardPurgeTesterFeedbackScreenshot(feedbackId: string) {
  const admin = requireAdminClient();
  const feedback = await admin
    .from("tester_feedback_submissions")
    .select("id,shop_id,screenshot_media_asset_id,screenshot_content_type,screenshot_deleted_at")
    .eq("id", feedbackId)
    .maybeSingle();
  if (feedback.error || !feedback.data) throw new TesterFeedbackError("피드백을 찾지 못했습니다.", 404);
  if (!feedback.data.screenshot_media_asset_id) {
    if (feedback.data.screenshot_content_type && !feedback.data.screenshot_deleted_at) {
      const markReceiptDeleted = await admin
        .from("tester_feedback_submissions")
        .update({ screenshot_deleted_at: new Date().toISOString() })
        .eq("id", feedbackId)
        .eq("shop_id", feedback.data.shop_id)
        .is("screenshot_media_asset_id", null);
      if (markReceiptDeleted.error) throw new TesterFeedbackError("스크린샷 정리 결과를 저장하지 못했습니다.", 503);
    }
    return { hardPurged: true, replayed: true };
  }

  const mediaAssetId = feedback.data.screenshot_media_asset_id;
  const [asset, variants] = await Promise.all([
    admin.from("media_assets").select("id,bucket,storage_path").eq("id", mediaAssetId).eq("shop_id", feedback.data.shop_id).eq("media_kind", "feedback_screenshot").maybeSingle(),
    admin.from("media_variants").select("bucket,storage_path").eq("media_asset_id", mediaAssetId),
  ]);
  if (asset.error || variants.error) throw new TesterFeedbackError("스크린샷 정리 상태를 확인하지 못했습니다.", 503);
  const objects = [
    ...(asset.data ? [{ bucket: asset.data.bucket, path: asset.data.storage_path }] : []),
    ...((variants.data ?? []).map((item) => ({ bucket: item.bucket, path: item.storage_path }))),
  ];
  for (const bucket of [...new Set(objects.map((item) => item.bucket))]) {
    const paths = objects.filter((item) => item.bucket === bucket).map((item) => item.path);
    await removeMediaStorageObjects({ bucket, paths });
    if (!(await verifyMediaStorageObjectsAbsent({ bucket, paths }))) {
      throw new TesterFeedbackError("스크린샷 원본 정리를 확인하지 못했습니다. 다시 시도해 주세요.", 503);
    }
  }
  const deleteVariants = await admin.from("media_variants").delete().eq("media_asset_id", mediaAssetId);
  if (deleteVariants.error) throw new TesterFeedbackError("스크린샷 메타데이터를 정리하지 못했습니다.", 503);
  const deleteAsset = await admin
    .from("media_assets")
    .delete()
    .eq("id", mediaAssetId)
    .eq("shop_id", feedback.data.shop_id)
    .eq("media_kind", "feedback_screenshot");
  if (deleteAsset.error) throw new TesterFeedbackError("스크린샷 메타데이터를 정리하지 못했습니다.", 503);
  const residue = await admin.from("media_assets").select("id").eq("id", mediaAssetId).maybeSingle();
  if (residue.error || residue.data) throw new TesterFeedbackError("스크린샷 메타데이터 정리를 확인하지 못했습니다.", 503);
  const markDeleted = await admin
    .from("tester_feedback_submissions")
    .update({ screenshot_deleted_at: new Date().toISOString() })
    .eq("id", feedbackId)
    .eq("shop_id", feedback.data.shop_id)
    .is("screenshot_media_asset_id", null);
  if (markDeleted.error) throw new TesterFeedbackError("스크린샷 정리 결과를 저장하지 못했습니다.", 503);
  return { hardPurged: true, replayed: Boolean(feedback.data.screenshot_deleted_at) };
}
