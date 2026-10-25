import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  fillNotificationTemplate,
  type AlimtalkTemplateAlias,
  type NotificationTemplateVariables,
} from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/domain";

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
    throw new Error(result.error.message || "알림톡 템플릿 본문을 불러오지 못했습니다.");
  }

  return new Map(
    ((result.data ?? []) as TemplateOverrideRow[])
      .filter((row) => isTemplateAlias(row.template_alias))
      .map((row) => [row.template_alias, row]),
  );
}

export async function renderNotificationTemplateBodyWithOverrides(type: NotificationType, values: NotificationTemplateVariables) {
  const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
  if (!spec) return null;

  const overrides = await getActiveTemplateOverrides();
  const template = overrides.get(spec.templateAlias)?.template_body || spec.draftBody;
  return fillNotificationTemplate(template, values);
}
