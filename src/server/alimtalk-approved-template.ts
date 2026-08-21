import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  fillNotificationTemplate,
  type AlimtalkTemplateAlias,
  type NotificationTemplateVariables,
} from "@/lib/notification-registry";
import { getConfiguredAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import type { NotificationType } from "@/types/domain";

export type ApprovedSsodaaTemplateButton = {
  type: "WL";
  name: string;
  linkMobile: string;
  linkPc?: string | null;
};

type ConnectedTemplateDetail = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
  buttons: ApprovedSsodaaTemplateButton[];
};

type RelayTemplateCatalogBody = {
  items?: Array<{
    alias?: AlimtalkTemplateAlias | null;
    configuredCode?: string | null;
    detail?: ConnectedTemplateDetail | null;
  }>;
  allTemplates?: ConnectedTemplateDetail[];
};

const aliasesThatMustHaveSsodaaButtons = new Set<AlimtalkTemplateAlias>([
  "booking_confirmed",
  "booking_manage_link_requested",
  "booking_time_proposed",
  "booking_rescheduled_confirmed",
  "appointment_reminder_10m",
  "visit_schedule_notice",
  "visit_reminder_notice",
  "grooming_completed",
  "revisit_notice",
]);

export function requiresApprovedSsodaaTemplate() {
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

function normalizeConnectedButton(
  button: ApprovedSsodaaTemplateButton,
): ApprovedSsodaaTemplateButton | null {
  const name = button.name?.trim();
  const linkMobile = button.linkMobile?.trim();
  if (!name || !linkMobile) return null;

  return {
    type: "WL",
    name,
    linkMobile,
    linkPc: button.linkPc?.trim() || linkMobile,
  };
}

function isApprovedAndUsableTemplate(detail: ConnectedTemplateDetail) {
  return (
    detail.inspectionStatus === "APR" ||
    detail.serviceStatus === "ACT" ||
    detail.serviceStatus === "RDY"
  );
}

async function getApprovedSsodaaTemplate(
  alias: AlimtalkTemplateAlias,
): Promise<ConnectedTemplateDetail | null> {
  const body = await getRelayTemplateCatalog();
  if (!body) return null;

  return getApprovedSsodaaTemplateFromCatalog(alias, body);
}

function getApprovedSsodaaTemplateFromCatalog(
  alias: AlimtalkTemplateAlias,
  body: RelayTemplateCatalogBody,
): ConnectedTemplateDetail | null {
  const templateCode = getConfiguredAlimtalkTemplateKey(alias)?.trim();
  if (!templateCode) return null;

  const detail =
    body.items?.find(
      (item) => item.alias === alias && item.configuredCode === templateCode,
    )?.detail ??
    body.allTemplates?.find((item) => item.templateCode === templateCode) ??
    null;

  if (!detail || !isApprovedAndUsableTemplate(detail)) return null;

  return normalizeConnectedTemplateDetail(templateCode, detail);
}

function normalizeConnectedTemplateDetail(
  templateCode: string,
  detail: ConnectedTemplateDetail,
): ConnectedTemplateDetail {
  return {
    templateCode,
    templateName: detail.templateName ?? null,
    templateContent: detail.templateContent ?? null,
    inspectionStatus: detail.inspectionStatus ?? null,
    serviceStatus: detail.serviceStatus ?? null,
    buttons: (detail.buttons ?? [])
      .map(normalizeConnectedButton)
      .filter((item): item is ApprovedSsodaaTemplateButton => Boolean(item)),
  };
}

async function getRelayTemplateCatalog(): Promise<RelayTemplateCatalogBody | null> {
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
      if (body) return body;
    } catch {
      // 다음 릴레이 주소 후보를 확인합니다.
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

function getMissingTemplateVariables(
  value: string,
  variables: NotificationTemplateVariables,
) {
  const matches = Array.from(value.matchAll(/#\{([^}]+)\}/g));
  return Array.from(
    new Set(
      matches
        .map((match) => match[1]?.trim() ?? "")
        .filter((key) => key && !variables[key]),
    ),
  );
}

function assertRenderedButtonValue(params: {
  templateTitle: string;
  buttonName: string;
  fieldLabel: string;
  sourceValue: string;
  renderedValue: string;
  variables: NotificationTemplateVariables;
}) {
  const missingVariables = getMissingTemplateVariables(
    params.sourceValue,
    params.variables,
  );
  if (missingVariables.length > 0) {
    throw new Error(
      `${params.templateTitle} 쏘다 버튼 '${params.buttonName}'의 ${params.fieldLabel}에 필요한 치환값이 없습니다: ${missingVariables.join(", ")}`,
    );
  }

  if (/#\{[^}]+\}/.test(params.renderedValue)) {
    throw new Error(
      `${params.templateTitle} 쏘다 버튼 '${params.buttonName}'의 ${params.fieldLabel}에 치환되지 않은 변수가 남아 있습니다: ${params.renderedValue}`,
    );
  }
}

export async function getApprovedSsodaaTemplateButtons(
  type: NotificationType,
  values: NotificationTemplateVariables,
): Promise<ApprovedSsodaaTemplateButton[] | null> {
  const template = await getApprovedSsodaaNotificationTemplate(type, values);
  return template?.buttons ?? null;
}

function renderApprovedTemplateButtons(params: {
  spec: (typeof ALIMTALK_NOTIFICATION_REGISTRY)[number];
  detail: ConnectedTemplateDetail;
  values: NotificationTemplateVariables;
}) {
  if (
    aliasesThatMustHaveSsodaaButtons.has(params.spec.templateAlias) &&
    params.detail.buttons.length === 0
  ) {
    throw new Error(
      `${params.spec.title} 쏘다 템플릿 버튼 정보를 확인하지 못했습니다. 쏘다에 승인된 버튼과 실제 발송 버튼이 일치해야 하므로 발송을 중단했습니다.`,
    );
  }

  return params.detail.buttons.map((button) => {
    const linkMobile = fillTemplateValue(button.linkMobile, params.values);
    const linkPc = button.linkPc
      ? fillTemplateValue(button.linkPc, params.values)
      : linkMobile;
    assertRenderedButtonValue({
      templateTitle: params.spec.title,
      buttonName: button.name,
      fieldLabel: "모바일 링크",
      sourceValue: button.linkMobile,
      renderedValue: linkMobile,
      variables: params.values,
    });
    assertRenderedButtonValue({
      templateTitle: params.spec.title,
      buttonName: button.name,
      fieldLabel: "PC 링크",
      sourceValue: button.linkPc ?? button.linkMobile,
      renderedValue: linkPc,
      variables: params.values,
    });
    return {
      ...button,
      linkMobile,
      linkPc,
    };
  });
}

export type ApprovedSsodaaNotificationTemplate = {
  type: NotificationType;
  templateAlias: AlimtalkTemplateAlias;
  templateCode: string | null;
  templateName: string | null;
  body: string;
  buttons: ApprovedSsodaaTemplateButton[] | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
  source: "ssodaa_approved" | "draft";
};

function renderApprovedSsodaaNotificationTemplate(params: {
  type: NotificationType;
  values: NotificationTemplateVariables;
  detail: ConnectedTemplateDetail | null;
}): ApprovedSsodaaNotificationTemplate | null {
  const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === params.type);
  if (!spec) return null;

  if (requiresApprovedSsodaaTemplate() && !params.detail?.templateContent) {
    throw new Error(
      `${spec.title} 쏘다 템플릿의 승인 상태와 본문을 확인하지 못해 발송을 중단했습니다.`,
    );
  }

  const template = params.detail?.templateContent || spec.draftBody;
  return {
    type: params.type,
    templateAlias: spec.templateAlias,
    templateCode:
      params.detail?.templateCode ??
      getConfiguredAlimtalkTemplateKey(spec.templateAlias)?.trim() ??
      null,
    templateName: params.detail?.templateName ?? null,
    body: fillNotificationTemplate(template, params.values),
    buttons: params.detail
      ? renderApprovedTemplateButtons({ spec, detail: params.detail, values: params.values })
      : null,
    inspectionStatus: params.detail?.inspectionStatus ?? null,
    serviceStatus: params.detail?.serviceStatus ?? null,
    source: params.detail ? "ssodaa_approved" : "draft",
  };
}

export async function getApprovedSsodaaNotificationTemplate(
  type: NotificationType,
  values: NotificationTemplateVariables,
) {
  const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
  if (!spec) return null;

  const detail = await getApprovedSsodaaTemplate(spec.templateAlias);
  return renderApprovedSsodaaNotificationTemplate({ type, values, detail });
}

export async function getApprovedSsodaaNotificationTemplates(
  types: NotificationType[],
  values: NotificationTemplateVariables,
) {
  const catalog = await getRelayTemplateCatalog();

  return types.map((type) => {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
    const detail = spec && catalog
      ? getApprovedSsodaaTemplateFromCatalog(spec.templateAlias, catalog)
      : null;
    return renderApprovedSsodaaNotificationTemplate({ type, values, detail });
  });
}

export async function renderApprovedSsodaaTemplateBody(
  type: NotificationType,
  values: NotificationTemplateVariables,
) {
  const template = await getApprovedSsodaaNotificationTemplate(type, values);
  return template?.body ?? null;
}
