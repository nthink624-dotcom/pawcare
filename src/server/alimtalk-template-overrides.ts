import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  fillNotificationTemplate,
  type AlimtalkTemplateAlias,
  type NotificationTemplateVariables,
} from "@/lib/notification-registry";
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

  const overrides = await getActiveTemplateOverrides();
  const template = overrides.get(spec.templateAlias)?.template_body || spec.draftBody;
  return fillNotificationTemplate(template, values);
}
