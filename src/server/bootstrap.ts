import { normalizeShopBookingSettings } from "@/lib/booking-slot-settings";
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
import { currentDateInTimeZone, formatClockTime } from "@/lib/utils";
import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  LandingFeedback,
  LandingInterest,
  Pet,
  Service,
  Shop,
  AlimtalkCreditSummary,
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

function normalizeAppointmentForBootstrap(appointment: Appointment): Appointment {
  const today = currentDateInTimeZone();
  return {
    ...appointment,
    status:
      appointment.status === "confirmed" && appointment.appointment_date < today
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
  phone: string | null;
  role: string;
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

function normalizeTime(value: string | null | undefined) {
  return (value ?? "").slice(0, 5) || "10:00";
}

function normalizeStaffMember(row: StaffMemberRow): BootstrapStaffMember {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    role: row.role,
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
    phone: shop.phone ?? "",
    role: "원장 / 전체 미용",
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

export async function getBootstrap(shopId = "demo-shop", options: BootstrapOptions = {}): Promise<BootstrapPayload> {
  const allowMock = options.allowMock ?? true;
  const includeLanding = options.includeLanding ?? true;
  const includeNotifications = options.includeNotifications ?? true;
  const includeGroomingRecords = options.includeGroomingRecords ?? true;
  const appointmentsFrom = options.appointmentsFrom;
  const appointmentsTo = options.appointmentsTo;
  const groomingRecordsFrom = options.groomingRecordsFrom;
  const groomingRecordsTo = options.groomingRecordsTo;
  const groomingRecordLimit = options.groomingRecordLimit;
  const notificationLimit = options.notificationLimit;

  if (!hasSupabaseServerEnv()) {
    if (!allowMock) {
      throw new Error("Supabase 서버 설정이 없어 운영 오너 데이터를 불러올 수 없습니다.");
    }
    return buildMockBootstrap(shopId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!allowMock) {
      throw new Error("Supabase 서버 연결이 없어 운영 오너 데이터를 불러올 수 없습니다.");
    }
    return buildMockBootstrap(shopId);
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

  const [shopRes, guardiansRes, petsRes, servicesRes, staffMembersRes, staffScheduleOverridesRes, appointmentsRes, recordsRes, notificationsRes, interestsRes, feedbackRes, alimtalkCreditSummaryRes] =
    await Promise.all([
      supabase.from("shops").select("*").eq("id", shopId).single(),
      supabase.from("guardians").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("pets").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("services").select("*").eq("shop_id", shopId).order("created_at"),
      supabase
        .from("staff_members")
        .select("id,name,phone,role,default_days,start_time,end_time,regular_off,annual_remain")
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
      groomingRecordsQuery,
      notificationsQuery,
      interestsQuery,
      feedbackQuery,
      alimtalkCreditSummaryQuery,
    ]);

  if (shopRes.error || !shopRes.data) {
    if (shopId !== "demo-shop" && shopId !== "owner-demo") {
      throw new Error("매장 정보를 찾을 수 없습니다.");
    }
    return buildMockBootstrap(shopId);
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
  const normalizedShop = {
    ...normalizeShopBookingSettings(rawShop),
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
  };
  const staffMembers = ((staffMembersRes.data ?? []) as StaffMemberRow[]).map(normalizeStaffMember);

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: normalizedShop,
    guardians: activeGuardians,
    deletedGuardians,
    pets: ((petsRes.data ?? []) as Pet[]).filter((pet) => activeGuardianIds.has(pet.guardian_id)),
    services: (servicesRes.data ?? []) as Service[],
    staffMembers: staffMembers.length > 0 ? staffMembers : [buildDefaultBootstrapOwnerStaffMember(normalizedShop)],
    staffScheduleOverrides: ((staffScheduleOverridesRes.data ?? []) as StaffScheduleOverrideRow[]).map(normalizeStaffScheduleOverride),
    appointments: ((appointmentsRes.data ?? []) as Appointment[])
      .filter((appointment) => activeGuardianIds.has(appointment.guardian_id) && activePetIds.has(appointment.pet_id))
      .map(normalizeAppointmentForBootstrap),
    groomingRecords: ((recordsRes.data ?? []) as GroomingRecord[]).filter((record) =>
      activeGuardianIds.has(record.guardian_id) && activePetIds.has(record.pet_id),
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
