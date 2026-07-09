import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { notifyAdminOwnerSupportRequest } from "@/server/admin-support-email";
import { createMediaSignedReadUrl } from "@/server/media-storage";
import type { MediaAsset } from "@/types/domain";

export type OwnerSupportCategory =
  | "how_to_use"
  | "bug"
  | "payment"
  | "feature_request"
  | "account"
  | "notification"
  | "other";
export type OwnerSupportRequestType = OwnerSupportCategory | "improvement" | "question";
export type OwnerSupportRequestStatus = "open" | "reviewing" | "answered" | "resolved" | "closed";
export type OwnerSupportPriority = "low" | "normal" | "urgent";
export type OwnerSupportSenderType = "owner" | "admin" | "system";

export type OwnerSupportMessageItem = {
  id: string;
  requestId: string;
  senderType: OwnerSupportSenderType;
  senderId: string | null;
  senderName: string | null;
  message: string;
  isAnswer: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OwnerSupportAttachmentItem = {
  id: string;
  requestId: string;
  messageId: string | null;
  mediaAssetId: string | null;
  fileUrl: string;
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  uploadedByType: "owner" | "admin";
  uploadedById: string | null;
  createdAt: string;
};

export type OwnerSupportRequestItem = {
  id: string;
  shopId: string;
  shopName: string | null;
  ownerUserId: string | null;
  requestType: OwnerSupportRequestType;
  category: OwnerSupportCategory;
  status: OwnerSupportRequestStatus;
  priority: OwnerSupportPriority;
  title: string;
  contact: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  message: string;
  context: Record<string, unknown>;
  adminNote: string;
  source: string;
  answeredAt: string | null;
  closedAt: string | null;
  ownerLastReadAt: string | null;
  adminLastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: OwnerSupportMessageItem[];
  attachments: OwnerSupportAttachmentItem[];
};

type SupportRequestRow = {
  id: string;
  shop_id: string;
  owner_user_id: string | null;
  request_type: OwnerSupportRequestType;
  category?: OwnerSupportCategory | null;
  status: OwnerSupportRequestStatus;
  priority?: OwnerSupportPriority | null;
  title?: string | null;
  contact: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  message: string;
  context: Record<string, unknown> | null;
  admin_note: string | null;
  source?: string | null;
  answered_at?: string | null;
  closed_at?: string | null;
  owner_last_read_at?: string | null;
  admin_last_read_at?: string | null;
  created_at: string;
  updated_at: string;
  shops?: { name: string | null } | null;
};

type SupportMessageRow = {
  id: string;
  request_id: string;
  sender_type: OwnerSupportSenderType;
  sender_id: string | null;
  sender_name: string | null;
  message: string;
  is_answer: boolean | null;
  created_at: string;
  updated_at: string;
};

type SupportAttachmentRow = {
  id: string;
  request_id: string;
  message_id: string | null;
  media_asset_id: string | null;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by_type: "owner" | "admin";
  uploaded_by_id: string | null;
  created_at: string;
};

const SUPPORT_REQUEST_SELECT = [
  "id",
  "shop_id",
  "owner_user_id",
  "request_type",
  "category",
  "status",
  "priority",
  "title",
  "contact",
  "owner_name",
  "owner_phone",
  "owner_email",
  "message",
  "context",
  "admin_note",
  "source",
  "answered_at",
  "closed_at",
  "owner_last_read_at",
  "admin_last_read_at",
  "created_at",
  "updated_at",
  "shops(name)",
].join(", ");

const SUPPORT_REQUEST_LEGACY_SELECT = [
  "id",
  "shop_id",
  "owner_user_id",
  "request_type",
  "status",
  "contact",
  "message",
  "context",
  "admin_note",
  "created_at",
  "updated_at",
  "shops(name)",
].join(", ");

const SUPPORT_MESSAGE_SELECT = [
  "id",
  "request_id",
  "sender_type",
  "sender_id",
  "sender_name",
  "message",
  "is_answer",
  "created_at",
  "updated_at",
].join(", ");

const SUPPORT_ATTACHMENT_SELECT = [
  "id",
  "request_id",
  "message_id",
  "media_asset_id",
  "file_url",
  "file_name",
  "file_type",
  "file_size",
  "uploaded_by_type",
  "uploaded_by_id",
  "created_at",
].join(", ");

export class OwnerSupportRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function normalizeCategory(value: OwnerSupportRequestType | OwnerSupportCategory): OwnerSupportCategory {
  if (value === "question") return "how_to_use";
  if (value === "improvement") return "feature_request";
  if (
    value === "how_to_use" ||
    value === "bug" ||
    value === "payment" ||
    value === "feature_request" ||
    value === "account" ||
    value === "notification"
  ) {
    return value;
  }
  return "other";
}

function toLegacyRequestType(category: OwnerSupportCategory): "bug" | "improvement" | "question" {
  if (category === "bug") return "bug";
  if (category === "feature_request") return "improvement";
  return "question";
}

function buildDefaultTitle(category: OwnerSupportCategory, context: Record<string, unknown>) {
  const route = typeof context.currentPath === "string" && context.currentPath.trim() ? context.currentPath.trim() : null;
  const label: Record<OwnerSupportCategory, string> = {
    how_to_use: "사용법 문의",
    bug: "오류 제보",
    payment: "결제 문의",
    feature_request: "기능 요청",
    account: "계정/매장 문의",
    notification: "알림 문의",
    other: "기타 문의",
  };

  return route ? `[${label[category]}] ${route}` : label[category];
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasMissingSupportTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    (message.includes("owner_support_requests") && message.includes("schema cache")) ||
    (message.includes("owner_support_messages") && message.includes("schema cache"))
  );
}

function hasMissingSupportColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    message.includes("column owner_support_requests.") ||
    message.includes("could not find the") ||
    message.includes("schema cache")
  );
}

function requireAdminClient() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerSupportRequestError("Supabase 관리자 연결을 확인해 주세요.", 503);
  }
  return admin;
}

function mapSupportMessage(row: SupportMessageRow): OwnerSupportMessageItem {
  return {
    id: row.id,
    requestId: row.request_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    isAnswer: row.is_answer ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSupportAttachment(row: SupportAttachmentRow, signedUrlByMediaAssetId: Map<string, string>): OwnerSupportAttachmentItem {
  return {
    id: row.id,
    requestId: row.request_id,
    messageId: row.message_id,
    mediaAssetId: row.media_asset_id,
    fileUrl: row.file_url,
    signedUrl: row.media_asset_id ? (signedUrlByMediaAssetId.get(row.media_asset_id) ?? "") : row.file_url,
    fileName: row.file_name ?? "첨부 이미지",
    fileType: row.file_type ?? "",
    fileSize: row.file_size,
    uploadedByType: row.uploaded_by_type,
    uploadedById: row.uploaded_by_id,
    createdAt: row.created_at,
  };
}

function mapSupportRequest(
  row: SupportRequestRow,
  messages: OwnerSupportMessageItem[] = [],
  attachments: OwnerSupportAttachmentItem[] = [],
): OwnerSupportRequestItem {
  const category = row.category ?? normalizeCategory(row.request_type);
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: row.shops?.name ?? null,
    ownerUserId: row.owner_user_id,
    requestType: row.request_type,
    category,
    status: row.status,
    priority: row.priority ?? "normal",
    title: row.title?.trim() || buildDefaultTitle(category, row.context ?? {}),
    contact: row.contact ?? "",
    ownerName: row.owner_name ?? "",
    ownerPhone: row.owner_phone ?? "",
    ownerEmail: row.owner_email ?? "",
    message: row.message,
    context: row.context ?? {},
    adminNote: row.admin_note ?? "",
    source: row.source ?? "owner_web",
    answeredAt: row.answered_at ?? null,
    closedAt: row.closed_at ?? null,
    ownerLastReadAt: row.owner_last_read_at ?? null,
    adminLastReadAt: row.admin_last_read_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
    attachments,
  };
}

async function fetchMessagesByRequestIds(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, OwnerSupportMessageItem[]>();

  const admin = requireAdminClient();
  const result = await admin
    .from("owner_support_messages")
    .select(SUPPORT_MESSAGE_SELECT)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true })
    .returns<SupportMessageRow[]>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      return new Map<string, OwnerSupportMessageItem[]>();
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  const grouped = new Map<string, OwnerSupportMessageItem[]>();
  for (const row of result.data ?? []) {
    const message = mapSupportMessage(row);
    grouped.set(message.requestId, [...(grouped.get(message.requestId) ?? []), message]);
  }

  return grouped;
}

async function fetchAttachmentsByRequestIds(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, OwnerSupportAttachmentItem[]>();

  const admin = requireAdminClient();
  const result = await admin
    .from("owner_support_attachments")
    .select(SUPPORT_ATTACHMENT_SELECT)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true })
    .returns<SupportAttachmentRow[]>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      return new Map<string, OwnerSupportAttachmentItem[]>();
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  const rows = result.data ?? [];
  const mediaAssetIds = Array.from(new Set(rows.map((row) => row.media_asset_id).filter((id): id is string => Boolean(id))));
  const signedUrlByMediaAssetId = new Map<string, string>();

  if (mediaAssetIds.length > 0) {
    const assetsResult = await admin.from("media_assets").select("*").in("id", mediaAssetIds).returns<MediaAsset[]>();
    if (!assetsResult.error) {
      await Promise.all(
        (assetsResult.data ?? []).map(async (asset) => {
          const signedUrl = await createMediaSignedReadUrl({
            bucket: asset.bucket,
            path: asset.storage_path,
            expiresInSeconds: 60 * 30,
          });
          signedUrlByMediaAssetId.set(asset.id, signedUrl);
        }),
      );
    }
  }

  const grouped = new Map<string, OwnerSupportAttachmentItem[]>();
  for (const row of rows) {
    const attachment = mapSupportAttachment(row, signedUrlByMediaAssetId);
    grouped.set(attachment.requestId, [...(grouped.get(attachment.requestId) ?? []), attachment]);
  }

  return grouped;
}

export async function createOwnerSupportRequest(input: {
  shopId: string;
  ownerUserId: string | null;
  requestType?: OwnerSupportRequestType;
  category?: OwnerSupportCategory;
  title?: string;
  contact: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  message: string;
  context: Record<string, unknown>;
  source?: "owner_web" | "owner_app";
  attachments?: Array<{
    mediaAssetId: string;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
  }>;
}) {
  const admin = requireAdminClient();
  const now = nowIso();
  const category = input.category ?? normalizeCategory(input.requestType ?? "other");
  const title = input.title?.trim() || buildDefaultTitle(category, input.context);
  const requestType = input.requestType ?? category;
  const contact = input.contact.trim();

  const result = await admin
    .from("owner_support_requests")
    .insert({
      shop_id: input.shopId,
      owner_user_id: input.ownerUserId,
      request_type: requestType,
      category,
      title,
      contact,
      owner_name: input.ownerName?.trim() || null,
      owner_phone: input.ownerPhone?.trim() || contact || null,
      owner_email: input.ownerEmail?.trim() || null,
      message: input.message.trim(),
      context: input.context,
      source: input.source ?? "owner_web",
      status: "open",
      owner_last_read_at: now,
      created_at: now,
      updated_at: now,
    })
    .select(SUPPORT_REQUEST_SELECT)
    .single<SupportRequestRow>();

  if (result.error) {
    if (hasMissingSupportColumn(result.error)) {
      const legacyResult = await admin
        .from("owner_support_requests")
        .insert({
          shop_id: input.shopId,
          owner_user_id: input.ownerUserId,
          request_type: toLegacyRequestType(category),
          contact,
          message: input.message.trim(),
          context: input.context,
          status: "open",
          created_at: now,
          updated_at: now,
        })
        .select(SUPPORT_REQUEST_LEGACY_SELECT)
        .single<SupportRequestRow>();

      if (legacyResult.error) {
        throw new OwnerSupportRequestError(legacyResult.error.message, 500);
      }

      const supportRequest = mapSupportRequest(legacyResult.data);
      void notifyAdminOwnerSupportRequest(supportRequest).catch((error) => {
        console.error("[owner-support] admin email notification failed", error);
      });

      return supportRequest;
    }
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  const messageResult = await admin
    .from("owner_support_messages")
    .insert({
      request_id: result.data.id,
      sender_type: "owner",
      sender_id: input.ownerUserId,
      message: input.message.trim(),
      is_answer: false,
      created_at: now,
      updated_at: now,
    })
    .select(SUPPORT_MESSAGE_SELECT)
    .single<SupportMessageRow>();

  const messages = messageResult.error ? [] : [mapSupportMessage(messageResult.data)];
  const attachmentRows = (input.attachments ?? [])
    .slice(0, 3)
    .filter((attachment) => isUuid(attachment.mediaAssetId))
    .map((attachment) => ({
      request_id: result.data.id,
      message_id: messageResult.error ? null : messageResult.data.id,
      media_asset_id: attachment.mediaAssetId,
      file_url: `media_asset:${attachment.mediaAssetId}`,
      file_name: attachment.fileName?.trim() || null,
      file_type: attachment.fileType?.trim() || null,
      file_size: typeof attachment.fileSize === "number" ? attachment.fileSize : null,
      uploaded_by_type: "owner",
      uploaded_by_id: input.ownerUserId,
    }));

  if (attachmentRows.length > 0) {
    await admin.from("owner_support_attachments").insert(attachmentRows);
  }

  const attachments = await fetchAttachmentsByRequestIds([result.data.id]);
  const supportRequest = mapSupportRequest(result.data, messages, attachments.get(result.data.id) ?? []);
  void notifyAdminOwnerSupportRequest(supportRequest).catch((error) => {
    console.error("[owner-support] admin email notification failed", error);
  });

  return supportRequest;
}

export async function listOwnerSupportRequests(limit = 30) {
  const admin = requireAdminClient();
  let result = await admin
    .from("owner_support_requests")
    .select(SUPPORT_REQUEST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SupportRequestRow[]>();

  if (result.error) {
    if (hasMissingSupportColumn(result.error)) {
      result = await admin
        .from("owner_support_requests")
        .select(SUPPORT_REQUEST_LEGACY_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<SupportRequestRow[]>();
    }
  }

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  const rows = result.data ?? [];
  const messages = await fetchMessagesByRequestIds(rows.map((row) => row.id));
  const attachments = await fetchAttachmentsByRequestIds(rows.map((row) => row.id));
  return rows.map((row) => mapSupportRequest(row, messages.get(row.id) ?? [], attachments.get(row.id) ?? []));
}

export async function listOwnerSupportRequestsForOwner(input: {
  shopId: string;
  ownerUserId: string | null;
  limit?: number;
}) {
  const admin = requireAdminClient();
  const buildQuery = (select: string) => {
    let query = admin
      .from("owner_support_requests")
      .select(select)
      .eq("shop_id", input.shopId)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 30);

    if (input.ownerUserId) {
      query = query.eq("owner_user_id", input.ownerUserId);
    }

    return query;
  };

  let result = await buildQuery(SUPPORT_REQUEST_SELECT).returns<SupportRequestRow[]>();

  if (result.error && hasMissingSupportColumn(result.error)) {
    result = await buildQuery(SUPPORT_REQUEST_LEGACY_SELECT).returns<SupportRequestRow[]>();
  }

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  const rows = result.data ?? [];
  const messages = await fetchMessagesByRequestIds(rows.map((row) => row.id));
  const attachments = await fetchAttachmentsByRequestIds(rows.map((row) => row.id));
  return rows.map((row) => mapSupportRequest(row, messages.get(row.id) ?? [], attachments.get(row.id) ?? []));
}

export async function markOwnerSupportRequestRead(input: {
  id: string;
  shopId: string;
  ownerUserId: string | null;
}) {
  const admin = requireAdminClient();
  let query = admin.from("owner_support_requests").update({ owner_last_read_at: nowIso() }).eq("id", input.id).eq("shop_id", input.shopId);

  if (input.ownerUserId) {
    query = query.eq("owner_user_id", input.ownerUserId);
  }

  const result = await query;
  if (result.error && hasMissingSupportColumn(result.error)) {
    return;
  }
  if (result.error) {
    throw new OwnerSupportRequestError(result.error.message, 500);
  }
}

export async function updateOwnerSupportRequest(input: {
  id: string;
  status: OwnerSupportRequestStatus;
  adminNote?: string;
  answerMessage?: string;
  adminId?: string | null;
  adminName?: string | null;
}) {
  const admin = requireAdminClient();
  const now = nowIso();
  const answer = input.answerMessage?.trim() ?? "";
  const nextStatus = answer ? "answered" : input.status;
  const updates: Record<string, unknown> = {
    status: nextStatus,
    admin_note: input.adminNote?.trim() ?? "",
    admin_last_read_at: now,
    updated_at: now,
  };

  if (nextStatus === "answered") updates.answered_at = now;
  if (nextStatus === "closed") updates.closed_at = now;

  const result = await admin
    .from("owner_support_requests")
    .update(updates)
    .eq("id", input.id)
    .select(SUPPORT_REQUEST_SELECT)
    .single<SupportRequestRow>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  if (answer) {
    await admin.from("owner_support_messages").insert({
      request_id: input.id,
      sender_type: "admin",
      sender_id: input.adminId ?? null,
      sender_name: input.adminName?.trim() || "운영팀",
      message: answer,
      is_answer: true,
      created_at: now,
      updated_at: now,
    });

    await admin.from("owner_support_notifications").insert({
      request_id: input.id,
      owner_user_id: result.data.owner_user_id,
      shop_id: result.data.shop_id,
      channel: "in_app",
      status: "sent",
      title: "문의 답변이 도착했습니다.",
      body: "넘친데이 운영팀에서 문의에 답변을 남겼어요.",
      sent_at: now,
      created_at: now,
    });
  }

  const messages = await fetchMessagesByRequestIds([input.id]);
  const attachments = await fetchAttachmentsByRequestIds([input.id]);
  return mapSupportRequest(result.data, messages.get(input.id) ?? [], attachments.get(input.id) ?? []);
}
