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
import { seedDemoDataForShop } from "@/server/demo-seed";
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
    ...store.shop,
    id: shopId || store.shop.id,
    customer_page_settings: normalizeCustomerPageSettings(
      store.shop.customer_page_settings,
      store.shop.name,
      store.shop.description,
    ),
  };
  return store;
}

export async function getBootstrap(shopId = "demo-shop", allowSeed = true): Promise<BootstrapPayload> {
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
    return buildMockBootstrap(shopId);
  }

  const isEmptyForTesting =
    allowSeed &&
    process.env.NODE_ENV !== "production" &&
    (appointmentsRes.data?.length ?? 0) === 0 &&
    (recordsRes.data?.length ?? 0) === 0;

  if (isEmptyForTesting) {
    await seedDemoDataForShop(
      shopId,
      ((shopRes.data as Shop).name || "멍매니저 테스트 매장") as string,
      ((shopRes.data as Shop).address || "서울시 강남구 테스트로 1") as string,
    );
    return getBootstrap(shopId, false);
  }

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: {
      ...(shopRes.data as Shop),
      notification_settings: normalizeShopNotificationSettings((shopRes.data as Shop).notification_settings),
      customer_page_settings: normalizeCustomerPageSettings(
        (shopRes.data as Shop).customer_page_settings,
        (shopRes.data as Shop).name,
        (shopRes.data as Shop).description,
      ),
    },
    guardians: ((guardiansRes.data ?? []) as Guardian[]).map((guardian) => ({
      ...guardian,
      notification_settings: normalizeGuardianNotificationSettings(guardian.notification_settings),
    })),
    pets: (petsRes.data ?? []) as Pet[],
    services: (servicesRes.data ?? []) as Service[],
    appointments: (appointmentsRes.data ?? []) as Appointment[],
    groomingRecords: (recordsRes.data ?? []) as GroomingRecord[],
    notifications: (notificationsRes.data ?? []) as BootstrapPayload["notifications"],
    landingInterests: (interestsRes.data ?? []) as LandingInterest[],
    landingFeedback: (feedbackRes.data ?? []) as LandingFeedback[],
  });
}
