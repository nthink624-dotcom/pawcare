import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { logOperationalEvent } from "@/lib/observability";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import {
  assertOwnerOrManager,
  assertServerManagedAccountActive,
  loadOwnerShopAccessForUser,
  OwnerApiError,
} from "@/server/owner-api-auth";
import { claimOwnerDataExportRateLimit } from "@/server/owner-data-export-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_SCHEMA_VERSION = 1;

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "shop";
}

async function readShopRows(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, table: string, columns: string, shopId: string) {
  const result = await admin.from(table).select(columns).eq("shop_id", shopId).order("created_at", { ascending: true });
  if (result.error) throw new Error(`export query failed: ${table}`);
  return result.data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      throw new OwnerApiError("데이터 내보내기는 운영 인증 환경에서만 사용할 수 있습니다.", 503);
    }

    const token = getBearerToken(request);
    if (!token) throw new OwnerApiError("로그인이 필요합니다.", 401);

    const authClient = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!authClient || !admin) throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);

    const userResult = await authClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) throw new OwnerApiError("로그인이 필요합니다.", 401);
    const user = userResult.data.user;
    assertServerManagedAccountActive(user);

    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() ?? "";
    if (!shopId || shopId.length > 160) throw new OwnerApiError("내보낼 매장을 선택해 주세요.", 400);

    const access = (await loadOwnerShopAccessForUser(user.id)).find((candidate) => candidate.shopId === shopId);
    if (access) assertOwnerOrManager(access);
    if (!access || access.role !== "owner") {
      throw new OwnerApiError("해당 매장의 데이터 내보내기 권한이 없습니다.", 403);
    }
    const rateLimit = claimOwnerDataExportRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "데이터 내보내기 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const shopResult = await admin
      .from("shops")
      .select("id,name,phone,address,description,business_hours,regular_closed_days,temporary_closed_dates,created_at,updated_at")
      .eq("id", shopId)
      .maybeSingle();
    if (shopResult.error || !shopResult.data) throw new Error("export query failed: shops");

    const [guardians, pets, services, appointments, groomingRecords, notifications] = await Promise.all([
      readShopRows(admin, "guardians", "id,name,phone,memo,created_at,updated_at", shopId),
      readShopRows(admin, "pets", "id,guardian_id,name,breed,weight,age,notes,grooming_cycle_weeks,created_at,updated_at", shopId),
      readShopRows(admin, "services", "id,name,price,duration_minutes,is_active,created_at,updated_at", shopId),
      readShopRows(
        admin,
        "appointments",
        "id,guardian_id,pet_id,service_id,appointment_date,appointment_time,status,memo,start_at,end_at,source,created_at,updated_at",
        shopId,
      ),
      readShopRows(
        admin,
        "grooming_records",
        "id,guardian_id,pet_id,service_id,appointment_id,style_notes,memo,price_paid,groomed_at,created_at,updated_at",
        shopId,
      ),
      readShopRows(admin, "notifications", "id,appointment_id,pet_id,guardian_id,type,channel,message,status,sent_at,created_at", shopId),
    ]);

    const payload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scope: { shopId },
      shop: shopResult.data,
      guardians,
      pets,
      services,
      appointments,
      groomingRecords,
      notifications,
      exclusions: [
        "Media binary objects are not included; use the media retention/deletion process for media requests.",
        "Authentication secrets, payment credentials, provider tokens, and internal audit rows are not included.",
      ],
    };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="petmanager-data-export-${safeFilenamePart(shopId)}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    logOperationalEvent("owner.data_export_failed", { route: "/api/owner/data-export", status: 500, operation: "export" });
    return NextResponse.json({ message: "데이터 내보내기를 완료하지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
