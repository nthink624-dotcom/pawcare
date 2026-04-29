import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import express from "express";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(currentDirPath, "../.env"), override: false });

const env = {
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
});

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

  return {
    ok: providerResponse.ok,
    status: providerResponse.status,
    body: coerceJsonLikeBody(responseBody),
  };
}

function selectFinalStatusRow(rows: SsodaaSentListRow[], criteria: { msgId: string | null; destPhone: string; message: string }) {
  if (criteria.msgId) {
    const byMessageId = rows.find((row) => row.msg_id === criteria.msgId);
    if (byMessageId) return byMessageId;
  }

  return rows.find(
    (row) =>
      (row.dest_phone ?? "") === criteria.destPhone &&
      (row.msg_body ?? "").trim() === criteria.message.trim(),
  ) ?? null;
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
  console.log(`PawCare Alimtalk Relay listening on port ${env.port}`);
});
