import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";

export type OwnerSupportRequestType = "bug" | "improvement" | "question";
export type OwnerSupportRequestStatus = "open" | "reviewing" | "resolved" | "closed";

export type OwnerSupportRequestItem = {
  id: string;
  shopId: string;
  shopName: string | null;
  ownerUserId: string | null;
  requestType: OwnerSupportRequestType;
  status: OwnerSupportRequestStatus;
  contact: string;
  message: string;
  context: Record<string, unknown>;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

type SupportRequestRow = {
  id: string;
  shop_id: string;
  owner_user_id: string | null;
  request_type: OwnerSupportRequestType;
  status: OwnerSupportRequestStatus;
  contact: string | null;
  message: string;
  context: Record<string, unknown> | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  shops?: { name: string | null } | null;
};

export class OwnerSupportRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function mapSupportRequest(row: SupportRequestRow): OwnerSupportRequestItem {
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: row.shops?.name ?? null,
    ownerUserId: row.owner_user_id,
    requestType: row.request_type,
    status: row.status,
    contact: row.contact ?? "",
    message: row.message,
    context: row.context ?? {},
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasMissingSupportTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42P01" || (message.includes("owner_support_requests") && message.includes("schema cache"));
}

function requireAdminClient() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerSupportRequestError("Supabase 관리자 연결을 확인해 주세요.", 503);
  }
  return admin;
}

export async function createOwnerSupportRequest(input: {
  shopId: string;
  ownerUserId: string | null;
  requestType: OwnerSupportRequestType;
  contact: string;
  message: string;
  context: Record<string, unknown>;
}) {
  const admin = requireAdminClient();
  const now = nowIso();
  const result = await admin
    .from("owner_support_requests")
    .insert({
      shop_id: input.shopId,
      owner_user_id: input.ownerUserId,
      request_type: input.requestType,
      contact: input.contact.trim(),
      message: input.message.trim(),
      context: input.context,
      status: "open",
      created_at: now,
      updated_at: now,
    })
    .select("id, shop_id, owner_user_id, request_type, status, contact, message, context, admin_note, created_at, updated_at, shops(name)")
    .single<SupportRequestRow>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  return mapSupportRequest(result.data);
}

export async function listOwnerSupportRequests(limit = 30) {
  const admin = requireAdminClient();
  const result = await admin
    .from("owner_support_requests")
    .select("id, shop_id, owner_user_id, request_type, status, contact, message, context, admin_note, created_at, updated_at, shops(name)")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SupportRequestRow[]>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  return (result.data ?? []).map(mapSupportRequest);
}

export async function updateOwnerSupportRequest(input: {
  id: string;
  status: OwnerSupportRequestStatus;
  adminNote: string;
}) {
  const admin = requireAdminClient();
  const result = await admin
    .from("owner_support_requests")
    .update({
      status: input.status,
      admin_note: input.adminNote.trim(),
      updated_at: nowIso(),
    })
    .eq("id", input.id)
    .select("id, shop_id, owner_user_id, request_type, status, contact, message, context, admin_note, created_at, updated_at, shops(name)")
    .single<SupportRequestRow>();

  if (result.error) {
    if (hasMissingSupportTable(result.error)) {
      throw new OwnerSupportRequestError("문의 접수 테이블이 아직 만들어지지 않았습니다. 최신 Supabase 마이그레이션을 적용해 주세요.", 503);
    }
    throw new OwnerSupportRequestError(result.error.message, 500);
  }

  return mapSupportRequest(result.data);
}
