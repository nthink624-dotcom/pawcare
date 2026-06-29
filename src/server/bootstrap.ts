import { normalizeShopBookingSettings } from "@/lib/booking-slot-settings";
import { normalizeBusinessHours } from "@/lib/business-hours";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { defaultOwnerStaffDays } from "@/lib/owner-default-setup";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";
import {
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentDateInTimeZone, currentMinutesInTimeZone, formatClockTime, minutesFromTime } from "@/lib/utils";
import { createMediaSignedReadUrl } from "@/server/media-storage";
import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  LandingFeedback,
  LandingInterest,
  Pet,
  PetStaffNote,
  OwnerProfile,
  Service,
  Shop,
  AlimtalkCreditSummary,
  AppointmentChangeEvent,
  BootstrapStaffMember,
  StaffScheduleOverride,
} from "@/types/domain";

type BootstrapOptions = {
  allowMock?: boolean;
  includeLanding?: boolean;
  includeNotifications?: boolean;
  includeGroomingRecords?: boolean;
  appointmentsFrom?: string;
  appointmentsTo?: string;
  groomingRecordsFrom?: string;
  groomingRecordsTo?: string;
  groomingRecordLimit?: number;
  notificationLimit?: number;
};

function buildMockBootstrap(shopId?: string): BootstrapPayload {
  if (shopId === "owner-demo") {
    const store = buildOwnerDemoBootstrap();
    store.appointments = store.appointments.map(normalizeAppointmentForBootstrap);
    return store;
  }

  const store = normalizeBootstrapNotifications(buildDemoBootstrap());
  store.shop = {
    ...normalizeShopBookingSettings(store.shop),
    id: shopId || store.shop.id,
    business_hours: normalizeBusinessHours(store.shop.business_hours),
    reservation_policy_settings: normalizeReservationPolicySettings(store.shop.reservation_policy_settings),
    customer_page_settings: normalizeCustomerPageSettings(
      store.shop.customer_page_settings,
      store.shop.name,
      store.shop.description,
    ),
  };
  store.appointments = store.appointments.map(normalizeAppointmentForBootstrap);
  return store;
}

function normalizeGuardianForBootstrap(guardian: Guardian): Guardian {
  const hasNotificationSettings = Object.prototype.hasOwnProperty.call(guardian, "notification_settings");

  return {
    ...guardian,
    // Legacy production databases may not have this column yet. In that case,
    // keep guardian-level notifications enabled so booking/grooming messages
    // continue to work until the migration is applied.
    notification_settings: hasNotificationSettings
      ? normalizeGuardianNotificationSettings(guardian.notification_settings)
      : normalizeGuardianNotificationSettings(null),
  };
}

const autoCompletedAppointmentStatuses = new Set<Appointment["status"]>(["confirmed", "in_progress", "almost_done"]);

async function resolveCustomerPageMediaImages(shop: Shop): Promise<Shop> {
  const mediaAssetIds = (shop.customer_page_settings.hero_media_asset_ids ?? [])
    .filter(Boolean)
    .slice(0, 10);
  const existingHeroImageUrls = (
    shop.customer_page_settings.hero_image_urls?.filter((imageUrl) => imageUrl.trim().length > 0) ??
    (shop.customer_page_settings.hero_image_url ? [shop.customer_page_settings.hero_image_url] : [])
  ).slice(0, 10);

  const supabase = getSupabaseAdmin();
  if (!supabase) return shop;

  const configuredAssetsResult = mediaAssetIds.length
    ? await supabase
        .from("media_assets")
        .select("id,bucket,storage_path,created_at")
        .eq("shop_id", shop.id)
        .eq("status", "ready")
        .is("deleted_at", null)
        .in("id", mediaAssetIds)
    : { data: [], error: null };
  const fallbackAssetsResult = await supabase
    .from("media_assets")
    .select("id,bucket,storage_path,created_at")
    .eq("shop_id", shop.id)
    .eq("media_kind", "shop_profile")
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (configuredAssetsResult.error && fallbackAssetsResult.error) return shop;

  const configuredAssets = configuredAssetsResult.data ?? [];
  const fallbackAssets = fallbackAssetsResult.data ?? [];
  const assetsById = new Map(
    configuredAssets.concat(fallbackAssets).map((asset) => [
      String(asset.id),
      {
        bucket: String(asset.bucket),
        storagePath: String(asset.storage_path),
      },
    ]),
  );
  const orderedMediaAssetIds = mediaAssetIds
    .concat(fallbackAssets.map((asset) => String(asset.id)).filter((mediaAssetId) => !mediaAssetIds.includes(mediaAssetId)))
    .slice(0, 10);

  const signedUrls = await Promise.all(
    orderedMediaAssetIds.map(async (mediaAssetId, index) => {
      const asset = assetsById.get(mediaAssetId);
      if (!asset) return existingHeroImageUrls[index] ?? "";
      try {
        return await createMediaSignedReadUrl({
          bucket: asset.bucket,
          path: asset.storagePath,
          expiresInSeconds: 10 * 60,
        });
      } catch {
        return existingHeroImageUrls[index] ?? "";
      }
    }),
  );
  const seenImageUrls = new Set<string>();
  const resolvedUrls = signedUrls
    .concat(existingHeroImageUrls)
    .filter((imageUrl) => {
      const trimmed = imageUrl.trim();
      if (!trimmed || seenImageUrls.has(trimmed)) return false;
      seenImageUrls.add(trimmed);
      return true;
    })
    .slice(0, 10);

  if (!resolvedUrls.length) return shop;

  return {
    ...shop,
    customer_page_settings: {
      ...shop.customer_page_settings,
      hero_image_url: resolvedUrls[0] ?? "",
      hero_image_urls: resolvedUrls,
    },
  };
}

function hasAppointmentWindowEnded(appointment: Appointment) {
  const today = currentDateInTimeZone();
  if (appointment.appointment_date < today) return true;
  if (appointment.appointment_date > today) return false;

  const endAtTime = new Date(appointment.end_at).getTime();
  if (!Number.isNaN(endAtTime)) {
    return endAtTime < Date.now();
  }

  const endClock = appointment.end_at.includes(":") ? formatClockTime(appointment.end_at) : formatClockTime(appointment.appointment_time);
  return minutesFromTime(endClock) < currentMinutesInTimeZone();
}

function normalizeAppointmentForBootstrap(appointment: Appointment): Appointment {
  return {
    ...appointment,
    visit_reminder_offset_minutes: appointment.visit_reminder_offset_minutes ?? 10,
    pickup_ready_eta_minutes: appointment.pickup_ready_eta_minutes ?? 5,
    status:
      autoCompletedAppointmentStatuses.has(appointment.status) && hasAppointmentWindowEnded(appointment)
        ? "completed"
        : appointment.status,
    appointment_time: formatClockTime(appointment.appointment_time),
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

  return {
    activeGuardians,
    deletedGuardians,
    activeGuardianIds,
  };
}

type StaffMemberRow = {
  id: string;
  name: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  profile_message?: string | null;
  chip_color_index?: number | null;
  phone: string | null;
  role: string;
  title_prefix?: string | null;
  position?: string | null;
  default_days: BootstrapStaffMember["defaultDays"] | null;
  start_time: string;
  end_time: string;
  regular_off: string | null;
  annual_remain: number | null;
};

type StaffScheduleOverrideRow = Omit<StaffScheduleOverride, "work_date" | "start_time" | "end_time"> & {
  work_date: string;
  start_time: string | null;
  end_time: string | null;
};

type OwnerProfileRow = {
  user_id: string;
  shop_id: string;
  login_id: string;
  name: string;
  birth_date: string | null;
  phone_number: string | null;
  identity_verified_at?: string | null;
  agreements?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function normalizeOwnerProfile(row: OwnerProfileRow | null | undefined): OwnerProfile | null {
  if (!row) return null;

  return {
    user_id: row.user_id,
    shop_id: row.shop_id,
    login_id: row.login_id,
    name: row.name,
    birth_date: row.birth_date ?? null,
    phone_number: row.phone_number ?? null,
    identity_verified_at: row.identity_verified_at ?? null,
    agreements: row.agreements ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeTime(value: string | null | undefined) {
  return (value ?? "").slice(0, 5) || "10:00";
}

function normalizeStaffMember(row: StaffMemberRow): BootstrapStaffMember {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name?.trim() || row.name,
    profileImageUrl: row.profile_image_url?.trim() || "",
    profileMessage: row.profile_message?.trim() || "",
    chipColorIndex: row.chip_color_index ?? null,
    phone: row.phone ?? "",
    role: row.role,
    titlePrefix: row.title_prefix?.trim() || "",
    position: row.position?.trim() || row.role.split(/[/.|]/)[0]?.trim() || "직원",
    defaultDays: row.default_days?.length ? row.default_days : ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    regularOff: row.regular_off ?? "일",
    annualRemain: row.annual_remain ?? 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

function buildDefaultBootstrapOwnerStaffMember(shop: Shop): BootstrapStaffMember {
  return {
    id: `${shop.id}-staff-owner`,
    name: "원장",
    displayName: "원장",
    profileImageUrl: "",
    profileMessage: "아이 성향에 맞춰 차분하게 미용해드려요.",
    chipColorIndex: 0,
    phone: shop.phone ?? "",
    role: "원장 / 전체 미용",
    position: "원장",
    defaultDays: defaultOwnerStaffDays,
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

function normalizeStaffScheduleOverride(row: StaffScheduleOverrideRow): StaffScheduleOverride {
  return {
    ...row,
    work_date: row.work_date,
    start_time: row.start_time ? normalizeTime(row.start_time) : null,
    end_time: row.end_time ? normalizeTime(row.end_time) : null,
  };
}

function isMissingAlimtalkCreditSummaryError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("shop_alimtalk_credit_summaries") ||
    message.includes("schema cache")
  );
}

function isMissingStaffProfileColumnsError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    (error?.code === "PGRST204" || error?.code === "42703") &&
    message.includes("staff_members") &&
    (message.includes("display_name") ||
      message.includes("profile_image_url") ||
      message.includes("profile_message") ||
      message.includes("chip_color_index") ||
      message.includes("title_prefix") ||
      message.includes("position") ||
      message.includes("schema cache"))
  );
}

function isMissingAppointmentChangeEventsError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("appointment_change_events") ||
    message.includes("schema cache")
  );
}

function getEventActualTimestamp(event: AppointmentChangeEvent, key: "actual_started_at" | "actual_completed_at") {
  const value = event.next_values?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : event.created_at;
}

function hydrateAppointmentActualTimesFromEvents(
  appointments: Appointment[],
  appointmentChangeEvents: AppointmentChangeEvent[],
) {
  if (appointmentChangeEvents.length === 0) return appointments;

  const actualTimesByAppointmentId = new Map<string, { actual_started_at?: string; actual_completed_at?: string }>();
  const orderedEvents = [...appointmentChangeEvents].sort((first, second) => first.created_at.localeCompare(second.created_at));

  for (const event of orderedEvents) {
    if (event.event_type !== "status") continue;

    const status = event.next_values?.status;
    if (status !== "in_progress" && status !== "completed") continue;

    const actualTimes = actualTimesByAppointmentId.get(event.appointment_id) ?? {};
    if (status === "in_progress" && !actualTimes.actual_started_at) {
      actualTimes.actual_started_at = getEventActualTimestamp(event, "actual_started_at");
    }
    if (status === "completed") {
      actualTimes.actual_completed_at = getEventActualTimestamp(event, "actual_completed_at");
    }
    actualTimesByAppointmentId.set(event.appointment_id, actualTimes);
  }

  if (actualTimesByAppointmentId.size === 0) return appointments;

  return appointments.map((appointment) => {
    const actualTimes = actualTimesByAppointmentId.get(appointment.id);
    if (!actualTimes) return appointment;

    return {
      ...appointment,
      actual_started_at: appointment.actual_started_at ?? actualTimes.actual_started_at ?? null,
      actual_completed_at: appointment.actual_completed_at ?? actualTimes.actual_completed_at ?? null,
    };
  });
}

export async function getBootstrap(shopId = "demo-shop", options: BootstrapOptions = {}): Promise<BootstrapPayload> {
  const includeLanding = options.includeLanding ?? true;
  const includeNotifications = options.includeNotifications ?? true;
  const includeGroomingRecords = options.includeGroomingRecords ?? true;
  const appointmentsFrom = options.appointmentsFrom;
  const appointmentsTo = options.appointmentsTo;
  const groomingRecordsFrom = options.groomingRecordsFrom;
  const groomingRecordsTo = options.groomingRecordsTo;
  const groomingRecordLimit = options.groomingRecordLimit;
  const notificationLimit = options.notificationLimit;

  if (shopId === "demo-shop" || shopId === "owner-demo") {
    return buildMockBootstrap(shopId);
  }

  if (!hasSupabaseServerEnv()) {
    throw new Error("Supabase 서버 설정이 없어 매장 데이터를 불러올 수 없습니다.");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase 서버 연결이 없어 매장 데이터를 불러올 수 없습니다.");
  }

  let notificationsQuery: any = includeNotifications
    ? supabase.from("notifications").select("*").eq("shop_id", shopId).order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  if (includeNotifications && notificationLimit && notificationLimit > 0) {
    notificationsQuery = notificationsQuery.limit(notificationLimit);
  }

  let appointmentsQuery = supabase.from("appointments").select("*").eq("shop_id", shopId).order("appointment_date").order("appointment_time");
  if (appointmentsFrom) {
    appointmentsQuery = appointmentsQuery.gte("appointment_date", appointmentsFrom);
  }
  if (appointmentsTo) {
    appointmentsQuery = appointmentsQuery.lte("appointment_date", appointmentsTo);
  }
  let appointmentChangeEventsQuery: any = supabase
    .from("appointment_change_events")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (appointmentsFrom) {
    appointmentChangeEventsQuery = appointmentChangeEventsQuery.gte("created_at", `${appointmentsFrom}T00:00:00+09:00`);
  }
  if (appointmentsTo) {
    appointmentChangeEventsQuery = appointmentChangeEventsQuery.lte("created_at", `${appointmentsTo}T23:59:59+09:00`);
  }

  let groomingRecordsQuery: any = includeGroomingRecords
    ? supabase.from("grooming_records").select("*").eq("shop_id", shopId).order("groomed_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  if (includeGroomingRecords && groomingRecordsFrom) {
    groomingRecordsQuery = groomingRecordsQuery.gte("groomed_at", `${groomingRecordsFrom}T00:00:00+09:00`);
  }
  if (includeGroomingRecords && groomingRecordsTo) {
    groomingRecordsQuery = groomingRecordsQuery.lte("groomed_at", `${groomingRecordsTo}T23:59:59+09:00`);
  }
  if (includeGroomingRecords && groomingRecordLimit && groomingRecordLimit > 0) {
    groomingRecordsQuery = groomingRecordsQuery.limit(groomingRecordLimit);
  }

  const interestsQuery = includeLanding
    ? supabase.from("landing_interests").select("*").order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const feedbackQuery = includeLanding
    ? supabase.from("landing_feedback").select("*").order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const alimtalkCreditSummaryQuery = supabase
    .from("shop_alimtalk_credit_summaries")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  const petStaffNotesQuery = supabase
    .from("pet_staff_notes")
    .select("*")
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false });
  const ownerProfileQuery = supabase
    .from("owner_profiles")
    .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
    .eq("shop_id", shopId)
    .maybeSingle();

  const [shopRes, guardiansRes, petsRes, servicesRes, staffMembersRes, staffScheduleOverridesRes, appointmentsRes, appointmentChangeEventsRes, recordsRes, notificationsRes, interestsRes, feedbackRes, alimtalkCreditSummaryRes, petStaffNotesRes, ownerProfileRes] =
    await Promise.all([
      supabase.from("shops").select("*").eq("id", shopId).single(),
      supabase.from("guardians").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("pets").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("services").select("*").eq("shop_id", shopId).order("created_at"),
      supabase
        .from("staff_members")
        .select("id,name,display_name,profile_image_url,profile_message,chip_color_index,phone,role,title_prefix,position,default_days,start_time,end_time,regular_off,annual_remain")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("staff_schedule_overrides")
        .select("id,shop_id,staff_id,work_date,status,start_time,end_time,period,reason,created_at,updated_at")
        .eq("shop_id", shopId)
        .order("work_date"),
      appointmentsQuery,
      appointmentChangeEventsQuery,
      groomingRecordsQuery,
      notificationsQuery,
      interestsQuery,
      feedbackQuery,
      alimtalkCreditSummaryQuery,
      petStaffNotesQuery,
      ownerProfileQuery,
    ]);

  if (shopRes.error || !shopRes.data) {
    throw new Error("매장 정보를 찾을 수 없습니다.");
  }

  let staffMemberRows = (staffMembersRes.data ?? []) as StaffMemberRow[];
  if (staffMembersRes.error && isMissingStaffProfileColumnsError(staffMembersRes.error)) {
    const legacyStaffMembersRes = await supabase
      .from("staff_members")
      .select("id,name,phone,role,default_days,start_time,end_time,regular_off,annual_remain")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");
    staffMemberRows = (legacyStaffMembersRes.data ?? []) as StaffMemberRow[];
  }

  const normalizedGuardians = ((guardiansRes.data ?? []) as Guardian[]).map(normalizeGuardianForBootstrap);
  const { activeGuardians, deletedGuardians, activeGuardianIds } = splitActiveGuardians(normalizedGuardians);
  const activePetIds = new Set(
    ((petsRes.data ?? []) as Pet[])
      .filter((pet) => activeGuardianIds.has(pet.guardian_id))
      .map((pet) => pet.id),
  );

  const rawShop = shopRes.data as Shop;
  const normalizedReservationPolicySettings = normalizeReservationPolicySettings(rawShop.reservation_policy_settings);
  const policyHasRegularClosedCycle = Object.prototype.hasOwnProperty.call(
    rawShop.reservation_policy_settings ?? {},
    "regular_closed_cycle",
  );
  const normalizedShop = await resolveCustomerPageMediaImages({
    ...normalizeShopBookingSettings(rawShop),
    business_hours: normalizeBusinessHours(rawShop.business_hours),
    regular_closed_cycle:
      policyHasRegularClosedCycle
        ? normalizedReservationPolicySettings.regular_closed_cycle ?? "weekly"
        : rawShop.regular_closed_cycle ?? "weekly",
    regular_closed_anchor_date:
      policyHasRegularClosedCycle
        ? normalizedReservationPolicySettings.regular_closed_anchor_date ?? null
        : rawShop.regular_closed_anchor_date ?? null,
    reservation_policy_settings: normalizedReservationPolicySettings,
    notification_settings: normalizeShopNotificationSettings((shopRes.data as Shop).notification_settings),
    customer_page_settings: normalizeCustomerPageSettings(
      rawShop.customer_page_settings,
      rawShop.name,
      rawShop.description,
    ),
  });
  const staffMembers = (staffMemberRows as StaffMemberRow[]).map(normalizeStaffMember);
  let appointmentChangeEvents: AppointmentChangeEvent[] = [];
  if (appointmentChangeEventsRes.error) {
    if (!isMissingAppointmentChangeEventsError(appointmentChangeEventsRes.error)) {
      throw new Error(appointmentChangeEventsRes.error.message);
    }
  } else {
    appointmentChangeEvents = (appointmentChangeEventsRes.data ?? []) as AppointmentChangeEvent[];
  }
  const appointments = hydrateAppointmentActualTimesFromEvents(
    ((appointmentsRes.data ?? []) as Appointment[])
      .filter((appointment) => activeGuardianIds.has(appointment.guardian_id) && activePetIds.has(appointment.pet_id)),
    appointmentChangeEvents,
  ).map(normalizeAppointmentForBootstrap);

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: normalizedShop,
    ownerProfile: ownerProfileRes.error ? null : normalizeOwnerProfile(ownerProfileRes.data as OwnerProfileRow | null),
    guardians: activeGuardians,
    deletedGuardians,
    pets: ((petsRes.data ?? []) as Pet[]).filter((pet) => activeGuardianIds.has(pet.guardian_id)),
    services: (servicesRes.data ?? []) as Service[],
    staffMembers: staffMembers.length > 0 ? staffMembers : [buildDefaultBootstrapOwnerStaffMember(normalizedShop)],
    staffScheduleOverrides: ((staffScheduleOverridesRes.data ?? []) as StaffScheduleOverrideRow[]).map(normalizeStaffScheduleOverride),
    appointments,
    appointmentChangeEvents,
    groomingRecords: ((recordsRes.data ?? []) as GroomingRecord[]).filter((record) =>
      activeGuardianIds.has(record.guardian_id) && activePetIds.has(record.pet_id),
    ),
    petStaffNotes: ((petStaffNotesRes.data ?? []) as PetStaffNote[]).filter((note) =>
      activeGuardianIds.has(note.guardian_id) && (!note.pet_id || activePetIds.has(note.pet_id)),
    ),
    notifications: ((notificationsRes.data ?? []) as BootstrapPayload["notifications"]).filter((notification) =>
      !notification.guardian_id || activeGuardianIds.has(notification.guardian_id),
    ),
    alimtalkCreditSummary:
      alimtalkCreditSummaryRes.error && isMissingAlimtalkCreditSummaryError(alimtalkCreditSummaryRes.error)
        ? null
        : ((alimtalkCreditSummaryRes.data ?? null) as AlimtalkCreditSummary | null),
    landingInterests: (interestsRes.data ?? []) as LandingInterest[],
    landingFeedback: (feedbackRes.data ?? []) as LandingFeedback[],
  });
}
