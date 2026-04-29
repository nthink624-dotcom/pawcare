import { normalizeShopBookingSettings } from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";
import {
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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
} from "@/types/domain";

function buildMockBootstrap(shopId?: string): BootstrapPayload {
  if (shopId === "owner-demo") {
    return buildOwnerDemoBootstrap();
  }

  const store = normalizeBootstrapNotifications(buildDemoBootstrap());
  store.shop = {
    ...normalizeShopBookingSettings(store.shop),
    id: shopId || store.shop.id,
    customer_page_settings: normalizeCustomerPageSettings(
      store.shop.customer_page_settings,
      store.shop.name,
      store.shop.description,
    ),
  };
  return store;
}

function normalizeGuardianForBootstrap(guardian: Guardian) {
  const hasNotificationSettings = Object.prototype.hasOwnProperty.call(guardian, "notification_settings");

  return {
    ...guardian,
    // Legacy production databases may not have this column yet. In that case,
    // keep guardian-level notifications enabled so booking/grooming messages
    // continue to work until the migration is applied.
    notification_settings: hasNotificationSettings
      ? normalizeGuardianNotificationSettings(guardian.notification_settings)
      : { enabled: true, revisit_enabled: true },
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

export async function getBootstrap(shopId = "demo-shop"): Promise<BootstrapPayload> {
  if (!hasSupabaseServerEnv()) {
    return buildMockBootstrap(shopId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return buildMockBootstrap(shopId);
  }

  const [shopRes, guardiansRes, petsRes, servicesRes, appointmentsRes, recordsRes, notificationsRes, interestsRes, feedbackRes] =
    await Promise.all([
      supabase.from("shops").select("*").eq("id", shopId).single(),
      supabase.from("guardians").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("pets").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("services").select("*").eq("shop_id", shopId).order("created_at"),
      supabase.from("appointments").select("*").eq("shop_id", shopId).order("appointment_date").order("appointment_time"),
      supabase.from("grooming_records").select("*").eq("shop_id", shopId).order("groomed_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      supabase.from("landing_interests").select("*").order("created_at", { ascending: false }),
      supabase.from("landing_feedback").select("*").order("created_at", { ascending: false }),
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

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: {
      ...normalizeShopBookingSettings(shopRes.data as Shop),
      notification_settings: normalizeShopNotificationSettings((shopRes.data as Shop).notification_settings),
      customer_page_settings: normalizeCustomerPageSettings(
        (shopRes.data as Shop).customer_page_settings,
        (shopRes.data as Shop).name,
        (shopRes.data as Shop).description,
      ),
    },
    guardians: activeGuardians,
    deletedGuardians,
    pets: ((petsRes.data ?? []) as Pet[]).filter((pet) => activeGuardianIds.has(pet.guardian_id)),
    services: (servicesRes.data ?? []) as Service[],
    appointments: ((appointmentsRes.data ?? []) as Appointment[]).filter((appointment) =>
      activeGuardianIds.has(appointment.guardian_id) && activePetIds.has(appointment.pet_id),
    ),
    groomingRecords: ((recordsRes.data ?? []) as GroomingRecord[]).filter((record) =>
      activeGuardianIds.has(record.guardian_id) && activePetIds.has(record.pet_id),
    ),
    notifications: ((notificationsRes.data ?? []) as BootstrapPayload["notifications"]).filter((notification) =>
      !notification.guardian_id || activeGuardianIds.has(notification.guardian_id),
    ),
    landingInterests: (interestsRes.data ?? []) as LandingInterest[],
    landingFeedback: (feedbackRes.data ?? []) as LandingFeedback[],
  });
}
