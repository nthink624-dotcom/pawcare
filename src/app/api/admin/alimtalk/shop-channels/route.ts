import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import type { AlimtalkShopChannelStatus, ShopNotificationSettings } from "@/types/domain";

type ShopChannelRow = {
  id: string;
  name: string;
  notification_settings: Partial<ShopNotificationSettings> | null;
};

const updateShopChannelSchema = z.object({
  shopId: z.string().min(1),
  status: z.enum(["not_requested", "requested", "reviewing", "active", "rejected"]),
  senderProfileKey: z.string().trim().max(120).optional().default(""),
  adminNote: z.string().trim().max(500).optional().default(""),
});

function serializeShopChannel(row: ShopChannelRow) {
  const settings = normalizeShopNotificationSettings(row.notification_settings);
  return {
    shopId: row.id,
    shopName: row.name,
    senderMode: settings.alimtalk_sender_mode,
    status: settings.alimtalk_shop_channel_status,
    channelName: settings.alimtalk_shop_channel_name ?? "",
    channelUrl: settings.alimtalk_shop_channel_url ?? "",
    senderProfileKey: settings.alimtalk_sender_profile_key ?? "",
    requestedAt: settings.alimtalk_channel_requested_at ?? null,
    adminNote: settings.alimtalk_channel_admin_note ?? "",
    templateRequestNote: settings.alimtalk_template_request_note ?? "",
    templateRequestUpdatedAt: settings.alimtalk_template_request_updated_at ?? null,
  };
}

async function getShopRows() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase 관리자 연결을 확인해 주세요.");
  }

  const result = await admin
    .from("shops")
    .select("id,name,notification_settings")
    .order("updated_at", { ascending: false });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as ShopChannelRow[];
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const rows = await getShopRows();
    const requests = rows
      .map(serializeShopChannel)
      .filter((item) => item.senderMode === "shop_channel" || item.status !== "not_requested");

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "매장 채널 신청 목록을 불러오지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession(request);
    const body = updateShopChannelSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error("Supabase 관리자 연결을 확인해 주세요.");
    }

    const current = await admin
      .from("shops")
      .select("id,name,notification_settings")
      .eq("id", body.shopId)
      .maybeSingle<ShopChannelRow>();

    if (current.error) {
      throw new Error(current.error.message);
    }
    if (!current.data) {
      return NextResponse.json({ ok: false, message: "매장을 찾을 수 없습니다." }, { status: 404 });
    }

    const previousSettings = normalizeShopNotificationSettings(current.data.notification_settings);
    const nextStatus = body.status as AlimtalkShopChannelStatus;
    const nextSettings: ShopNotificationSettings = {
      ...previousSettings,
      alimtalk_sender_mode: nextStatus === "not_requested" ? "petmanager" : "shop_channel",
      alimtalk_shop_channel_status: nextStatus,
      alimtalk_sender_profile_key: body.senderProfileKey || previousSettings.alimtalk_sender_profile_key || "",
      alimtalk_channel_admin_note: body.adminNote,
      alimtalk_channel_requested_at:
        previousSettings.alimtalk_channel_requested_at ?? (nextStatus === "not_requested" ? null : new Date().toISOString()),
    };

    const update = await admin
      .from("shops")
      .update({
        notification_settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.shopId)
      .select("id,name,notification_settings")
      .single<ShopChannelRow>();

    if (update.error) {
      throw new Error(update.error.message);
    }

    return NextResponse.json({
      ok: true,
      request: serializeShopChannel(update.data),
      adminLoginId: adminSession.loginId,
    });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "매장 채널 상태 저장에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
