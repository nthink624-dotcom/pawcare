import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  fillNotificationTemplate,
  type AlimtalkTemplateAlias,
  type NotificationTemplateVariables,
} from "@/lib/notification-registry";
import { getConfiguredAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/domain";

export type AppTemplateDraft = {
  alias: AlimtalkTemplateAlias;
  title: string;
  body: string;
  defaultBody: string;
  isOverride: boolean;
  updatedAt: string | null;
};

type TemplateOverrideRow = {
  template_alias: AlimtalkTemplateAlias;
  template_body: string;
  is_active: boolean;
  updated_at: string | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type ConnectedTemplateButton = {
  type: "WL";
  name: string;
  linkMobile: string;
  linkPc?: string | null;
};

type ConnectedTemplateDetail = {
  templateCode: string;
  templateContent: string | null;
  buttons: ConnectedTemplateButton[];
};

type RelayTemplateCatalogBody = {
  items?: Array<{
    alias?: AlimtalkTemplateAlias | null;
    configuredCode?: string | null;
    detail?: ConnectedTemplateDetail | null;
  }>;
  allTemplates?: ConnectedTemplateDetail[];
};

const TEMPLATE_OVERRIDE_SELECT = "template_alias, template_body, is_active, updated_at";

function isMissingTemplateOverrideTableError(error: SupabaseLikeError) {
  const message = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return error.code === "42P01" || message.includes("platform_alimtalk_template_overrides") || message.includes("schema cache");
}

function isTemplateAlias(value: string): value is AlimtalkTemplateAlias {
  return ALIMTALK_NOTIFICATION_REGISTRY.some((item) => item.templateAlias === value);
}

function getRegistryItemByAlias(alias: AlimtalkTemplateAlias) {
  return ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.templateAlias === alias) ?? null;
}

export function requiresConnectedSsodaaTemplate() {
  return serverEnv.alimtalkProvider === "ssodaa" || Boolean(serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret);
}

function getRelayAdminUrlCandidates(pathname: string) {
  if (!serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) return [];

  return Array.from(
    new Set(
      [serverEnv.alimtalkRelayAdminUrl, serverEnv.alimtalkRelayUrl]
        .filter((url): url is string => Boolean(url?.trim()))
        .map((url) => {
          const parsed = new URL(url);
          parsed.pathname = pathname;
          parsed.search = "";
          return parsed.toString();
        }),
    ),
  );
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeConnectedButton(button: ConnectedTemplateButton): ConnectedTemplateButton | null {
  const name = button.name?.trim();
  const linkMobile = button.linkMobile?.trim();
  if (!name || !linkMobile) return null;

  return {
    type: button.type || "WL",
    name,
    linkMobile,
    linkPc: button.linkPc?.trim() || linkMobile,
  };
}

async function getConnectedSsodaaTemplate(alias: AlimtalkTemplateAlias): Promise<ConnectedTemplateDetail | null> {
  const templateCode = getConfiguredAlimtalkTemplateKey(alias)?.trim();
  if (!templateCode) return null;

  const urls = getRelayAdminUrlCandidates("/admin/templates");
  if (!urls.length) return null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
        },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const body = (await parseJsonResponse(response)) as RelayTemplateCatalogBody | null;
      const detail =
        body?.items?.find((item) => item.alias === alias && item.configuredCode === templateCode)?.detail ??
        body?.allTemplates?.find((item) => item.templateCode === templateCode) ??
        null;

      if (!detail) continue;

      return {
        templateCode,
        templateContent: detail.templateContent ?? null,
        buttons: (detail.buttons ?? []).map(normalizeConnectedButton).filter((item): item is ConnectedTemplateButton => Boolean(item)),
      };
    } catch {
      // Try the next relay URL candidate.
    }
  }

  return null;
}

function fillTemplateValue(value: string, variables: NotificationTemplateVariables) {
  return Object.entries(variables).reduce((result, [key, variableValue]) => {
    const resolvedValue = variableValue ?? "";
    return result.replaceAll(`#{${key}}`, resolvedValue);
  }, value);
}

export async function getConnectedSsodaaTemplateButtons(
  type: NotificationType,
  values: NotificationTemplateVariables,
): Promise<ConnectedTemplateButton[] | null> {
  const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
  if (!spec) return null;

  const detail = await getConnectedSsodaaTemplate(spec.templateAlias);
  if (!detail) return null;

  return detail.buttons.map((button) => ({
    ...button,
    linkMobile: fillTemplateValue(button.linkMobile, values),
    linkPc: button.linkPc ? fillTemplateValue(button.linkPc, values) : fillTemplateValue(button.linkMobile, values),
  }));
}

async function getActiveTemplateOverrides() {
  const admin = getSupabaseAdmin();
  if (!admin) return new Map<AlimtalkTemplateAlias, TemplateOverrideRow>();

  const result = await admin
    .from("platform_alimtalk_template_overrides")
    .select(TEMPLATE_OVERRIDE_SELECT)
    .eq("is_active", true);

  if (result.error) {
    if (isMissingTemplateOverrideTableError(result.error)) {
      return new Map<AlimtalkTemplateAlias, TemplateOverrideRow>();
    }
    throw new Error(result.error.message || "알림톡 템플릿 수정본을 불러오지 못했습니다.");
  }

  return new Map(
    ((result.data ?? []) as TemplateOverrideRow[])
      .filter((row) => isTemplateAlias(row.template_alias))
      .map((row) => [row.template_alias, row]),
  );
}

export async function getAppTemplateDrafts(): Promise<AppTemplateDraft[]> {
  const overrides = await getActiveTemplateOverrides();

  return ALIMTALK_NOTIFICATION_REGISTRY.map((item) => {
    const override = overrides.get(item.templateAlias);
    return {
      alias: item.templateAlias,
      title: item.title,
      body: override?.template_body || item.draftBody,
      defaultBody: item.draftBody,
      isOverride: Boolean(override?.template_body),
      updatedAt: override?.updated_at ?? null,
    };
  });
}

export async function saveAppTemplateDraft(input: {
  alias: AlimtalkTemplateAlias;
  body: string;
  adminId: string;
}): Promise<AppTemplateDraft> {
  const spec = getRegistryItemByAlias(input.alias);
  if (!spec) {
    throw new Error("알림톡 템플릿 종류를 찾을 수 없습니다.");
  }

  const body = input.body.trim();
  if (!body) {
    throw new Error("템플릿 본문을 입력해 주세요.");
  }
  if (body.length > 1000) {
    throw new Error("템플릿 본문은 1000자 이하로 입력해 주세요.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase 설정을 확인해 주세요.");
  }

  const result = await admin
    .from("platform_alimtalk_template_overrides")
    .upsert(
      {
        template_alias: input.alias,
        template_body: body,
        is_active: true,
        updated_by_admin_id: input.adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "template_alias" },
    )
    .select(TEMPLATE_OVERRIDE_SELECT)
    .single();

  if (result.error) {
    if (isMissingTemplateOverrideTableError(result.error)) {
      throw new Error("템플릿 저장 테이블이 아직 DB에 만들어지지 않았습니다. 마이그레이션 적용 후 다시 저장해 주세요.");
    }
    throw new Error(result.error.message || "알림톡 템플릿 저장에 실패했습니다.");
  }

  const row = result.data as TemplateOverrideRow;
  return {
    alias: input.alias,
    title: spec.title,
    body: row.template_body,
    defaultBody: spec.draftBody,
    isOverride: true,
    updatedAt: row.updated_at ?? null,
  };
}

export async function renderNotificationTemplateBodyWithOverrides(type: NotificationType, values: NotificationTemplateVariables) {
  const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
  if (!spec) return null;

  const connectedTemplate = await getConnectedSsodaaTemplate(spec.templateAlias);
  if (requiresConnectedSsodaaTemplate() && !connectedTemplate?.templateContent) {
    throw new Error(`${spec.title} 쏘다 템플릿 본문을 확인하지 못해 발송을 중단했습니다.`);
  }

  const template = connectedTemplate?.templateContent || spec.draftBody;
  return fillNotificationTemplate(template, values);
}
