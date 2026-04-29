// Temporary diagnostic route for auditing all registered notification types.
export const runtime = "nodejs";

import { resolveAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import { getBootstrap } from "@/server/bootstrap";
import type {
  BootstrapPayload,
  GuardianNotificationSettings,
  NotificationType,
  ShopNotificationSettings,
} from "@/types/domain";

type RelayTemplateAlias =
  | "booking_received"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_rescheduled_confirmed"
  | "appointment_reminder_10m"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "birthday_greeting";

type ShopSettingKey =
  | "enabled"
  | "revisit_enabled"
  | "booking_confirmed_enabled"
  | "booking_rejected_enabled"
  | "booking_cancelled_enabled"
  | "booking_rescheduled_enabled"
  | "grooming_almost_done_enabled"
  | "grooming_completed_enabled"
  | null;

type GuardianSettingKey = keyof GuardianNotificationSettings | null;

type NotificationChannel = "alimtalk" | "in_app" | "data_only";
type NotificationTarget = "guardian" | "owner" | "system";

type NotificationAuditSpec = {
  type: NotificationType;
  target: NotificationTarget;
  channel: NotificationChannel;
  trigger: string;
  dispatchSource: string;
  relayTemplateAlias: RelayTemplateAlias | null;
  shopSettingKey: ShopSettingKey;
  guardianSettingKey: GuardianSettingKey;
  notes: string | null;
};

type RelayTemplateDebugInfo = {
  configured: boolean;
  length: number;
};

type RelayTemplateDebugBody = {
  ok?: boolean;
  templates?: Partial<Record<RelayTemplateAlias, RelayTemplateDebugInfo>>;
};

const relayTemplateAliases: RelayTemplateAlias[] = [
  "booking_received",
  "booking_confirmed",
  "booking_rejected",
  "booking_cancelled",
  "booking_rescheduled_confirmed",
  "appointment_reminder_10m",
  "grooming_started",
  "grooming_almost_done",
  "grooming_completed",
  "revisit_notice",
  "birthday_greeting",
];

const notificationAuditSpecs: NotificationAuditSpec[] = [
  {
    type: "booking_received",
    target: "guardian",
    channel: "alimtalk",
    trigger: "고객이 예약을 접수하면 즉시 발송",
    dispatchSource: "src/server/customer-bookings.ts",
    relayTemplateAlias: "booking_received",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "수동 승인 매장에서도 예약 접수 완료 안내용으로 사용",
  },
  {
    type: "booking_confirmed",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 confirmed가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "booking_confirmed",
    shopSettingKey: "booking_confirmed_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "owner_booking_requested",
    target: "owner",
    channel: "in_app",
    trigger: "고객 예약 접수 시 오너 인앱 알림 생성",
    dispatchSource: "src/server/customer-bookings.ts",
    relayTemplateAlias: null,
    shopSettingKey: "enabled",
    guardianSettingKey: null,
    notes: "알림톡이 아니라 오너용 인앱 알림",
  },
  {
    type: "booking_rejected",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 rejected가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "booking_rejected",
    shopSettingKey: "booking_rejected_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "booking_cancelled",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 cancelled가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "booking_cancelled",
    shopSettingKey: "booking_cancelled_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "booking_rescheduled_confirmed",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 변경 완료 시 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "booking_rescheduled_confirmed",
    shopSettingKey: "booking_rescheduled_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "appointment_reminder_10m",
    target: "guardian",
    channel: "alimtalk",
    trigger: "방문 10분 전 스케줄러에서 발송",
    dispatchSource: "src/server/notification-dispatch.ts#runScheduledNotificationDispatch",
    relayTemplateAlias: "appointment_reminder_10m",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "현재는 전체 알림 ON이면 발송",
  },
  {
    type: "grooming_started",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 in_progress가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "grooming_started",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "현재는 전체 알림 ON이면 발송",
  },
  {
    type: "grooming_almost_done",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 almost_done이 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "grooming_almost_done",
    shopSettingKey: "grooming_almost_done_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "grooming_completed",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 completed가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    relayTemplateAlias: "grooming_completed",
    shopSettingKey: "grooming_completed_enabled",
    guardianSettingKey: "enabled",
    notes: null,
  },
  {
    type: "revisit_notice",
    target: "guardian",
    channel: "alimtalk",
    trigger: "재방문 대상 스케줄러 또는 자동화에서 발송",
    dispatchSource: "future automation / dispatchNotification",
    relayTemplateAlias: "revisit_notice",
    shopSettingKey: "revisit_enabled",
    guardianSettingKey: "revisit_enabled",
    notes: "매장과 고객 양쪽 revisit 설정이 모두 켜져야 함",
  },
  {
    type: "birthday_greeting",
    target: "guardian",
    channel: "alimtalk",
    trigger: "생일 대상 스케줄러 또는 자동화에서 발송",
    dispatchSource: "future automation / dispatchNotification",
    relayTemplateAlias: "birthday_greeting",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "현재는 전체 알림 ON이면 발송",
  },
  {
    type: "landing_feedback",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 피드백 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_feedback table",
    relayTemplateAlias: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림톡 발송 타입이 아니라 데이터 기록용",
  },
  {
    type: "waitlist_interest",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 대기수요 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_interests table",
    relayTemplateAlias: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림톡 발송 타입이 아니라 데이터 기록용",
  },
];

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getBodyPreview(body: unknown, maxLength: number) {
  if (typeof body === "string") {
    return body.slice(0, maxLength);
  }

  try {
    return JSON.stringify(body).slice(0, maxLength);
  } catch {
    return "[unserializable]";
  }
}

function getRelayUrlParts(relayUrl: string | null | undefined) {
  if (!relayUrl) {
    return {
      relayHost: null,
      relayPathname: null,
    };
  }

  try {
    const parsed = new URL(relayUrl);
    return {
      relayHost: parsed.host,
      relayPathname: parsed.pathname,
    };
  } catch {
    return {
      relayHost: null,
      relayPathname: null,
    };
  }
}

function shouldSendByShopSettings(
  settings: ShopNotificationSettings | null,
  type: NotificationType,
) {
  if (!settings) return null;
  if (!settings.enabled) return false;

  switch (type) {
    case "booking_received":
    case "owner_booking_requested":
    case "appointment_reminder_10m":
    case "grooming_started":
    case "birthday_greeting":
      return true;
    case "booking_confirmed":
      return settings.booking_confirmed_enabled;
    case "booking_rejected":
      return settings.booking_rejected_enabled;
    case "booking_cancelled":
      return settings.booking_cancelled_enabled;
    case "booking_rescheduled_confirmed":
      return settings.booking_rescheduled_enabled;
    case "grooming_almost_done":
      return settings.grooming_almost_done_enabled;
    case "grooming_completed":
      return settings.grooming_completed_enabled;
    case "revisit_notice":
      return settings.revisit_enabled;
    case "landing_feedback":
    case "waitlist_interest":
      return null;
    default:
      return false;
  }
}

function shouldSendByGuardianSettings(
  settings: GuardianNotificationSettings | null,
  type: NotificationType,
) {
  if (!settings) return null;
  if (!settings.enabled) return false;

  switch (type) {
    case "revisit_notice":
      return settings.revisit_enabled;
    case "landing_feedback":
    case "waitlist_interest":
    case "owner_booking_requested":
      return null;
    default:
      return true;
  }
}

function getShopSettingEnabled(
  settings: ShopNotificationSettings | null,
  key: ShopSettingKey,
) {
  if (!settings || !key) return null;
  return settings[key];
}

function getGuardianSettingEnabled(
  settings: GuardianNotificationSettings | null,
  key: GuardianSettingKey,
) {
  if (!settings || !key) return null;
  return settings[key];
}

async function fetchRelayDiagnostics(relayUrl: string, relaySecret: string | null | undefined) {
  const parsedRelayUrl = new URL(relayUrl);

  const healthUrl = new URL(parsedRelayUrl.toString());
  healthUrl.pathname = "/health";
  healthUrl.search = "";
  healthUrl.hash = "";

  const templatesUrl = new URL(parsedRelayUrl.toString());
  templatesUrl.pathname = "/debug/templates";
  templatesUrl.search = "";
  templatesUrl.hash = "";

  const [healthResponse, templatesResponse] = await Promise.all([
    fetch(healthUrl.toString(), {
      method: "GET",
      cache: "no-store",
    }),
    fetch(templatesUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: relaySecret ? { "x-relay-secret": relaySecret } : {},
    }),
  ]);

  const healthText = await healthResponse.text();
  const templatesText = await templatesResponse.text();
  const healthBody = safeJsonParse(healthText);
  const templatesBody = safeJsonParse(templatesText);

  return {
    relayHealth: {
      status: healthResponse.status,
      ok: healthResponse.ok,
      bodyPreview: getBodyPreview(healthBody, 800),
    },
    relayTemplates: {
      status: templatesResponse.status,
      ok: templatesResponse.ok,
      bodyPreview: getBodyPreview(templatesBody, 1600),
      body: templatesBody,
    },
  };
}

export async function GET(request: Request) {
  const relayUrl = serverEnv.alimtalkRelayUrl;
  const relaySecret = serverEnv.alimtalkRelaySecret;
  const { relayHost, relayPathname } = getRelayUrlParts(relayUrl);
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");

  let shop: BootstrapPayload["shop"] | null = null;
  let guardian: BootstrapPayload["guardians"][number] | null = null;
  let bootstrapError: string | null = null;

  if (shopId) {
    try {
      const bootstrap = await getBootstrap(shopId);
      shop = bootstrap.shop;
      guardian = bootstrap.guardians[0] ?? null;
    } catch (error) {
      bootstrapError = error instanceof Error ? error.message : String(error);
    }
  }

  let relayHealth: {
    status: number;
    ok: boolean;
    bodyPreview: string;
  } | null = null;
  let relayTemplates: {
    status: number;
    ok: boolean;
    bodyPreview: string;
  } | null = null;
  let relayTemplateMap: Partial<Record<RelayTemplateAlias, RelayTemplateDebugInfo>> | null = null;
  let relayError: string | null = null;

  if (relayUrl) {
    try {
      const relayDiagnostics = await fetchRelayDiagnostics(relayUrl, relaySecret);
      relayHealth = relayDiagnostics.relayHealth;
      relayTemplates = {
        status: relayDiagnostics.relayTemplates.status,
        ok: relayDiagnostics.relayTemplates.ok,
        bodyPreview: relayDiagnostics.relayTemplates.bodyPreview,
      };

      const relayTemplatesBody = relayDiagnostics.relayTemplates.body as RelayTemplateDebugBody;
      relayTemplateMap = relayTemplatesBody.templates ?? null;
    } catch (error) {
      relayError = error instanceof Error ? error.message : String(error);
    }
  }

  const appTemplates = Object.fromEntries(
    relayTemplateAliases.map((alias) => {
      const resolved = resolveAlimtalkTemplateKey(alias);
      return [
        alias,
        {
          configured: Boolean(resolved),
          length: resolved?.length ?? 0,
        },
      ];
    }),
  ) as Record<RelayTemplateAlias, RelayTemplateDebugInfo>;

  const notifications = notificationAuditSpecs.map((spec) => {
    const shopSettings = shop?.notification_settings ?? null;
    const guardianSettings = guardian?.notification_settings ?? null;
    const shopAllows = shouldSendByShopSettings(shopSettings, spec.type);
    const guardianAllows =
      spec.target === "guardian"
        ? shouldSendByGuardianSettings(guardianSettings, spec.type)
        : null;
    const relayTemplateConfigured =
      spec.relayTemplateAlias && relayTemplateMap
        ? relayTemplateMap[spec.relayTemplateAlias]?.configured ?? false
        : spec.relayTemplateAlias
          ? null
          : null;

    return {
      type: spec.type,
      target: spec.target,
      channel: spec.channel,
      trigger: spec.trigger,
      dispatchSource: spec.dispatchSource,
      notes: spec.notes,
      relayTemplateAlias: spec.relayTemplateAlias,
      appTemplateConfigured:
        spec.relayTemplateAlias ? appTemplates[spec.relayTemplateAlias].configured : null,
      relayTemplateConfigured,
      shopSettingKey: spec.shopSettingKey,
      shopEnabled: shopSettings?.enabled ?? null,
      shopSettingEnabled: getShopSettingEnabled(shopSettings, spec.shopSettingKey),
      guardianSettingKey: spec.guardianSettingKey,
      guardianEnabled: guardianSettings?.enabled ?? null,
      guardianSettingEnabled: getGuardianSettingEnabled(guardianSettings, spec.guardianSettingKey),
      sampleWouldDispatch:
        spec.channel === "data_only"
          ? null
          : spec.target === "guardian"
            ? shopAllows === null || guardianAllows === null
              ? null
              : shopAllows && guardianAllows
            : shopAllows,
    };
  });

  return Response.json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    relay: {
      usesRelay: Boolean(relayUrl && relaySecret),
      hasRelayUrl: Boolean(relayUrl),
      hasRelaySecret: Boolean(relaySecret),
      relaySecretLength: relaySecret?.length ?? 0,
      relayHost,
      relayPathname,
      health: relayHealth,
      templates: relayTemplates,
      error: relayError,
    },
    shopAudit: shop
      ? {
          shopId: shop.id,
          notificationSettings: shop.notification_settings,
          sampleGuardianId: guardian?.id ?? null,
          sampleGuardianNotificationSettings: guardian?.notification_settings ?? null,
        }
      : null,
    bootstrapError,
    summary: {
      totalRegisteredTypes: notificationAuditSpecs.length,
      alimtalkTypes: notificationAuditSpecs.filter((item) => item.channel === "alimtalk").length,
      inAppTypes: notificationAuditSpecs.filter((item) => item.channel === "in_app").length,
      dataOnlyTypes: notificationAuditSpecs.filter((item) => item.channel === "data_only").length,
      relayTemplateAliases: relayTemplateAliases.length,
    },
    appTemplates,
    notifications,
  });
}
