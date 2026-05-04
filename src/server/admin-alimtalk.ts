import {
  ALIMTALK_NOTIFICATION_REGISTRY,
  type AlimtalkTemplateAlias,
  type AlimtalkTemplateConfigKey,
  getNotificationTitle,
} from "@/lib/notification-registry";
import { hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ChannelType, NotificationStatus, NotificationType } from "@/types/domain";

export type RelayAdminConfig = {
  relaySecret: string;
  ssodaaApiUrl: string;
  ssodaaSentListUrl: string;
  ssodaaApiKey: string;
  ssodaaTokenKey: string;
  ssodaaSenderKey: string;
} & Record<AlimtalkTemplateConfigKey, string>;

export type RelayTemplateDebugMap = Record<AlimtalkTemplateAlias, { configured: boolean; length: number }>;

export type RelaySsodaaTemplateDetail = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
};

export type RelaySsodaaTemplateItem = {
  alias: AlimtalkTemplateAlias;
  configuredCode: string;
  detail: RelaySsodaaTemplateDetail | null;
  error: string | null;
};

export type RelayTemplateCatalogResponse = {
  ok: true;
  items: RelaySsodaaTemplateItem[];
};

export type RelayAdminConfigResponse = {
  ok: true;
  config: RelayAdminConfig;
  templates: RelayTemplateDebugMap;
};

export type AppAlimtalkConfig = {
  provider: string;
  relayUrl: string;
  relaySecret: string;
  apiUrl: string;
  apiKey: string;
  tokenKey: string;
  senderKey: string;
} & Record<AlimtalkTemplateConfigKey, string>;

export type AppTemplateDraft = {
  alias: AlimtalkTemplateAlias;
  title: string;
  body: string;
};

export type AdminNotificationActivityItem = {
  id: string;
  createdAt: string;
  sentAt: string | null;
  shopId: string;
  shopName: string;
  guardianName: string | null;
  petName: string | null;
  type: NotificationType;
  title: string;
  channel: ChannelType;
  status: NotificationStatus;
  failReason: string | null;
  providerMessageId: string | null;
  recipientPhoneTail: string | null;
};

export type AdminNotificationActivity = {
  issues: AdminNotificationActivityItem[];
  recentEvents: AdminNotificationActivityItem[];
};

type NotificationRow = {
  id: string;
  shop_id: string;
  guardian_id: string | null;
  pet_id: string | null;
  type: NotificationType;
  channel: ChannelType;
  status: NotificationStatus;
  provider_message_id: string | null;
  recipient_phone: string | null;
  fail_reason: string | null;
  created_at: string;
  sent_at: string | null;
};

function getRelayAdminUrl() {
  if (!serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) {
    throw new Error("알림톡 relay 연결값이 아직 설정되어 있지 않습니다.");
  }

  const parsed = new URL(serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl);
  parsed.pathname = "/admin/config";
  parsed.search = "";
  return parsed.toString();
}

function getRelayAdminTemplatesUrl() {
  if (!serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) {
    throw new Error("알림톡 relay 연결값이 아직 설정되어 있지 않습니다.");
  }

  const parsed = new URL(serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl);
  parsed.pathname = "/admin/templates";
  parsed.search = "";
  return parsed.toString();
}

async function parseRelayResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("relay 서버 응답을 읽는 중 문제가 발생했습니다.");
    }
  }
  return text;
}

function getAppTemplateConfigValues(): Record<AlimtalkTemplateConfigKey, string> {
  return {
    templateBookingReceived: serverEnv.alimtalkTemplateBookingReceived || "",
    templateBookingConfirmed: serverEnv.alimtalkTemplateBookingConfirmed || "",
    templateBookingRejected: serverEnv.alimtalkTemplateBookingRejected || "",
    templateBookingCancelled: serverEnv.alimtalkTemplateBookingCancelled || "",
    templateBookingRescheduledConfirmed: serverEnv.alimtalkTemplateBookingRescheduledConfirmed || "",
    templateAppointmentReminder10m: serverEnv.alimtalkTemplateAppointmentReminder10m || "",
    templateGroomingStarted: serverEnv.alimtalkTemplateGroomingStarted || "",
    templateGroomingAlmostDone: serverEnv.alimtalkTemplateGroomingAlmostDone || "",
    templateGroomingCompleted: serverEnv.alimtalkTemplateGroomingCompleted || "",
    templateRevisitNotice: serverEnv.alimtalkTemplateRevisitNotice || "",
    templateBirthdayGreeting: serverEnv.alimtalkTemplateBirthdayGreeting || "",
  };
}

export async function getRelayAdminConfig() {
  const response = await fetch(getRelayAdminUrl(), {
    method: "GET",
    headers: {
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "relay 서버 설정을 불러오지 못했습니다.";
    throw new Error(message);
  }

  return body as RelayAdminConfigResponse;
}

export async function updateRelayAdminConfig(input: RelayAdminConfig) {
  const response = await fetch(getRelayAdminUrl(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "relay 서버 설정 저장에 실패했습니다.";
    throw new Error(message);
  }

  return body as RelayAdminConfigResponse;
}

export async function getRelayTemplateCatalog() {
  const response = await fetch(getRelayAdminTemplatesUrl(), {
    method: "GET",
    headers: {
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "알림톡 relay 템플릿 정보를 불러오지 못했습니다.";
    throw new Error(message);
  }

  return body as RelayTemplateCatalogResponse;
}

export function getAppAlimtalkConfig(): AppAlimtalkConfig {
  return {
    provider: serverEnv.alimtalkProvider || "",
    relayUrl: serverEnv.alimtalkRelayUrl || "",
    relaySecret: serverEnv.alimtalkRelaySecret || "",
    apiUrl: serverEnv.alimtalkApiUrl || "",
    apiKey: serverEnv.alimtalkApiKey || "",
    tokenKey: serverEnv.alimtalkTokenKey || "",
    senderKey: serverEnv.alimtalkSenderKey || "",
    ...getAppTemplateConfigValues(),
  };
}

export function getAppTemplateDrafts(): AppTemplateDraft[] {
  return ALIMTALK_NOTIFICATION_REGISTRY.map((item) => ({
    alias: item.templateAlias,
    title: item.title,
    body: item.draftBody,
  }));
}

function phoneTail(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  return normalized ? normalized.slice(-4) : null;
}

export async function getAdminNotificationActivity(limit = 30): Promise<AdminNotificationActivity> {
  if (!hasSupabaseServerEnv()) {
    return { issues: [], recentEvents: [] };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { issues: [], recentEvents: [] };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, shop_id, guardian_id, pet_id, type, channel, status, provider_message_id, recipient_phone, fail_reason, created_at, sent_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("최근 알림 이력을 불러오지 못했습니다.");
  }

  const rows = (data ?? []) as NotificationRow[];
  if (!rows.length) {
    return { issues: [], recentEvents: [] };
  }

  const shopIds = [...new Set(rows.map((row) => row.shop_id))];
  const guardianIds = [...new Set(rows.map((row) => row.guardian_id).filter(Boolean))] as string[];
  const petIds = [...new Set(rows.map((row) => row.pet_id).filter(Boolean))] as string[];

  const [shopsRes, guardiansRes, petsRes] = await Promise.all([
    supabase.from("shops").select("id, name").in("id", shopIds),
    guardianIds.length
      ? supabase.from("guardians").select("id, name").in("id", guardianIds)
      : Promise.resolve({ data: [], error: null }),
    petIds.length
      ? supabase.from("pets").select("id, name").in("id", petIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (shopsRes.error || guardiansRes.error || petsRes.error) {
    throw new Error("알림 이력의 연결 데이터를 불러오지 못했습니다.");
  }

  const shopMap = new Map((shopsRes.data ?? []).map((item) => [item.id as string, item.name as string]));
  const guardianMap = new Map((guardiansRes.data ?? []).map((item) => [item.id as string, item.name as string]));
  const petMap = new Map((petsRes.data ?? []).map((item) => [item.id as string, item.name as string]));

  const items = rows.map<AdminNotificationActivityItem>((row) => ({
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    shopId: row.shop_id,
    shopName: shopMap.get(row.shop_id) ?? row.shop_id,
    guardianName: row.guardian_id ? guardianMap.get(row.guardian_id) ?? null : null,
    petName: row.pet_id ? petMap.get(row.pet_id) ?? null : null,
    type: row.type,
    title: getNotificationTitle(row.type),
    channel: row.channel,
    status: row.status,
    failReason: row.fail_reason ?? null,
    providerMessageId: row.provider_message_id ?? null,
    recipientPhoneTail: phoneTail(row.recipient_phone),
  }));

  return {
    issues: items.filter((item) => item.status === "failed" || item.status === "skipped").slice(0, 12),
    recentEvents: items.filter((item) => item.channel !== "mock").slice(0, 20),
  };
}
