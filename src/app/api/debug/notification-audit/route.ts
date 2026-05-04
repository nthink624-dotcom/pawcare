// Temporary diagnostic route for auditing all registered notification types.
export const runtime = "nodejs";

import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  NOTIFICATION_REGISTRY,
  type AlimtalkTemplateAlias,
  getGuardianSettingEnabled,
  getShopSettingEnabled,
  shouldSendByGuardianSettings,
  shouldSendByShopSettings,
} from "@/lib/notification-registry";
import { resolveAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import { getBootstrap } from "@/server/bootstrap";
import type { BootstrapPayload } from "@/types/domain";

type RelayTemplateDebugInfo = {
  configured: boolean;
  length: number;
};

type RelayTemplateDebugBody = {
  ok?: boolean;
  templates?: Partial<Record<AlimtalkTemplateAlias, RelayTemplateDebugInfo>>;
};

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

  let relayHealth: { status: number; ok: boolean; bodyPreview: string } | null = null;
  let relayTemplates: { status: number; ok: boolean; bodyPreview: string } | null = null;
  let relayTemplateMap: Partial<Record<AlimtalkTemplateAlias, RelayTemplateDebugInfo>> | null = null;
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
    ALIMTALK_NOTIFICATION_REGISTRY.map((item) => {
      const resolved = resolveAlimtalkTemplateKey(item.templateAlias);
      return [
        item.templateAlias,
        {
          configured: Boolean(resolved),
          length: resolved?.length ?? 0,
        },
      ];
    }),
  ) as Record<AlimtalkTemplateAlias, RelayTemplateDebugInfo>;

  const notifications = NOTIFICATION_REGISTRY.map((spec) => {
    const shopSettings = shop?.notification_settings ?? null;
    const guardianSettings = guardian?.notification_settings ?? null;
    const shopAllows = shouldSendByShopSettings(shopSettings, spec.type);
    const guardianAllows =
      spec.target === "guardian" ? shouldSendByGuardianSettings(guardianSettings, spec.type) : null;
    const relayTemplateConfigured =
      spec.templateAlias && relayTemplateMap ? relayTemplateMap[spec.templateAlias]?.configured ?? false : null;

    return {
      type: spec.type,
      title: spec.title,
      target: spec.target,
      channel: spec.channel,
      trigger: spec.trigger,
      dispatchSource: spec.dispatchSource,
      notes: spec.notes,
      relayTemplateAlias: spec.templateAlias,
      appTemplateConfigured: spec.templateAlias ? appTemplates[spec.templateAlias].configured : null,
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
      totalRegisteredTypes: NOTIFICATION_REGISTRY.length,
      alimtalkTypes: NOTIFICATION_REGISTRY.filter((item) => item.channel === "alimtalk").length,
      inAppTypes: NOTIFICATION_REGISTRY.filter((item) => item.channel === "in_app").length,
      dataOnlyTypes: NOTIFICATION_REGISTRY.filter((item) => item.channel === "data_only").length,
      relayTemplateAliases: ALIMTALK_NOTIFICATION_REGISTRY.length,
    },
    appTemplates,
    notifications,
  });
}
