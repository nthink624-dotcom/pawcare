import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  fillNotificationTemplate,
  type AlimtalkTemplateAlias,
  type NotificationTemplateVariables,
  type NotificationVariableBindings,
  bindNotificationTemplateVariables,
  validateNotificationVariableBindings,
} from "@/lib/notification-registry";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";
import { DEPOSIT_ALIMTALK_REVIEW_CONTRACTS } from "@petmanager/shared/contracts/deposit-alimtalk-review";
import { isSameBookingManageLink } from "@petmanager/shared/lib/booking-manage-link";
import { getConfiguredAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { matchesShopTemplateSnapshot, shopTemplateInspectionState } from "@/server/shop-alimtalk-template-contract";
import type { NotificationType } from "@/types/domain";
import { assertAlimtalkTemplateAccess, readActiveAlimtalkCodes, readPlatformAlimtalkCodes } from "@/server/alimtalk-template-ownership";
import { readPersistedAlimtalkDetails, persistAlimtalkDetails } from "@/server/alimtalk-provider-catalog-cache";
import { readShopAlimtalkSelections, type ShopAlimtalkSelection } from "@/server/shop-alimtalk-selection-store";

export type ApprovedSsodaaTemplateButton = {
  type: "WL";
  name: string;
  linkMobile: string;
  linkPc?: string | null;
};

export type ConnectedTemplateDetail = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
  buttons: ApprovedSsodaaTemplateButton[];
  variableBindings?: NotificationVariableBindings;
};

export type RelayTemplateCatalogBody = {
  items?: Array<{
    alias?: AlimtalkTemplateAlias | null;
    configuredCode?: string | null;
    detail?: ConnectedTemplateDetail | null;
  }>;
  allTemplates?: ConnectedTemplateDetail[];
  providerStatus?: {
    connected: boolean;
    checkedAt: string | null;
    templateCount: number;
  };
};

const aliasesThatMustHaveSsodaaButtons = new Set<AlimtalkTemplateAlias>([
  "booking_deposit_request",
  "booking_deposit_cancelled",
  "booking_deposit_expired",
  "booking_deposit_refunded",
  "booking_consent_request",
  "booking_confirmed",
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

export function isApprovedAndUsableTemplate(detail: ConnectedTemplateDetail, _alias?: AlimtalkTemplateAlias) {
  const inspectionStatus = detail.inspectionStatus?.toUpperCase() ?? "";
  const serviceStatus = detail.serviceStatus?.toUpperCase() ?? "";

  // Official /service/api/kakaoapi: R=대기, A=정상, S=중지 (template/stop).
  // A Kakao-approved but stopped template must not be treated as sendable.
  return inspectionStatus === "APR"
    && ["ACT", "RDY", "R", "A", "ACTIVE", "READY"].includes(serviceStatus)
    && Array.isArray(detail.buttons) && detail.buttons.every(button=>button.type==="WL" && Boolean(button.name?.trim()) && Boolean(button.linkMobile?.trim()));
}

function normalizeTemplateText(value: string) {
  return value.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

export function hasApprovedBookingConsentTemplateContract(detail: ConnectedTemplateDetail) {
  const contract = APPROVED_ALIMTALK_CONTRACTS.booking_consent_request;
  return normalizeTemplateText(detail.templateContent ?? "") === normalizeTemplateText(contract.body)
    && detail.buttons.length === 1
    && detail.buttons[0]?.type === "WL"
    && detail.buttons[0]?.name.trim() === contract.button;
}

function validateTemplateContract(alias: AlimtalkTemplateAlias, detail: ConnectedTemplateDetail, _shopTemplateCode?: string | null) {
  const depositContract = DEPOSIT_ALIMTALK_REVIEW_CONTRACTS[alias as keyof typeof DEPOSIT_ALIMTALK_REVIEW_CONTRACTS];
  // The active DB connection verifies provider identity; the fixed contract protects
  // mandatory wording/buttons, not a mutable provider name or versioned code.
  if (depositContract && !hasDepositOperationalTemplateContract(alias, detail)) {
    throw new Error("예약금 요청 알림톡의 승인 본문 또는 버튼이 등록된 계약과 달라 발송을 중단했습니다.");
  }
  if (alias === "booking_consent_request" && !hasApprovedBookingConsentTemplateContract(detail)) {
    throw new Error("동의서 요청 알림톡의 승인 본문 또는 버튼이 등록된 계약과 달라 발송을 중단했습니다.");
  }
}

export function validateAlimtalkTemplateForAlias(alias: AlimtalkTemplateAlias, detail: ConnectedTemplateDetail, bindings: NotificationVariableBindings = {}) {
  if (!isApprovedAndUsableTemplate(detail) || !detail.templateContent?.trim()) throw new Error("승인되어 사용 가능한 템플릿만 연결할 수 있습니다.");
  if (aliasesThatMustHaveSsodaaButtons.has(alias) && !detail.buttons.length) throw new Error("이 알림에 필요한 승인 버튼이 없습니다.");
  if ((alias in DEPOSIT_ALIMTALK_REVIEW_CONTRACTS || alias === "booking_consent_request") && Object.entries(bindings).some(([key,value])=>key!==value)) throw new Error("예약금·동의서의 필수 자동 입력 항목은 변경할 수 없습니다.");
  validateTemplateContract(alias, detail);
  validateNotificationVariableBindings([detail.templateContent, ...detail.buttons.flatMap(button => [button.name, button.linkMobile, button.linkPc ?? ""])], bindings);
}

export function hasApprovedBookingDepositTemplateContract(detail: ConnectedTemplateDetail) {
  return hasDepositOperationalTemplateContract("booking_deposit_request", detail);
}

export function hasDepositOperationalTemplateContract(alias: string, detail: ConnectedTemplateDetail) {
  const contract = DEPOSIT_ALIMTALK_REVIEW_CONTRACTS[alias as keyof typeof DEPOSIT_ALIMTALK_REVIEW_CONTRACTS];
  if (!contract) return false;
  return normalizeTemplateText(detail.templateContent ?? "") === normalizeTemplateText(contract.body)
    && detail.buttons.length === 1 && detail.buttons[0]?.type === "WL"
    && detail.buttons[0]?.name.trim() === contract.button;
}

async function getApprovedSsodaaTemplate(
  alias: AlimtalkTemplateAlias,
  customTemplateCode?: string | null,
  shopId?: string,
): Promise<ConnectedTemplateDetail | null> {
  if (customTemplateCode) await assertAlimtalkTemplateAccess(customTemplateCode, shopId);
  const body = await getRelayTemplateCatalog(customTemplateCode ? [customTemplateCode] : undefined);
  if (!body) return null;

  if (customTemplateCode) {
    const detail = body.allTemplates?.find((item) => item.templateCode === customTemplateCode) ?? null;
    if (!detail || !isApprovedAndUsableTemplate(detail)) return null;
    const normalized = normalizeConnectedTemplateDetail(customTemplateCode, detail);
    validateTemplateContract(alias, normalized, customTemplateCode);
    return normalized;
  }

  const detail = await getApprovedSsodaaTemplateFromCatalog(alias, body, undefined, shopId);
  if (detail) validateTemplateContract(alias, detail);
  return detail;
}

export async function getApprovedSsodaaTemplateButtonDefaults(
  aliases: AlimtalkTemplateAlias[],
  shopId?: string,
) {
  const details = await getApprovedSsodaaTemplateDetails(aliases, shopId);
  return Object.fromEntries(aliases.map(alias => [alias, details[alias]?.buttons.map(button => ({ buttonName: button.name, linkMobile: button.linkMobile })) ?? []])) as Partial<Record<AlimtalkTemplateAlias, Array<{ buttonName: string; linkMobile: string }>>>;
}

async function getShopApprovedTemplateCodes(shopId: string | undefined, aliases: AlimtalkTemplateAlias[], suppliedCatalog?: RelayTemplateCatalogBody) {
  if (!shopId || !aliases.length) return new Map<AlimtalkTemplateAlias, string>();
  const admin = getSupabaseAdmin();
  if (!admin) return new Map<AlimtalkTemplateAlias, string>();
  const result = await admin
    .from("shop_alimtalk_template_requests")
    .select("id,template_alias,template_code,template_content,template_buttons,inspection_status,service_status,is_current")
    .eq("shop_id", shopId)
    .in("template_alias", aliases)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error("매장 알림 문구의 적용 상태를 확인하지 못했습니다.");

  const rows = result.data ?? [];
  if (!rows.length) return new Map<AlimtalkTemplateAlias, string>();
  const catalog = suppliedCatalog ?? await getRelayTemplateCatalog(rows.filter(row => row.is_current || ["submitting", "requested", "reviewing", "unknown"].includes(row.inspection_status)).map(row => row.template_code));
  if (!catalog) throw new Error("매장 알림 문구의 승인 상태를 확인하지 못했습니다.");
  const pendingRows = rows.filter((row) => ["submitting", "requested", "reviewing", "unknown"].includes(row.inspection_status));
  if (pendingRows.length > 0) {
      await Promise.all(pendingRows.map(async (row) => {
        const provider = catalog.allTemplates?.find((item) => item.templateCode === row.template_code);
        if (!provider) return;
        const serviceStatus = String(provider.serviceStatus ?? "").toUpperCase();
        const nextStatus = shopTemplateInspectionState(provider.inspectionStatus);
        if (nextStatus === "approved" && (!isApprovedAndUsableTemplate(provider) || !matchesShopTemplateSnapshot(row, provider))) return;
        if (nextStatus !== "unknown" && nextStatus !== row.inspection_status) {
          const saved = await admin.from("shop_alimtalk_template_requests").update({
            inspection_status: nextStatus,
            service_status: serviceStatus.toLowerCase() || "unknown",
            provider_checked_at: new Date().toISOString(),
          }).eq("id", row.id).eq("shop_id", shopId).eq("inspection_status", row.inspection_status).select("id").maybeSingle();
          if (saved.error || !saved.data) throw new Error("알림 문구의 승인 결과를 저장하지 못했습니다.");
          row.inspection_status = nextStatus;
        }
      }));
  }

  const codes = new Map<AlimtalkTemplateAlias, string>();
  for (const alias of aliases) {
    const scoped = rows.filter(row => row.template_alias === alias);
    const current = scoped.find(row => row.is_current);
    // Approval makes a request selectable, not active. Preserve the existing
    // legacy marker; new owner choices use the explicit selection API.
    const selected = current;
    if (!selected) continue;
    const provider = catalog.allTemplates?.find(item => item.templateCode === selected.template_code);
    if (selected.inspection_status !== "approved" || !provider || !isApprovedAndUsableTemplate(provider) || !matchesShopTemplateSnapshot(selected, provider)) throw new Error("사용 중인 매장 알림 문구의 승인 원문 또는 버튼을 확인하지 못해 발송을 중단했습니다.");
    await assertAlimtalkTemplateAccess(selected.template_code, shopId);
    codes.set(alias, selected.template_code);
  }
  return codes;
}

export async function getApprovedSsodaaTemplateFromCatalog(
  alias: AlimtalkTemplateAlias,
  body: RelayTemplateCatalogBody,
  customTemplateCode?: string | null,
  shopId?: string,
): Promise<ConnectedTemplateDetail | null> {
  if (customTemplateCode) {
    await assertAlimtalkTemplateAccess(customTemplateCode, shopId);
    const detail = body.allTemplates?.find((item) => item.templateCode === customTemplateCode) ?? null;
    if (!detail || !isApprovedAndUsableTemplate(detail)) return null;
    return normalizeConnectedTemplateDetail(customTemplateCode, detail);
  }

  const mapping = await getPlatformMappedTemplate(alias);
  if (!mapping?.provider_template_code) return null;
  const detail = body.allTemplates?.find(item => item.templateCode === mapping.provider_template_code);
  if (!detail || !isApprovedAndUsableTemplate(detail)) return null;
  if (!matchesShopTemplateSnapshot({template_code:mapping.provider_template_code,template_content:mapping.template_content,template_buttons:mapping.buttons},detail)) throw new Error("현재 연결과 쏘다 승인 본문·버튼이 달라 발송을 중단했습니다.");
  const bindings = (mapping.variable_bindings ?? {}) as NotificationVariableBindings;
  validateAlimtalkTemplateForAlias(alias, detail, bindings);
  return { ...normalizeConnectedTemplateDetail(mapping.provider_template_code, detail), variableBindings: bindings };
}

export async function getApprovedSsodaaTemplateDetails(
  aliases: AlimtalkTemplateAlias[],
  shopId?: string,
  suppliedCatalog?: RelayTemplateCatalogBody,
) {
  const selected = await readShopAlimtalkSelections(shopId, aliases);
  const [catalog, customCodes] = await Promise.all([
    suppliedCatalog ?? getShopRelayTemplateCatalog(shopId),
    getShopApprovedTemplateCodes(shopId, aliases.filter(alias => !selected.has(alias)), suppliedCatalog),
  ]);
  if (!catalog) return {} as Partial<Record<AlimtalkTemplateAlias, ConnectedTemplateDetail>>;

  const entries = await Promise.all(aliases.map(async (alias) => {
    if (selected.has(alias)) return [alias, resolveShopSelectedTemplate(alias, selected.get(alias)!, catalog)] as const;
    const detail = await getApprovedSsodaaTemplateFromCatalog(alias, catalog, customCodes.get(alias), shopId);
    if (detail) {
      try { validateTemplateContract(alias, detail, customCodes.get(alias)); }
      catch { return [alias, null] as const; }
    }
    return [alias, detail] as const;
  }));
  return Object.fromEntries(
    entries.filter((entry): entry is readonly [AlimtalkTemplateAlias, ConnectedTemplateDetail] => Boolean(entry[1])),
  ) as Partial<Record<AlimtalkTemplateAlias, ConnectedTemplateDetail>>;
}

export function resolveShopSelectedTemplate(alias: AlimtalkTemplateAlias, selected: ShopAlimtalkSelection, catalog: RelayTemplateCatalogBody | null) {
  const detail = catalog?.allTemplates?.find(item => item.templateCode === selected.template_code);
  if (!detail || !matchesShopTemplateSnapshot(selected, detail)) throw new Error("선택한 알림톡의 승인 상태·본문·버튼을 확인하지 못했습니다. 예약 정책에서 다른 승인 문구를 선택해 주세요.");
  validateAlimtalkTemplateForAlias(alias, detail, selected.variable_bindings);
  return { ...normalizeConnectedTemplateDetail(selected.template_code, detail), variableBindings: selected.variable_bindings };
}

async function getPlatformMappedTemplate(alias: AlimtalkTemplateAlias) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const result = await admin
    .from("platform_alimtalk_templates")
    .select("id,provider_template_code,template_content,buttons,variable_bindings,updated_at")
    .eq("provider", "ssodaa")
    .eq("template_alias", alias)
    .eq("inspection_status", "approved")
    .eq("service_status", "active")
    .maybeSingle();
  if (result.error) {
    throw new Error("예약 확정 템플릿 설정을 확인하지 못했습니다.");
  }
  if (result.data) await assertAlimtalkTemplateAccess(result.data.provider_template_code, undefined, true);
  return result.data ?? null;
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

export async function getShopRelayTemplateCatalog(shopId?: string) {
  const [own, platform] = await Promise.all([shopId ? readActiveAlimtalkCodes([shopId]) : [], readPlatformAlimtalkCodes()]);
  return getRelayTemplateCatalog([...platform, ...own.map(row => row.template_code)]);
}

export async function getRelayTemplateCatalog(codes?: readonly string[], discover = false): Promise<RelayTemplateCatalogBody | null> {
  if (!discover && codes === undefined) codes = await readPlatformAlimtalkCodes();
  if (!discover && !codes?.length) return { allTemplates: [] };
  if (codes && codes.length > 100) {
    const combined: ConnectedTemplateDetail[] = [];
    const unique = [...new Set(codes)];
    for (let index = 0; index < unique.length; index += 100) {
      const batch = await getRelayTemplateCatalog(unique.slice(index, index + 100));
      if (!batch?.allTemplates) return null;
      combined.push(...batch.allTemplates);
    }
    return { allTemplates: combined };
  }
  const requested = codes ? [...new Set(codes)] : undefined;
  const cached = requested ? await readPersistedAlimtalkDetails(requested) : new Map<string, ConnectedTemplateDetail>();
  const missing = requested?.filter(code => !cached.has(code));
  if (requested && !missing?.length) return { allTemplates: [...cached.values()] };
  const urls = getRelayAdminUrlCandidates("/admin/templates");
  if (!urls.length) return null;

  for (const url of urls) {
    try {
      const target = new URL(url);
      if (missing?.length) target.searchParams.set("codes", missing.join(","));
      const checkedAt = Date.now();
      const response = await fetch(target, {
        method: "GET",
        headers: {
          "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
        },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const body = (await parseJsonResponse(response)) as RelayTemplateCatalogBody | null;
      if (body) {
        if (!requested) return body; // Explicit administrator discovery only.
        if (!body.allTemplates) return null;
        const wanted = new Set(missing);
        const fresh = body.allTemplates.filter(row => wanted.has(row.templateCode));
        await persistAlimtalkDetails(fresh, checkedAt);
        return { ...body, allTemplates: [...cached.values(), ...fresh] };
      }
    } catch {
      // 다음 릴레이 주소 후보를 확인합니다.
    }
  }

  return null;
}

function fillTemplateValue(value: string, variables: NotificationTemplateVariables) {
  return value.replace(/#\{([^{}]+)\}/g,(token,key:string)=>variables[key.trim()] ?? token);
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
    const name = fillTemplateValue(button.name, params.values);
    const linkMobile = fillTemplateValue(button.linkMobile, params.values);
    const linkPc = button.linkPc
      ? fillTemplateValue(button.linkPc, params.values)
      : linkMobile;
    assertRenderedButtonValue({templateTitle:params.spec.title,buttonName:button.name,fieldLabel:"버튼 이름",sourceValue:button.name,renderedValue:name,variables:params.values});
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
    if (params.spec.templateAlias === "booking_consent_request" || params.spec.templateAlias in DEPOSIT_ALIMTALK_REVIEW_CONTRACTS) {
      const bookingManageUrl = params.values["예약 확인 링크"]?.trim();
      if (!bookingManageUrl || !isSameBookingManageLink(linkMobile, bookingManageUrl) || !isSameBookingManageLink(linkPc, bookingManageUrl)) {
        throw new Error("요청 버튼이 해당 예약의 보호자 확인 링크와 일치하지 않아 발송을 중단했습니다.");
      }
    }
    return {
      ...button,
      name,
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
  templateAlias?: string | null;
  values: NotificationTemplateVariables;
  detail: ConnectedTemplateDetail | null;
}): ApprovedSsodaaNotificationTemplate | null {
  const spec = params.templateAlias
    ? ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.templateAlias === params.templateAlias)
    : ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === params.type);
  if (!spec) return null;

  if (requiresApprovedSsodaaTemplate() && !params.detail?.templateContent) {
    throw new Error(
      `${spec.title} 쏘다 템플릿의 승인 상태와 본문을 확인하지 못해 발송을 중단했습니다.`,
    );
  }

  const template = params.detail?.templateContent || spec.draftBody;
  const values = params.detail ? bindNotificationTemplateVariables(
    [template, ...params.detail.buttons.flatMap(button => [button.name, button.linkMobile, button.linkPc ?? ""])],
    params.values, params.detail.variableBindings,
  ) : params.values;
  const body = template.replace(/#\{([^{}]+)\}/g, (token, key: string) => values[key.trim()] ?? token);
  if (params.detail && /#\{[^}]*\}/.test(body)) throw new Error("치환되지 않은 알림 변수가 있어 발송을 중단했습니다.");
  return {
    type: params.type,
    templateAlias: spec.templateAlias,
    templateCode:
      params.detail?.templateCode ??
      getConfiguredAlimtalkTemplateKey(spec.templateAlias)?.trim() ??
      null,
    templateName: params.detail?.templateName ?? null,
    body,
    buttons: params.detail
      ? renderApprovedTemplateButtons({ spec, detail: params.detail, values })
      : null,
    inspectionStatus: params.detail?.inspectionStatus ?? null,
    serviceStatus: params.detail?.serviceStatus ?? null,
    source: params.detail ? "ssodaa_approved" : "draft",
  };
}

export async function getApprovedSsodaaNotificationTemplate(
  type: NotificationType,
  values: NotificationTemplateVariables,
  templateAlias?: string | null,
  shopId?: string,
) {
  const spec = templateAlias
    ? ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.templateAlias === templateAlias)
    : ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
  if (!spec) return null;

  const selected = await readShopAlimtalkSelections(shopId, [spec.templateAlias]);
  if (selected.has(spec.templateAlias)) {
    const detail = resolveShopSelectedTemplate(spec.templateAlias, selected.get(spec.templateAlias)!, await getRelayTemplateCatalog([selected.get(spec.templateAlias)!.template_code]));
    return renderApprovedSsodaaNotificationTemplate({ type, templateAlias: spec.templateAlias, values, detail });
  }
  const customCodes = await getShopApprovedTemplateCodes(shopId, [spec.templateAlias]);
  const detail = await getApprovedSsodaaTemplate(spec.templateAlias, customCodes.get(spec.templateAlias), shopId);
  return renderApprovedSsodaaNotificationTemplate({ type, templateAlias: spec.templateAlias, values, detail });
}

export async function getApprovedSsodaaNotificationTemplates(
  types: NotificationType[],
  values: NotificationTemplateVariables,
  shopId?: string,
) {
  const aliases = Array.from(new Set(types.map(type => ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.type === type)?.templateAlias).filter((alias): alias is AlimtalkTemplateAlias => Boolean(alias))));
  const selected = await readShopAlimtalkSelections(shopId, aliases);
  const [catalog, customCodes] = await Promise.all([
    getShopRelayTemplateCatalog(shopId),
    getShopApprovedTemplateCodes(
      shopId,
      aliases.filter(alias => !selected.has(alias)),
    ),
  ]);

  return Promise.all(types.map(async (type) => {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.type === type);
    if (spec && selected.has(spec.templateAlias)) {
      const detail = resolveShopSelectedTemplate(spec.templateAlias, selected.get(spec.templateAlias)!, catalog);
      return renderApprovedSsodaaNotificationTemplate({ type, templateAlias: spec.templateAlias, values, detail });
    }
    const customCode = spec ? customCodes.get(spec.templateAlias) : undefined;
    const detail = spec && catalog
      ? customCode
        ? catalog.allTemplates?.find((item) => item.templateCode === customCode && isApprovedAndUsableTemplate(item)) ?? null
        : await getApprovedSsodaaTemplateFromCatalog(spec.templateAlias, catalog, undefined, shopId)
      : null;
    if (detail && spec) validateTemplateContract(spec.templateAlias, detail, customCode);
    // A preview is a list of independently available templates. Keep an unavailable
    // approval out of the list instead of failing every other preview in the response.
    // The single-template resolver used by dispatch still throws and fails closed.
    if (requiresApprovedSsodaaTemplate() && !detail?.templateContent) return null;
    return renderApprovedSsodaaNotificationTemplate({ type, values, detail });
  }));
}

export async function renderApprovedSsodaaTemplateBody(
  type: NotificationType,
  values: NotificationTemplateVariables,
) {
  const template = await getApprovedSsodaaNotificationTemplate(type, values);
  return template?.body ?? null;
}
