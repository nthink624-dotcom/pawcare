import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import dotenv from "dotenv";

import express from "express";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const relayEnvFilePath = path.resolve(process.cwd(), ".env");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(currentDirPath, "../.env"), override: false });

type RelayConfig = {
  port: number;
  relaySecret: string;
  ssodaaApiUrl: string;
  ssodaaSentListUrl: string;
  ssodaaApiKey: string;
  ssodaaTokenKey: string;
  ssodaaSenderKey: string;
  templateBookingReceived: string;
  templateBookingConfirmed: string;
  templateBookingRejected: string;
  templateBookingCancelled: string;
  templateBookingRescheduledConfirmed: string;
  templateAppointmentReminder10m: string;
  templateGroomingStarted: string;
  templateGroomingAlmostDone: string;
  templateGroomingCompleted: string;
  templateRevisitNotice: string;
  templateBirthdayGreeting: string;
};

const relayEnvKeys = [
  "PORT",
  "RELAY_SECRET",
  "SSODAA_API_URL",
  "SSODAA_SENT_LIST_URL",
  "SSODAA_API_KEY",
  "SSODAA_TOKEN_KEY",
  "SSODAA_SENDER_KEY",
  "ALIMTALK_TEMPLATE_BOOKING_RECEIVED",
  "ALIMTALK_TEMPLATE_BOOKING_CONFIRMED",
  "ALIMTALK_TEMPLATE_BOOKING_REJECTED",
  "ALIMTALK_TEMPLATE_BOOKING_CANCELLED",
  "ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED",
  "ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M",
  "ALIMTALK_TEMPLATE_GROOMING_STARTED",
  "ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE",
  "ALIMTALK_TEMPLATE_GROOMING_COMPLETED",
  "ALIMTALK_TEMPLATE_REVISIT_NOTICE",
  "ALIMTALK_TEMPLATE_BIRTHDAY_GREETING",
] as const;

type RelayEnvKey = (typeof relayEnvKeys)[number];

function loadRelayConfig(): RelayConfig {
  return {
    port: Number(process.env.PORT || 4010),
    relaySecret: process.env.RELAY_SECRET || "",
    ssodaaApiUrl: process.env.SSODAA_API_URL || "https://apis.ssodaa.com/kakao/send/alimtalk",
    ssodaaSentListUrl: process.env.SSODAA_SENT_LIST_URL || "https://apis.ssodaa.com/kakao/alimtalk/sent/list",
    ssodaaApiKey: process.env.SSODAA_API_KEY || "",
    ssodaaTokenKey: process.env.SSODAA_TOKEN_KEY || "",
    ssodaaSenderKey: process.env.SSODAA_SENDER_KEY || "",
    templateBookingReceived: process.env.ALIMTALK_TEMPLATE_BOOKING_RECEIVED || "",
    templateBookingConfirmed: process.env.ALIMTALK_TEMPLATE_BOOKING_CONFIRMED || "",
    templateBookingRejected: process.env.ALIMTALK_TEMPLATE_BOOKING_REJECTED || "",
    templateBookingCancelled: process.env.ALIMTALK_TEMPLATE_BOOKING_CANCELLED || "",
    templateBookingRescheduledConfirmed: process.env.ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED || "",
    templateAppointmentReminder10m: process.env.ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M || "",
    templateGroomingStarted: process.env.ALIMTALK_TEMPLATE_GROOMING_STARTED || "",
    templateGroomingAlmostDone: process.env.ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE || "",
    templateGroomingCompleted: process.env.ALIMTALK_TEMPLATE_GROOMING_COMPLETED || "",
    templateRevisitNotice: process.env.ALIMTALK_TEMPLATE_REVISIT_NOTICE || "",
    templateBirthdayGreeting: process.env.ALIMTALK_TEMPLATE_BIRTHDAY_GREETING || "",
  };
}

let env = loadRelayConfig();

function getRelayConfigPayload() {
  return {
    relaySecret: env.relaySecret,
    ssodaaApiUrl: env.ssodaaApiUrl,
    ssodaaSentListUrl: env.ssodaaSentListUrl,
    ssodaaApiKey: env.ssodaaApiKey,
    ssodaaTokenKey: env.ssodaaTokenKey,
    ssodaaSenderKey: env.ssodaaSenderKey,
    templateBookingReceived: env.templateBookingReceived,
    templateBookingConfirmed: env.templateBookingConfirmed,
    templateBookingRejected: env.templateBookingRejected,
    templateBookingCancelled: env.templateBookingCancelled,
    templateBookingRescheduledConfirmed: env.templateBookingRescheduledConfirmed,
    templateAppointmentReminder10m: env.templateAppointmentReminder10m,
    templateGroomingStarted: env.templateGroomingStarted,
    templateGroomingAlmostDone: env.templateGroomingAlmostDone,
    templateGroomingCompleted: env.templateGroomingCompleted,
    templateRevisitNotice: env.templateRevisitNotice,
    templateBirthdayGreeting: env.templateBirthdayGreeting,
  };
}

function serializeEnvValue(value: string) {
  return JSON.stringify((value ?? "").replace(/\r?\n/g, " ").trim());
}

function toRelayEnvEntries(config: ReturnType<typeof getRelayConfigPayload>): Record<RelayEnvKey, string> {
  return {
    PORT: String(env.port),
    RELAY_SECRET: config.relaySecret,
    SSODAA_API_URL: config.ssodaaApiUrl,
    SSODAA_SENT_LIST_URL: config.ssodaaSentListUrl,
    SSODAA_API_KEY: config.ssodaaApiKey,
    SSODAA_TOKEN_KEY: config.ssodaaTokenKey,
    SSODAA_SENDER_KEY: config.ssodaaSenderKey,
    ALIMTALK_TEMPLATE_BOOKING_RECEIVED: config.templateBookingReceived,
    ALIMTALK_TEMPLATE_BOOKING_CONFIRMED: config.templateBookingConfirmed,
    ALIMTALK_TEMPLATE_BOOKING_REJECTED: config.templateBookingRejected,
    ALIMTALK_TEMPLATE_BOOKING_CANCELLED: config.templateBookingCancelled,
    ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED: config.templateBookingRescheduledConfirmed,
    ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M: config.templateAppointmentReminder10m,
    ALIMTALK_TEMPLATE_GROOMING_STARTED: config.templateGroomingStarted,
    ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE: config.templateGroomingAlmostDone,
    ALIMTALK_TEMPLATE_GROOMING_COMPLETED: config.templateGroomingCompleted,
    ALIMTALK_TEMPLATE_REVISIT_NOTICE: config.templateRevisitNotice,
    ALIMTALK_TEMPLATE_BIRTHDAY_GREETING: config.templateBirthdayGreeting,
  };
}

function persistRelayConfig(config: ReturnType<typeof getRelayConfigPayload>) {
  const nextEntries = toRelayEnvEntries(config);
  const existingLines = fs.existsSync(relayEnvFilePath)
    ? fs.readFileSync(relayEnvFilePath, "utf8").split(/\r?\n/)
    : [];
  const applied = new Set<RelayEnvKey>();
  const nextLines = existingLines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return line;

    const key = match[1] as RelayEnvKey;
    if (!relayEnvKeys.includes(key)) return line;

    applied.add(key);
    return `${key}=${serializeEnvValue(nextEntries[key])}`;
  });

  for (const key of relayEnvKeys) {
    if (!applied.has(key)) {
      nextLines.push(`${key}=${serializeEnvValue(nextEntries[key])}`);
    }
  }

  fs.writeFileSync(relayEnvFilePath, `${nextLines.filter((line) => line !== undefined).join("\n").trimEnd()}\n`, "utf8");
}

function applyRelayConfig(config: ReturnType<typeof getRelayConfigPayload>) {
  const nextEntries = toRelayEnvEntries(config);
  for (const [key, value] of Object.entries(nextEntries)) {
    process.env[key] = value;
  }
  env = loadRelayConfig();
}

const requestSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
  templateAlias: z.string().min(1).optional().nullable(),
  templateKey: z.string().min(1).optional().nullable(),
  templateType: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
  buttons: z
    .array(
      z.object({
        type: z.literal("WL"),
        name: z.string().trim().min(1).max(14),
        linkMobile: z.string().trim().min(1).max(500),
        linkPc: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .max(5)
    .optional()
    .nullable(),
});

const templateCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "templateCode must contain only letters, numbers, underscore, or hyphen.");

const templateCodeCheckSchema = z.object({
  templateCode: templateCodeSchema,
});

const relayTemplateConfigKeys = [
  "templateBookingReceived",
  "templateBookingConfirmed",
  "templateBookingRejected",
  "templateBookingCancelled",
  "templateBookingRescheduledConfirmed",
  "templateAppointmentReminder10m",
  "templateGroomingStarted",
  "templateGroomingAlmostDone",
  "templateGroomingCompleted",
  "templateRevisitNotice",
  "templateBirthdayGreeting",
] as const;

const templateButtonSchema = z.object({
  buttonType: z.literal("WL").default("WL"),
  buttonName: z.string().trim().min(1).max(14),
  linkMobile: z.string().trim().min(1).max(500),
  linkPc: z.string().trim().max(500).optional().nullable(),
});

const templateRegisterSchema = z.object({
  templateCode: templateCodeSchema,
  templateName: z.string().trim().min(1).max(100),
  templateContent: z.string().trim().min(1).max(1000),
  categoryCode: z.string().trim().min(1),
  templateMessageType: z.enum(["BA", "EX", "AD", "MI"]).default("BA"),
  templateEmphasizeType: z.enum(["NONE", "TEXT", "IMAGE", "ITEM_LIST"]).default("NONE"),
  templateExtra: z.string().trim().optional().nullable(),
  templateAd: z.string().trim().optional().nullable(),
  templateTitle: z.string().trim().optional().nullable(),
  templateSubtitle: z.string().trim().optional().nullable(),
  comment: z.string().trim().max(500).optional().nullable(),
  requestReview: z.boolean().default(true),
  templateConfigKey: z.enum(relayTemplateConfigKeys).optional().nullable(),
  templateButtons: z.array(templateButtonSchema).max(5).optional().nullable(),
});

const adminConfigSchema = z.object({
  relaySecret: z.string(),
  ssodaaApiUrl: z.string().url(),
  ssodaaSentListUrl: z.string().url(),
  ssodaaApiKey: z.string(),
  ssodaaTokenKey: z.string(),
  ssodaaSenderKey: z.string(),
  templateBookingReceived: z.string(),
  templateBookingConfirmed: z.string(),
  templateBookingRejected: z.string(),
  templateBookingCancelled: z.string(),
  templateBookingRescheduledConfirmed: z.string(),
  templateAppointmentReminder10m: z.string(),
  templateGroomingStarted: z.string(),
  templateGroomingAlmostDone: z.string(),
  templateGroomingCompleted: z.string(),
  templateRevisitNotice: z.string(),
  templateBirthdayGreeting: z.string(),
});

const sentListLookupSchema = z.object({
  destPhone: z.string().min(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  message: z.string().optional().nullable(),
  providerMessageId: z.string().optional().nullable(),
});

const templateAliases = [
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
] as const;

type TemplateAlias = (typeof templateAliases)[number];
type RelayTemplateConfigKey = (typeof relayTemplateConfigKeys)[number];

type SsodaaTemplateDetail = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
};

type SsodaaTemplateCategory = {
  code: string;
  name: string;
  groupName: string | null;
  inclusion: string | null;
  exclusion: string | null;
};

function coerceJsonLikeBody(value: unknown) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return null;
}

function findNestedStringValue(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedStringValue(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;

  const direct = getStringValue(record, keys);
  if (direct) return direct;

  for (const nested of Object.values(record)) {
    const found = findNestedStringValue(nested, keys, depth + 1);
    if (found) return found;
  }

  return null;
}

function extractTemplateRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTemplateRecords(item, depth + 1));
  }

  const record = asRecord(value);
  if (!record) return [];

  const ownCode = getStringValue(record, ["templateCode", "template_code", "templtCode", "templt_code"]);
  const nested = Object.values(record).flatMap((item) => extractTemplateRecords(item, depth + 1));

  return ownCode ? [record, ...nested] : nested;
}

function findTemplateRecord(value: unknown, templateCode: string) {
  return (
    extractTemplateRecords(value).find((record) => {
      const code = getStringValue(record, ["templateCode", "template_code", "templtCode", "templt_code"]);
      return code === templateCode;
    }) ?? null
  );
}

function getResponseContentRecord(responseBody: unknown) {
  const body = asRecord(responseBody);
  if (!body) return null;
  return asRecord(body.content) ?? asRecord(body.data) ?? body;
}

function normalizeSsodaaTemplateDetail(
  templateCode: string,
  detailRecord: Record<string, unknown> | null,
  listRecord?: Record<string, unknown> | null,
) {
  const pick = (keys: string[]) => getStringValue(detailRecord, keys) ?? getStringValue(listRecord, keys);
  const pickDeep = (keys: string[]) =>
    getStringValue(detailRecord, keys) ??
    findNestedStringValue(detailRecord, keys) ??
    getStringValue(listRecord, keys) ??
    findNestedStringValue(listRecord, keys);

  return {
    templateCode: pick(["templateCode", "template_code", "templtCode", "templt_code"]) ?? templateCode,
    templateName: pick(["templateName", "template_name", "templtName", "templt_name", "name"]),
    templateContent: pickDeep([
      "templateContent",
      "template_content",
      "templtContent",
      "templt_content",
      "template",
      "msgBody",
      "msg_body",
      "message",
      "templateMsg",
      "template_msg",
      "templateText",
      "template_text",
      "templtText",
      "templt_text",
      "content",
    ]),
    inspectionStatus: pick([
      "inspectionStatus",
      "templateInspectionStatus",
      "templtInspectionStatus",
      "templt_inspection_status",
      "inspection_status",
      "inspectionStatusName",
      "templateInspectionStatusName",
      "templtInspectionStatusName",
    ]),
    serviceStatus: pick([
      "serviceStatus",
      "templateStatus",
      "templtStatus",
      "status",
      "service_status",
      "template_status",
      "templt_status",
    ]),
  } satisfies SsodaaTemplateDetail;
}

function extractProviderMessageId(responseBody: unknown) {
  const parsedBody = coerceJsonLikeBody(responseBody);

  if (typeof parsedBody !== "object" || parsedBody === null) return null;

  const directId =
    (parsedBody as { messageId?: string; requestId?: string; cmid?: string; id?: string }).messageId ||
    (parsedBody as { messageId?: string; requestId?: string; cmid?: string; id?: string }).requestId ||
    (parsedBody as { messageId?: string; requestId?: string; cmid?: string; id?: string }).cmid ||
    (parsedBody as { messageId?: string; requestId?: string; cmid?: string; id?: string }).id ||
    null;

  if (directId) return directId;

  const sentMessages =
    (parsedBody as { sent_messages?: Array<{ msg_id?: string | null }>; content?: { sent_messages?: Array<{ msg_id?: string | null }> } })
      .sent_messages ??
    (parsedBody as { sent_messages?: Array<{ msg_id?: string | null }>; content?: { sent_messages?: Array<{ msg_id?: string | null }> } })
      .content?.sent_messages;

  if (Array.isArray(sentMessages) && sentMessages[0]?.msg_id) {
    return sentMessages[0].msg_id;
  }

  const result =
    (parsedBody as { result?: Array<{ msg_id?: string | null }>; content?: { result?: Array<{ msg_id?: string | null }> } }).result ??
    (parsedBody as { result?: Array<{ msg_id?: string | null }>; content?: { result?: Array<{ msg_id?: string | null }> } }).content?.result;

  if (Array.isArray(result) && result[0]?.msg_id) {
    return result[0].msg_id;
  }

  return null;
}

type SsodaaSentListRow = {
  msg_id?: string | null;
  datetime?: string | null;
  status?: string | null;
  error_msg?: string | null;
  failover_msg?: string | null;
  dest_phone?: string | null;
  send_phone?: string | null;
  msg_body?: string | null;
};

function getDateStringInSeoul(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

async function fetchSentList(params: { destPhone: string; date: string }) {
  const providerResponse = await fetch(env.ssodaaSentListUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ssodaaApiKey,
    },
    body: JSON.stringify({
      token_key: env.ssodaaTokenKey,
      where: "dest_phone",
      keyword: params.destPhone,
      start_date: params.date,
      end_date: params.date,
      page: 1,
      limit: 100,
    }),
  });

  const contentType = providerResponse.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json")
    ? await providerResponse.json()
    : await providerResponse.text();
  const parsedResponseBody = coerceJsonLikeBody(responseBody);

  return {
    ok: providerResponse.ok,
    status: providerResponse.status,
    body: parsedResponseBody,
  };
}

async function fetchSsodaaTemplateDetail(templateCode: string) {
  const templateDetailUrl = new URL("/kakao/template/detail", env.ssodaaApiUrl).toString();
  const providerResponse = await fetch(templateDetailUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ssodaaApiKey,
    },
    body: JSON.stringify({
      token_key: env.ssodaaTokenKey,
      senderKey: env.ssodaaSenderKey,
      templateCode,
    }),
  });

  const contentType = providerResponse.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json")
    ? await providerResponse.json()
    : await providerResponse.text();
  const parsedResponseBody = coerceJsonLikeBody(responseBody);

  if (!providerResponse.ok) {
    throw new Error("쏘다 템플릿 상세 조회에 실패했습니다.");
  }

  const providerCode =
    typeof parsedResponseBody === "object" && parsedResponseBody !== null && "code" in parsedResponseBody
      ? String((parsedResponseBody as { code?: string | number }).code ?? "")
      : "";

  if (providerCode && providerCode !== "200") {
    const message =
      typeof parsedResponseBody === "object" &&
      parsedResponseBody !== null &&
      "error" in parsedResponseBody &&
      typeof (parsedResponseBody as { error?: unknown }).error === "string"
        ? ((parsedResponseBody as { error: string }).error || "쏘다 템플릿 상세 조회가 거절되었습니다.")
        : "쏘다 템플릿 상세 조회가 거절되었습니다.";
    throw new Error(message);
  }

  const detailRecord = findTemplateRecord(parsedResponseBody, templateCode) ?? getResponseContentRecord(parsedResponseBody);
  return normalizeSsodaaTemplateDetail(templateCode, detailRecord);
}

function getSsodaaApiUrl(pathname: string) {
  return new URL(pathname, env.ssodaaApiUrl).toString();
}

async function postSsodaaJson(pathname: string, payload: Record<string, unknown>) {
  const providerResponse = await fetch(getSsodaaApiUrl(pathname), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ssodaaApiKey,
    },
    body: JSON.stringify({
      token_key: env.ssodaaTokenKey,
      ...payload,
    }),
  });

  const contentType = providerResponse.headers.get("content-type") ?? "";
  const rawResponseBody = contentType.includes("application/json")
    ? await providerResponse.json()
    : await providerResponse.text();
  const responseBody = coerceJsonLikeBody(rawResponseBody);

  if (!providerResponse.ok) {
    const message =
      typeof responseBody === "string"
        ? responseBody
        : (responseBody as { message?: string; error?: string } | null)?.message ||
          (responseBody as { message?: string; error?: string } | null)?.error ||
          "쏘다 API 요청에 실패했습니다.";
    const error = new Error(message);
    (error as Error & { status?: number; providerResponse?: unknown }).status = providerResponse.status;
    (error as Error & { status?: number; providerResponse?: unknown }).providerResponse = responseBody;
    throw error;
  }

  if (typeof responseBody === "object" && responseBody !== null) {
    const providerCode = (responseBody as { code?: string | number }).code;
    if (providerCode !== undefined && String(providerCode) !== "200") {
      const message =
        (responseBody as { message?: string; error?: string } | null)?.message ||
        (responseBody as { message?: string; error?: string } | null)?.error ||
        "쏘다 API가 요청을 거절했습니다.";
      const error = new Error(message);
      (error as Error & { status?: number; providerResponse?: unknown }).status = 502;
      (error as Error & { status?: number; providerResponse?: unknown }).providerResponse = responseBody;
      throw error;
    }
  }

  return responseBody;
}

async function checkSsodaaTemplateCode(templateCode: string) {
  return postSsodaaJson("/kakao/template/codeCheck", {
    senderKey: env.ssodaaSenderKey,
    templateCode,
  });
}

async function addSsodaaTemplate(input: z.infer<typeof templateRegisterSchema>) {
  const buttons =
    input.templateButtons
      ?.filter((button) => button.buttonName && button.linkMobile)
      .map((button) => ({
        name: button.buttonName,
        linkType: button.buttonType,
        linkMo: button.linkMobile,
        linkPc: button.linkPc || button.linkMobile,
      })) ?? [];

  return postSsodaaJson("/kakao/template/add", {
    senderKey: env.ssodaaSenderKey,
    templateCode: input.templateCode,
    templateName: input.templateName,
    templateMessageType: input.templateMessageType,
    templateEmphasizeType: input.templateEmphasizeType,
    templateContent: input.templateContent,
    templateExtra: input.templateExtra || undefined,
    templateAd: input.templateAd || undefined,
    templateTitle: input.templateTitle || undefined,
    templateSubtitle: input.templateSubtitle || undefined,
    categoryCode: input.categoryCode,
    buttons: buttons.length ? buttons : undefined,
  });
}

async function requestSsodaaTemplateReview(input: z.infer<typeof templateRegisterSchema>) {
  return postSsodaaJson("/kakao/template/request", {
    senderKey: env.ssodaaSenderKey,
    templateCode: input.templateCode,
    comment: input.comment || undefined,
  });
}

function normalizeSsodaaTemplateCategories(responseBody: unknown) {
  const source =
    typeof responseBody === "object" && responseBody !== null && Array.isArray((responseBody as { category?: unknown[] }).category)
      ? ((responseBody as { category?: unknown[] }).category ?? [])
      : typeof responseBody === "object" &&
          responseBody !== null &&
          "content" in responseBody &&
          typeof (responseBody as { content?: unknown }).content === "object" &&
          (responseBody as { content?: unknown }).content !== null &&
          Array.isArray(((responseBody as { content?: { category?: unknown[] } }).content ?? {}).category)
        ? (((responseBody as { content?: { category?: unknown[] } }).content ?? {}).category ?? [])
        : [];

  return source
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const code = typeof row.code === "string" ? row.code : "";
      const name = typeof row.name === "string" ? row.name : "";
      if (!code || !name) return null;

      return {
        code,
        name,
        groupName: typeof row.groupName === "string" ? row.groupName : null,
        inclusion:
          typeof row.Inclusion === "string"
            ? row.Inclusion
            : typeof row.inclusion === "string"
              ? row.inclusion
              : null,
        exclusion:
          typeof row.exclusion === "string"
            ? row.exclusion
            : typeof row.Exclusion === "string"
              ? row.Exclusion
              : null,
      } satisfies SsodaaTemplateCategory;
    })
    .filter((item): item is SsodaaTemplateCategory => Boolean(item));
}

async function listSsodaaTemplateCategories() {
  const responseBody = await postSsodaaJson("/kakao/template/category/all", {});
  return {
    providerResponse: responseBody,
    categories: normalizeSsodaaTemplateCategories(responseBody),
  };
}

async function fetchSsodaaTemplateList() {
  const responseBody = await postSsodaaJson("/kakao/template/list", {
    senderKey: env.ssodaaSenderKey,
    page: "1",
    count: "100",
  });

  return extractTemplateRecords(responseBody);
}

function mapTemplateCodeToRelayConfig(configKey: RelayTemplateConfigKey, templateCode: string) {
  const nextConfig = {
    ...getRelayConfigPayload(),
    [configKey]: templateCode,
  };
  persistRelayConfig(nextConfig);
  applyRelayConfig(nextConfig);
}

async function buildSsodaaTemplateCatalog() {
  const aliasEntries = templateAliases.map((alias) => ({
    alias,
    configuredCode: resolveTemplateKey(alias) ?? "",
  }));
  let listRecords: Record<string, unknown>[] = [];

  try {
    listRecords = await fetchSsodaaTemplateList();
  } catch (error) {
    console.warn("[relay] Ssodaa template list fetch failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const detailEntries = await Promise.all(
    aliasEntries.map(async ({ alias, configuredCode }) => {
      if (!configuredCode) {
        return {
          alias,
          configuredCode,
          detail: null,
          error: null,
        };
      }

      try {
        const listRecord =
          listRecords.find(
            (record) => getStringValue(record, ["templateCode", "template_code", "templtCode", "templt_code"]) === configuredCode,
          ) ?? null;
        const detailFromList = listRecord ? normalizeSsodaaTemplateDetail(configuredCode, listRecord) : null;
        const detailFromApi = await fetchSsodaaTemplateDetail(configuredCode);
        const detail = normalizeSsodaaTemplateDetail(
          configuredCode,
          detailFromApi as unknown as Record<string, unknown>,
          detailFromList as unknown as Record<string, unknown> | null,
        );
        return {
          alias,
          configuredCode,
          detail,
          error: null,
        };
      } catch (error) {
        return {
          alias,
          configuredCode,
          detail: null,
          error: error instanceof Error ? error.message : "쏘다 템플릿 상세를 불러오지 못했습니다.",
        };
      }
    }),
  );

  return detailEntries;
}

function selectFinalStatusRow(rows: SsodaaSentListRow[], criteria: { msgId: string | null; destPhone: string; message?: string | null }) {
  if (criteria.msgId) {
    const byMessageId = rows.find((row) => row.msg_id === criteria.msgId);
    if (byMessageId) return byMessageId;
  }

  const normalizedDestPhone = normalizePhone(criteria.destPhone);
  const trimmedMessage = criteria.message?.trim() ?? "";

  return rows.find((row) => {
    const samePhone = normalizePhone(row.dest_phone) === normalizedDestPhone;
    if (!samePhone) return false;
    if (!trimmedMessage) return true;
    return (row.msg_body ?? "").trim() === trimmedMessage;
  }) ?? null;
}

async function pollFinalDeliveryStatus(params: {
  providerMessageId: string | null;
  destPhone: string;
  message: string;
}) {
  const date = getDateStringInSeoul();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) {
      await sleep(1500);
    }

    const sentListResponse = await fetchSentList({
      destPhone: params.destPhone,
      date,
    });

    if (!sentListResponse.ok) {
      return {
        found: false,
        fatal: true,
        message: "쏘다 발송내역 조회에 실패했습니다.",
        response: sentListResponse.body,
        row: null as SsodaaSentListRow | null,
      };
    }

    if (typeof sentListResponse.body === "object" && sentListResponse.body !== null) {
      const providerCode = (sentListResponse.body as { code?: string | number }).code;
      if (providerCode !== undefined && String(providerCode) !== "200") {
        return {
          found: false,
          fatal: true,
          message:
            (sentListResponse.body as { error?: string; message?: string } | null)?.error ||
            (sentListResponse.body as { error?: string; message?: string } | null)?.message ||
            "쏘다 발송내역 조회가 공급자 단계에서 거절되었습니다.",
          response: sentListResponse.body,
          row: null as SsodaaSentListRow | null,
        };
      }
    }

    const rows =
      typeof sentListResponse.body === "object" && sentListResponse.body !== null && Array.isArray((sentListResponse.body as { result?: SsodaaSentListRow[] }).result)
        ? ((sentListResponse.body as { result?: SsodaaSentListRow[] }).result ?? [])
        : [];

    const matchedRow = selectFinalStatusRow(rows, {
      msgId: params.providerMessageId,
      destPhone: params.destPhone,
      message: params.message,
    });

    if (!matchedRow) {
      continue;
    }

    const normalizedStatus = matchedRow.status ?? "";
    const isPending = normalizedStatus === "대기중";

    if (isPending && attempt < 3) {
      continue;
    }

    return {
      found: true,
      fatal: normalizedStatus === "실패",
      message: matchedRow.error_msg || matchedRow.failover_msg || null,
      response: sentListResponse.body,
      row: matchedRow,
    };
  }

  return {
    found: false,
    fatal: false,
    message: "발송내역에서 최종 상태를 아직 찾지 못했습니다.",
    response: null,
    row: null as SsodaaSentListRow | null,
  };
}

function resolveTemplateKey(alias: string | null | undefined) {
  switch (alias) {
    case "booking_received":
      return env.templateBookingReceived || null;
    case "booking_confirmed":
      return env.templateBookingConfirmed || null;
    case "booking_rejected":
      return env.templateBookingRejected || null;
    case "booking_cancelled":
      return env.templateBookingCancelled || null;
    case "booking_rescheduled_confirmed":
      return env.templateBookingRescheduledConfirmed || null;
    case "appointment_reminder_10m":
      return env.templateAppointmentReminder10m || null;
    case "grooming_started":
      return env.templateGroomingStarted || null;
    case "grooming_almost_done":
      return env.templateGroomingAlmostDone || null;
    case "grooming_completed":
      return env.templateGroomingCompleted || null;
    case "revisit_notice":
      return env.templateRevisitNotice || null;
    case "birthday_greeting":
      return env.templateBirthdayGreeting || null;
    default:
      return alias ?? null;
  }
}

function getTemplateDebugMap() {
  const templates: Record<TemplateAlias, { configured: boolean; length: number }> = {
    booking_received: {
      configured: Boolean(env.templateBookingReceived),
      length: env.templateBookingReceived.length,
    },
    booking_confirmed: {
      configured: Boolean(env.templateBookingConfirmed),
      length: env.templateBookingConfirmed.length,
    },
    booking_rejected: {
      configured: Boolean(env.templateBookingRejected),
      length: env.templateBookingRejected.length,
    },
    booking_cancelled: {
      configured: Boolean(env.templateBookingCancelled),
      length: env.templateBookingCancelled.length,
    },
    booking_rescheduled_confirmed: {
      configured: Boolean(env.templateBookingRescheduledConfirmed),
      length: env.templateBookingRescheduledConfirmed.length,
    },
    appointment_reminder_10m: {
      configured: Boolean(env.templateAppointmentReminder10m),
      length: env.templateAppointmentReminder10m.length,
    },
    grooming_started: {
      configured: Boolean(env.templateGroomingStarted),
      length: env.templateGroomingStarted.length,
    },
    grooming_almost_done: {
      configured: Boolean(env.templateGroomingAlmostDone),
      length: env.templateGroomingAlmostDone.length,
    },
    grooming_completed: {
      configured: Boolean(env.templateGroomingCompleted),
      length: env.templateGroomingCompleted.length,
    },
    revisit_notice: {
      configured: Boolean(env.templateRevisitNotice),
      length: env.templateRevisitNotice.length,
    },
    birthday_greeting: {
      configured: Boolean(env.templateBirthdayGreeting),
      length: env.templateBirthdayGreeting.length,
    },
  };

  return templates;
}

function requireRelaySecret(secret: string | null) {
  if (!env.relaySecret || secret !== env.relaySecret) {
    const error = new Error("릴레이 서버 인증에 실패했습니다.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
}

function ensureProviderConfig() {
  if (!env.ssodaaApiKey || !env.ssodaaTokenKey || !env.ssodaaSenderKey) {
    const error = new Error("쏘다 알림톡 설정값이 아직 모두 입력되지 않았습니다.");
    (error as Error & { status?: number }).status = 500;
    throw error;
  }
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    provider: "ssodaa",
    configured: Boolean(env.ssodaaApiKey && env.ssodaaTokenKey && env.ssodaaSenderKey),
    checks: {
      relaySecret: env.relaySecret.length,
      apiKey: env.ssodaaApiKey.length,
      tokenKey: env.ssodaaTokenKey.length,
      senderKey: env.ssodaaSenderKey.length,
      cwd: process.cwd(),
    },
  });
});

app.get("/admin/config", (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    response.json({
      ok: true,
      config: getRelayConfigPayload(),
      templates: getTemplateDebugMap(),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay admin config fetch failed.";
    response.status(status).json({ ok: false, message });
  }
});

app.put("/admin/config", (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    const nextConfig = adminConfigSchema.parse(request.body);
    persistRelayConfig(nextConfig);
    applyRelayConfig(nextConfig);

    response.json({
      ok: true,
      config: getRelayConfigPayload(),
      templates: getTemplateDebugMap(),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay admin config update failed.";
    response.status(status).json({ ok: false, message });
  }
});

app.get("/debug/templates", (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    response.json({
      ok: true,
      provider: "ssodaa",
      configured: Boolean(env.ssodaaApiKey && env.ssodaaTokenKey && env.ssodaaSenderKey),
      endpoints: {
        apiUrlHost: new URL(env.ssodaaApiUrl).host,
        sentListUrlHost: new URL(env.ssodaaSentListUrl).host,
      },
      templates: getTemplateDebugMap(),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay template debug failed.";
    response.status(status).json({ ok: false, message });
  }
});

app.get("/admin/templates", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const items = await buildSsodaaTemplateCatalog();

    response.json({
      ok: true,
      items,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay template catalog fetch failed.";
    response.status(status).json({ ok: false, message });
  }
});

app.post("/admin/templates/code-check", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const payload = templateCodeCheckSchema.parse(request.body);
    const providerResponse = await checkSsodaaTemplateCode(payload.templateCode);

    response.json({
      ok: true,
      templateCode: payload.templateCode,
      providerResponse,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay template code check failed.";
    response.status(status).json({
      ok: false,
      message,
      providerResponse: (error as Error & { providerResponse?: unknown }).providerResponse ?? null,
    });
  }
});

app.post("/admin/templates/register", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const payload = templateRegisterSchema.parse(request.body);
    const addResponse = await addSsodaaTemplate(payload);
    const reviewResponse = payload.requestReview ? await requestSsodaaTemplateReview(payload) : null;
    if (payload.templateConfigKey) {
      mapTemplateCodeToRelayConfig(payload.templateConfigKey, payload.templateCode);
    }

    response.json({
      ok: true,
      templateCode: payload.templateCode,
      registered: true,
      reviewRequested: Boolean(reviewResponse),
      mappedConfigKey: payload.templateConfigKey ?? null,
      providerResponse: {
        add: addResponse,
        review: reviewResponse,
      },
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay template registration failed.";
    response.status(status).json({
      ok: false,
      message,
      providerResponse: (error as Error & { providerResponse?: unknown }).providerResponse ?? null,
    });
  }
});

app.get("/admin/templates/categories", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const result = await listSsodaaTemplateCategories();

    response.json({
      ok: true,
      categories: result.categories,
      providerResponse: result.providerResponse,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Relay template category fetch failed.";
    response.status(status).json({
      ok: false,
      message,
      providerResponse: (error as Error & { providerResponse?: unknown }).providerResponse ?? null,
    });
  }
});

app.get("/admin/provider/diagnostics", async (request, response) => {
  const startedAt = Date.now();

  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const result = await listSsodaaTemplateCategories();

    response.json({
      ok: true,
      provider: "ssodaa",
      status: 200,
      latencyMs: Date.now() - startedAt,
      endpoints: {
        apiUrlHost: new URL(env.ssodaaApiUrl).host,
        sentListUrlHost: new URL(env.ssodaaSentListUrl).host,
      },
      checks: {
        apiKey: Boolean(env.ssodaaApiKey),
        tokenKey: Boolean(env.ssodaaTokenKey),
        senderKey: Boolean(env.ssodaaSenderKey),
      },
      categoryCount: result.categories.length,
      bodyPreview: JSON.stringify(result.providerResponse).slice(0, 800),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "쏘다 공급자 진단에 실패했습니다.";
    response.status(status).json({
      ok: false,
      provider: "ssodaa",
      status,
      latencyMs: Date.now() - startedAt,
      message,
      providerResponse: (error as Error & { providerResponse?: unknown }).providerResponse ?? null,
    });
  }
});

app.post("/admin/sent-list", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const payload = sentListLookupSchema.parse(request.body);
    const date = payload.date || getDateStringInSeoul();
    const sentListResponse = await fetchSentList({
      destPhone: normalizePhone(payload.destPhone),
      date,
    });

    if (!sentListResponse.ok) {
      return response.status(sentListResponse.status).json({
        ok: false,
        message: "쏘다 발송내역 조회에 실패했습니다.",
        providerResponse: sentListResponse.body,
      });
    }

    if (typeof sentListResponse.body === "object" && sentListResponse.body !== null) {
      const providerCode = (sentListResponse.body as { code?: string | number }).code;
      if (providerCode !== undefined && String(providerCode) !== "200") {
        return response.status(502).json({
          ok: false,
          message:
            (sentListResponse.body as { error?: string; message?: string } | null)?.error ||
            (sentListResponse.body as { error?: string; message?: string } | null)?.message ||
            "쏘다 발송내역 조회가 공급자 단계에서 거절되었습니다.",
          providerResponse: sentListResponse.body,
        });
      }
    }

    const rows =
      typeof sentListResponse.body === "object" &&
      sentListResponse.body !== null &&
      Array.isArray((sentListResponse.body as { result?: SsodaaSentListRow[] }).result)
        ? ((sentListResponse.body as { result?: SsodaaSentListRow[] }).result ?? [])
        : [];

    const matchedRow = selectFinalStatusRow(rows, {
      msgId: payload.providerMessageId ?? null,
      destPhone: payload.destPhone,
      message: payload.message ?? null,
    });

    response.json({
      ok: true,
      provider: "ssodaa",
      date,
      found: Boolean(matchedRow),
      status: matchedRow?.status ?? null,
      message: matchedRow?.error_msg || matchedRow?.failover_msg || null,
      row: matchedRow ?? null,
      totalRows: rows.length,
      providerResponse: sentListResponse.body,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "쏘다 발송내역 조회 처리 중 오류가 발생했습니다.";
    return response.status(status).json({
      ok: false,
      message,
      providerResponse: (error as Error & { providerResponse?: unknown }).providerResponse ?? null,
    });
  }
});

app.post("/alimtalk/send", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const payload = requestSchema.parse(request.body);
    const resolvedTemplateKey = payload.templateKey ?? resolveTemplateKey(payload.templateAlias);

    if (!resolvedTemplateKey) {
      return response.status(400).json({
        message: `Relay template mapping is missing for ${payload.templateAlias ?? "unknown"}.`,
      });
    }

    console.info("[relay] request", {
      toLast4: payload.to.slice(-4),
      templateAlias: payload.templateAlias ?? null,
      templateKey: resolvedTemplateKey,
    });

    const buttons =
      payload.buttons?.map((button) => ({
        name: button.name,
        type: button.type,
        url_mobile: button.linkMobile,
        url_pc: button.linkPc || button.linkMobile,
      })) ?? [];

    const providerResponse = await fetch(env.ssodaaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ssodaaApiKey,
      },
      body: JSON.stringify({
        token_key: env.ssodaaTokenKey,
        sender_key: env.ssodaaSenderKey,
        template_code: resolvedTemplateKey,
        template_type: payload.templateType ?? "alimtalk",
        msg_body: payload.message,
        dest_phone: payload.to,
        dest_name: payload.recipientName ?? "",
        metadata: payload.metadata ?? null,
        ...(buttons.length ? { button: buttons } : {}),
      }),
    });

    const contentType = providerResponse.headers.get("content-type") ?? "";
    const rawResponseBody = contentType.includes("application/json")
      ? await providerResponse.json()
      : await providerResponse.text();
    const responseBody = coerceJsonLikeBody(rawResponseBody);

    if (!providerResponse.ok) {
      const errorMessage =
        typeof responseBody === "string"
          ? responseBody
          : (responseBody as { message?: string; error?: string } | null)?.message ||
            (responseBody as { message?: string; error?: string } | null)?.error ||
            "쏘다 알림톡 발송에 실패했습니다.";

      console.error("[relay] provider http error", {
        status: providerResponse.status,
        body: responseBody,
      });

      return response
        .status(providerResponse.status)
        .json({ message: errorMessage, providerResponse: responseBody });
    }

    if (typeof responseBody === "object" && responseBody !== null) {
      const providerCode = (responseBody as { code?: string | number }).code;
      if (providerCode !== undefined && String(providerCode) !== "200") {
        const errorMessage =
          (responseBody as { message?: string; error?: string } | null)?.message ||
          (responseBody as { message?: string; error?: string } | null)?.error ||
          "쏘다 알림톡이 공급자 단계에서 거절되었습니다.";

        console.error("[relay] provider body error", {
          code: providerCode,
          body: responseBody,
        });

        return response.status(502).json({
          message: errorMessage,
          providerResponse: responseBody,
        });
      }
    }

    const providerMessageId = extractProviderMessageId(responseBody);

    const finalDelivery = await pollFinalDeliveryStatus({
      providerMessageId,
      destPhone: payload.to,
      message: payload.message,
    });

    console.info("[relay] provider delivery status", {
      providerMessageId,
      finalStatus: finalDelivery.row?.status ?? null,
      finalError: finalDelivery.message,
      found: finalDelivery.found,
    });

    if (finalDelivery.fatal) {
      return response.status(502).json({
        message: finalDelivery.message || "쏘다 최종 발송 단계에서 실패했습니다.",
        providerMessageId,
        providerResponse: responseBody,
        deliveryLookup: finalDelivery.response,
      });
    }

    console.info("[relay] provider success", {
      providerMessageId,
      body: responseBody,
    });

    return response.json({
      ok: true,
      provider: "ssodaa",
      templateKey: resolvedTemplateKey,
      providerMessageId,
      providerResponse: responseBody,
      deliveryStatus: finalDelivery.row?.status ?? null,
      deliveryError: finalDelivery.message,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "알림톡 발송 처리 중 오류가 발생했습니다.";
    return response.status(status).json({ message });
  }
});

app.listen(env.port, "0.0.0.0", () => {
  console.log(`PetManager Alimtalk Relay listening on port ${env.port}`);
});
