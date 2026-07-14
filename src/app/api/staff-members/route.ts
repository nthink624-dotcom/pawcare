import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { upsertStaffMemberProfile } from "@/server/owner-mutations";
import type { BootstrapStaffMember } from "@/types/domain";

const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const staffMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayName: z.string().trim().default(""),
  profileImageUrl: z.string().trim().default(""),
  profileImageUrls: z.array(z.string().trim()).max(3).default([]),
  profileImageAssetIds: z.array(z.string().trim()).max(3).default([]),
  profileMessage: z.string().trim().max(160).default(""),
  chipColorIndex: z.number().int().min(0).max(31).nullable().optional().default(null),
  phone: z.string().trim().default(""),
  role: z.string().trim().optional().transform((value) => value || "직원"),
  titlePrefix: z.string().trim().default(""),
  position: z.string().trim().optional().transform((value) => value || "직원"),
  defaultDays: z.array(weekdaySchema).default(["mon", "tue", "wed", "thu", "fri", "sat"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default("19:00"),
  regularOff: z.string().trim().default("일"),
  annualRemain: z.coerce.number().int().min(0).default(0),
  todayBookings: z.coerce.number().int().min(0).default(0),
  weekBookings: z.coerce.number().int().min(0).default(0),
});
const patchSchema = z.object({
  shopId: z.string().min(1),
  staffMembers: z.array(staffMemberSchema).min(1),
});
const deleteSchema = z.object({
  shopId: z.string().min(1),
  staffId: z.string().min(1),
});

function normalizeProfileImageUrls(value: unknown, fallback = "") {
  const urls = Array.isArray(value) ? value : [];
  const normalized = urls
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const fallbackUrl = fallback.trim();
  return normalized.length > 0 ? normalized : fallbackUrl ? [fallbackUrl] : [];
}

function normalizeProfileImageAssetIds(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function toBootstrapStaffMember(row: any): BootstrapStaffMember {
  const profileImageUrls = normalizeProfileImageUrls(row.profile_image_urls, row.profile_image_url ?? "");
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name?.trim() || row.name,
    profileImageUrl: profileImageUrls[0] ?? "",
    profileImageUrls,
    profileImageAssetIds: normalizeProfileImageAssetIds(row.profile_image_asset_ids),
    profileMessage: row.profile_message?.trim() || "",
    chipColorIndex: row.chip_color_index ?? null,
    phone: row.phone ?? "",
    role: row.role ?? "직원",
    titlePrefix: row.title_prefix?.trim() || "",
    position: row.position?.trim() || row.role || "직원",
    defaultDays: row.default_days?.length ? row.default_days : ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: String(row.start_time ?? "10:00").slice(0, 5),
    endTime: String(row.end_time ?? "19:00").slice(0, 5),
    regularOff: row.regular_off ?? "일",
    annualRemain: row.annual_remain ?? 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

async function loadStaffMembers(shopId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
  const result = await supabase
    .from("staff_members")
    .select("id,name,display_name,profile_image_url,profile_image_urls,profile_image_asset_ids,profile_message,chip_color_index,phone,role,title_prefix,position,default_days,start_time,end_time,regular_off,annual_remain")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (result.error) throw new OwnerApiError(result.error.message, 500);
  return (result.data ?? []).map(toBootstrapStaffMember);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    const result = await upsertStaffMemberProfile(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = patchSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);

    const now = nowIso();
    const rows = body.staffMembers.map((staffMember, index) => {
      const profileImageUrls = normalizeProfileImageUrls(staffMember.profileImageUrls, staffMember.profileImageUrl);
      return {
        id: staffMember.id,
        shop_id: owner.shopId,
        name: staffMember.name,
        display_name: staffMember.displayName,
        profile_image_url: profileImageUrls[0] ?? "",
        profile_image_urls: profileImageUrls,
        profile_image_asset_ids: normalizeProfileImageAssetIds(staffMember.profileImageAssetIds),
        profile_message: staffMember.profileMessage,
        chip_color_index: staffMember.chipColorIndex ?? null,
        phone: staffMember.phone,
        role: staffMember.role,
        title_prefix: staffMember.titlePrefix,
        position: staffMember.position,
        default_days: staffMember.defaultDays,
        start_time: staffMember.startTime,
        end_time: staffMember.endTime,
        regular_off: staffMember.regularOff,
        annual_remain: staffMember.annualRemain,
        is_active: true,
        sort_order: index + 1,
        updated_at: now,
      };
    });

    const result = await supabase.from("staff_members").upsert(rows, { onConflict: "id" });
    if (result.error) throw new OwnerApiError(result.error.message, 500);
    return NextResponse.json({ staffMembers: await loadStaffMembers(owner.shopId) });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "직원 정보를 다시 확인해 주세요." }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = deleteSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);

    const activeStaff = await supabase.from("staff_members").select("id").eq("shop_id", owner.shopId).eq("is_active", true);
    if (activeStaff.error) throw new OwnerApiError(activeStaff.error.message, 500);
    if ((activeStaff.data ?? []).length <= 1) {
      throw new OwnerApiError("최소 1명의 활성 직원은 남아 있어야 합니다.", 400);
    }

    const activeAppointments = await supabase
      .from("appointments")
      .select("id")
      .eq("shop_id", owner.shopId)
      .eq("staff_id", body.staffId)
      .in("status", ["confirmed", "in_progress", "almost_done"])
      .limit(1);
    if (activeAppointments.error) throw new OwnerApiError(activeAppointments.error.message, 500);
    if ((activeAppointments.data ?? []).length > 0) {
      throw new OwnerApiError("예정된 활성 예약이 있는 직원은 비활성화할 수 없습니다.", 409);
    }

    const result = await supabase
      .from("staff_members")
      .update({ is_active: false, updated_at: nowIso() })
      .eq("shop_id", owner.shopId)
      .eq("id", body.staffId);
    if (result.error) throw new OwnerApiError(result.error.message, 500);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "직원 삭제 요청을 다시 확인해 주세요." }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "직원을 삭제하지 못했습니다." }, { status: 500 });
  }
}
