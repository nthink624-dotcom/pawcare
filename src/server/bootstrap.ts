import { normalizeShopBookingSettings } from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { buildDemoBootstrap } from "@/lib/mock-data";
import {
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatClockTime } from "@/lib/utils";
import type {
  AlimtalkCreditSummary,
  Appointment,
  AppointmentChangeEvent,
  BootstrapPayload,
  BootstrapStaffMember,
  GroomingRecord,
  Guardian,
  LandingFeedback,
  LandingInterest,
  OwnerProfile,
  Pet,
  PetStaffNote,
  Service,
  Shop,
  StaffScheduleOverride,
} from "@/types/domain";

type StaffMemberRow = {
  id: string;
  name: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  profile_image_urls?: unknown;
  profile_image_asset_ids?: unknown;
  profile_message?: string | null;
  chip_color_index?: number | null;
  phone: string | null;
  role: string | null;
  title_prefix?: string | null;
  position?: string | null;
  default_days: BootstrapStaffMember["defaultDays"] | null;
  start_time: string | null;
  end_time: string | null;
  regular_off: string | null;
  annual_remain: number | null;
};

function normalizeTime(value: string | null | undefined, fallback: string) {
  return (value ?? "").slice(0, 5) || fallback;
}

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

function normalizeStaffMember(row: StaffMemberRow): BootstrapStaffMember {
  const profileImageUrls = normalizeProfileImageUrls(row.profile_image_urls, row.profile_image_url ?? "");
  const role = row.role?.trim() || "직원";
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
    role,
    titlePrefix: row.title_prefix?.trim() || "",
    position: row.position?.trim() || role,
    defaultDays: row.default_days?.length ? row.default_days : ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: normalizeTime(row.start_time, "10:00"),
    endTime: normalizeTime(row.end_time, "19:00"),
    regularOff: row.regular_off ?? "일",
    annualRemain: row.annual_remain ?? 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

function buildFallbackStaffMember(shop: Shop): BootstrapStaffMember {
  return {
    id: `${shop.id}-staff-owner`,
    name: "원장",
    displayName: "원장",
    profileImageUrl: "",
    profileImageUrls: [],
    profileImageAssetIds: [],
    profileMessage: "아이 성향에 맞춰 차분하게 미용해드려요.",
    chipColorIndex: 0,
    phone: shop.phone ?? "",
    role: "원장 / 전체 미용",
    titlePrefix: "",
    position: "원장",
    defaultDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

function normalizeAppointmentForBootstrap(appointment: Appointment): Appointment {
  return {
    ...appointment,
    appointment_time: formatClockTime(appointment.appointment_time),
    visit_reminder_offset_minutes: appointment.visit_reminder_offset_minutes ?? 10,
    pickup_ready_eta_minutes: appointment.pickup_ready_eta_minutes ?? 5,
  };
}

function buildMockBootstrap(shopId?: string): BootstrapPayload {
  const store = normalizeBootstrapNotifications(buildDemoBootstrap());
  store.shop = {
    ...normalizeShopBookingSettings(store.shop),
    id: shopId || store.shop.id,
    notification_settings: normalizeShopNotificationSettings(store.shop.notification_settings),
    customer_page_settings: normalizeCustomerPageSettings(
      store.shop.customer_page_settings,
      store.shop.name,
      store.shop.description,
    ),
  };
  store.appointments = store.appointments.map(normalizeAppointmentForBootstrap);
  store.staffMembers = store.staffMembers.length > 0 ? store.staffMembers : [buildFallbackStaffMember(store.shop)];
  store.staffScheduleOverrides = store.staffScheduleOverrides ?? [];
  store.appointmentChangeEvents = store.appointmentChangeEvents ?? [];
  store.petStaffNotes = store.petStaffNotes ?? [];
  store.alimtalkCreditSummary = store.alimtalkCreditSummary ?? null;
  return store;
}

function normalizeGuardianForBootstrap(guardian: Guardian): Guardian {
  return {
    ...guardian,
    notification_settings: normalizeGuardianNotificationSettings(guardian.notification_settings),
  };
}

function splitActiveGuardians(guardians: Guardian[]) {
  const activeGuardians = guardians.filter((guardian) => !guardian.deleted_at);
  const now = Date.now();
  const deletedGuardians = guardians.filter(
    (guardian) =>
      guardian.deleted_at &&
      guardian.deleted_restore_until &&
      new Date(guardian.deleted_restore_until).getTime() >= now,
  );
  const activeGuardianIds = new Set(activeGuardians.map((guardian) => guardian.id));
  return { activeGuardians, deletedGuardians, activeGuardianIds };
}

async function safeQuery<T>(promise: PromiseLike<{ data: T | null; error: any }>, fallback: T) {
  const result = await promise;
  if (result.error) return fallback;
  return result.data ?? fallback;
}

export async function getBootstrap(shopId = "demo-shop"): Promise<BootstrapPayload> {
  if (!hasSupabaseServerEnv()) {
    return buildMockBootstrap(shopId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return buildMockBootstrap(shopId);
  }

  const [
    shopRes,
    guardiansRes,
    petsRes,
    servicesRes,
    staffMembersRes,
    staffScheduleOverrides,
    appointmentsRes,
    appointmentChangeEvents,
    recordsRes,
    petStaffNotes,
    notificationsRes,
    alimtalkCreditSummary,
    ownerProfile,
    interestsRes,
    feedbackRes,
  ] = await Promise.all([
    supabase.from("shops").select("*").eq("id", shopId).single(),
    supabase.from("guardians").select("*").eq("shop_id", shopId).order("created_at"),
    supabase.from("pets").select("*").eq("shop_id", shopId).order("created_at"),
    supabase.from("services").select("*").eq("shop_id", shopId).order("created_at"),
    supabase
      .from("staff_members")
      .select("id,name,display_name,profile_image_url,profile_image_urls,profile_image_asset_ids,profile_message,chip_color_index,phone,role,title_prefix,position,default_days,start_time,end_time,regular_off,annual_remain")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    safeQuery(
      supabase
        .from("staff_schedule_overrides")
        .select("*")
        .eq("shop_id", shopId)
        .order("work_date"),
      [] as StaffScheduleOverride[],
    ),
    supabase.from("appointments").select("*").eq("shop_id", shopId).order("appointment_date").order("appointment_time"),
    safeQuery(
      supabase
        .from("appointment_change_events")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false }),
      [] as AppointmentChangeEvent[],
    ),
    supabase.from("grooming_records").select("*").eq("shop_id", shopId).order("groomed_at", { ascending: false }),
    safeQuery(
      supabase
        .from("pet_staff_notes")
        .select("*")
        .eq("shop_id", shopId)
        .order("updated_at", { ascending: false }),
      [] as PetStaffNote[],
    ),
    supabase.from("notifications").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
    safeQuery(
      supabase
        .from("shop_alimtalk_credit_summaries")
        .select("*")
        .eq("shop_id", shopId)
        .maybeSingle(),
      null as AlimtalkCreditSummary | null,
    ),
    safeQuery(
      supabase
        .from("owner_profiles")
        .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
        .eq("shop_id", shopId)
        .maybeSingle(),
      null as OwnerProfile | null,
    ),
    supabase.from("landing_interests").select("*").order("created_at", { ascending: false }),
    supabase.from("landing_feedback").select("*").order("created_at", { ascending: false }),
  ]);

  if (shopRes.error || !shopRes.data) {
    if (shopId !== "demo-shop") throw new Error("매장 정보를 찾을 수 없습니다.");
    return buildMockBootstrap(shopId);
  }

  const rawShop = shopRes.data as Shop;
  const normalizedShop = {
    ...normalizeShopBookingSettings(rawShop),
    notification_settings: normalizeShopNotificationSettings(rawShop.notification_settings),
    customer_page_settings: normalizeCustomerPageSettings(rawShop.customer_page_settings, rawShop.name, rawShop.description),
  };
  const normalizedGuardians = ((guardiansRes.data ?? []) as Guardian[]).map(normalizeGuardianForBootstrap);
  const { activeGuardians, deletedGuardians, activeGuardianIds } = splitActiveGuardians(normalizedGuardians);
  const activePetIds = new Set(
    ((petsRes.data ?? []) as Pet[])
      .filter((pet) => activeGuardianIds.has(pet.guardian_id))
      .map((pet) => pet.id),
  );
  const staffMembers =
    staffMembersRes.error || !Array.isArray(staffMembersRes.data)
      ? []
      : ((staffMembersRes.data ?? []) as StaffMemberRow[]).map(normalizeStaffMember);

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: normalizedShop,
    ownerProfile,
    guardians: activeGuardians,
    deletedGuardians,
    pets: ((petsRes.data ?? []) as Pet[]).filter((pet) => activeGuardianIds.has(pet.guardian_id)),
    services: (servicesRes.data ?? []) as Service[],
    staffMembers: staffMembers.length > 0 ? staffMembers : [buildFallbackStaffMember(normalizedShop)],
    staffScheduleOverrides,
    appointments: ((appointmentsRes.data ?? []) as Appointment[])
      .filter((appointment) => activeGuardianIds.has(appointment.guardian_id) && activePetIds.has(appointment.pet_id))
      .map(normalizeAppointmentForBootstrap),
    appointmentChangeEvents,
    groomingRecords: ((recordsRes.data ?? []) as GroomingRecord[]).filter((record) =>
      activeGuardianIds.has(record.guardian_id) && activePetIds.has(record.pet_id),
    ),
    petStaffNotes: petStaffNotes.filter((note) => activeGuardianIds.has(note.guardian_id) && (!note.pet_id || activePetIds.has(note.pet_id))),
    notifications: ((notificationsRes.data ?? []) as BootstrapPayload["notifications"]).filter((notification) =>
      !notification.guardian_id || activeGuardianIds.has(notification.guardian_id),
    ),
    alimtalkCreditSummary,
    landingInterests: (interestsRes.data ?? []) as LandingInterest[],
    landingFeedback: (feedbackRes.data ?? []) as LandingFeedback[],
  });
}
