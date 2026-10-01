import { serverEnv } from "@/lib/server-env";

type AlimtalkMetadata = Record<string, string | boolean | number | null | undefined>;

import { logOperationalEvent } from "@/server/observability";

type SendAlimtalkInput = {
  to: string;
  message: string;
  templateAlias?: string | null;
  templateKey?: string | null;
  templateType?: string | null;
  senderChannelMode?: "petmanager" | "shop_channel";
  senderProfileKey?: string | null;
  senderChannelName?: string | null;
  senderChannelUrl?: string | null;
  recipientName?: string | null;
  metadata?: AlimtalkMetadata | null;
};

type SendAlimtalkResult = {
  provider: string;
  providerMessageId: string | null;
  responseBody: unknown;
};

function extractProviderMessageId(responseBody: unknown) {
  if (typeof responseBody !== "object" || responseBody === null) return null;

  const directId =
    (responseBody as { messageId?: string; requestId?: string; id?: string; cmid?: string }).messageId ||
    (responseBody as { messageId?: string; requestId?: string; id?: string; cmid?: string }).requestId ||
    (responseBody as { messageId?: string; requestId?: string; id?: string; cmid?: string }).cmid ||
    (responseBody as { messageId?: string; requestId?: string; id?: string; cmid?: string }).id ||
    null;

  if (directId) return directId;

  const sentMessages = (responseBody as { sent_messages?: Array<{ msg_id?: string | null }> }).sent_messages;
  if (Array.isArray(sentMessages) && sentMessages[0]?.msg_id) {
    return sentMessages[0].msg_id;
  }

  const result = (responseBody as { result?: Array<{ msg_id?: string | null }> }).result;
  if (Array.isArray(result) && result[0]?.msg_id) {
    return result[0].msg_id;
  }

  return null;
}

function getRelayUrlParts(relayUrl: string | null | undefined) {
  if (!relayUrl) {
    return {
      relayUrlHost: null,
      relayUrlPathname: null,
    };
  }

  try {
    const parsed = new URL(relayUrl);
    return {
      relayUrlHost: parsed.host,
      relayUrlPathname: parsed.pathname,
    };
  } catch {
    return {
      relayUrlHost: null,
      relayUrlPathname: null,
    };
  }
}

export async function sendAlimtalkMessage(input: SendAlimtalkInput): Promise<SendAlimtalkResult> {
  const requestId = crypto.randomUUID();
  const { relayUrlHost, relayUrlPathname } = getRelayUrlParts(serverEnv.alimtalkRelayUrl);
  const hasRelayUrl = Boolean(serverEnv.alimtalkRelayUrl);
  const hasRelaySecret = Boolean(serverEnv.alimtalkRelaySecret);

  console.log("[alimtalk-provider] env check", {
    eventCode: "ALIMTALK_RELAY_CONFIGURATION_CHECKED",
    requestId,
    hasRelayUrl,
    hasRelaySecret,
    relayUrlHost,
    relayUrlPathname,
  });

  if (serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret) {
    console.log("[alimtalk-provider] relay fetch start", {
      eventCode: "ALIMTALK_RELAY_REQUEST_STARTED",
      requestId,
      relayUrlHost,
      relayUrlPathname,
    });

    try {
      const relayResponse = await fetch(serverEnv.alimtalkRelayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-secret": serverEnv.alimtalkRelaySecret,
          "x-request-id": requestId,
        },
        body: JSON.stringify({
          to: input.to,
          message: input.message,
          templateAlias: input.templateAlias ?? null,
          templateKey: input.templateKey ?? null,
          templateType: input.templateType ?? null,
          senderChannelMode: input.senderChannelMode ?? "petmanager",
          senderProfileKey: input.senderProfileKey ?? null,
          senderChannelName: input.senderChannelName ?? null,
          senderChannelUrl: input.senderChannelUrl ?? null,
          recipientName: input.recipientName ?? null,
          metadata: input.metadata ?? null,
        }),
        cache: "no-store",
      });

      const relayContentType = relayResponse.headers.get("content-type") ?? "";
      const relayBody = relayContentType.includes("application/json") ? await relayResponse.json() : await relayResponse.text();

      console.log("[alimtalk-provider] relay fetch response", {
        eventCode: "ALIMTALK_RELAY_RESPONSE_RECEIVED",
        requestId,
        relayRequestId: relayResponse.headers.get("x-request-id"),
        relayUrlHost,
        relayUrlPathname,
        status: relayResponse.status,
        ok: relayResponse.ok,
      });

      if (!relayResponse.ok) {
        const relayMessage =
          typeof relayBody === "string"
            ? relayBody
            : (relayBody as { message?: string; error?: string } | null)?.message ||
              (relayBody as { message?: string; error?: string } | null)?.error ||
              "알림톡 중계 서버 호출에 실패했습니다.";
        throw new Error(relayMessage);
      }

      const providerMessageId =
        typeof relayBody === "object" && relayBody !== null
          ? ((relayBody as { messageId?: string; providerMessageId?: string | null }).providerMessageId ||
              (relayBody as { messageId?: string; providerMessageId?: string | null }).messageId ||
              null)
          : null;

      return {
        provider: "ssodaa-relay",
        providerMessageId,
        responseBody: relayBody,
      };
    } catch (error) {
      logOperationalEvent("alimtalk.relay_request_failed", {
        requestId,
        operation: "relay_request",
        code: "request_failed",
      });
      throw error;
    }
  }

  if (!serverEnv.alimtalkApiUrl || !serverEnv.alimtalkApiKey) {
    throw new Error("알림톡 발송 환경변수가 아직 설정되지 않았습니다.");
  }

  const payload =
    serverEnv.alimtalkProvider === "ssodaa"
      ? {
          token_key: serverEnv.alimtalkTokenKey ?? "",
          sender_key: input.senderProfileKey ?? serverEnv.alimtalkSenderKey ?? serverEnv.alimtalkProfileKey ?? "",
          template_code: input.templateKey ?? "",
          msg_body: input.message,
          dest_phone: input.to,
          dest_name: input.recipientName ?? "",
          template_type: input.templateType ?? "alimtalk",
          sender_channel_mode: input.senderChannelMode ?? "petmanager",
          sender_channel_name: input.senderChannelName ?? null,
          sender_channel_url: input.senderChannelUrl ?? null,
          metadata: input.metadata ?? null,
        }
      : {
          profileKey: input.senderProfileKey ?? serverEnv.alimtalkProfileKey ?? null,
          senderKey: input.senderProfileKey ?? serverEnv.alimtalkSenderKey ?? null,
          to: input.to,
          message: input.message,
          templateKey: input.templateKey ?? null,
          templateType: input.templateType ?? null,
          senderChannelMode: input.senderChannelMode ?? "petmanager",
          senderChannelName: input.senderChannelName ?? null,
          senderChannelUrl: input.senderChannelUrl ?? null,
          recipientName: input.recipientName ?? null,
          metadata: input.metadata ?? null,
        };

  const headers: Record<string, string> =
    serverEnv.alimtalkProvider === "ssodaa"
      ? {
          "Content-Type": "application/json",
          "x-api-key": serverEnv.alimtalkApiKey,
        }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serverEnv.alimtalkApiKey}`,
          "x-api-key": serverEnv.alimtalkApiKey,
        };

  const response = await fetch(serverEnv.alimtalkApiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof responseBody === "string"
        ? responseBody
        : (responseBody as { message?: string; error?: string } | null)?.message ||
          (responseBody as { message?: string; error?: string } | null)?.error ||
          "알림톡 발송에 실패했습니다.";
    throw new Error(message);
  }

  if (typeof responseBody === "object" && responseBody !== null) {
    const providerCode = (responseBody as { code?: string | number }).code;
    if (providerCode !== undefined && String(providerCode) !== "200") {
      const message =
        (responseBody as { error?: string; message?: string } | null)?.error ||
        (responseBody as { error?: string; message?: string } | null)?.message ||
        "알림톡 발송이 공급자 단계에서 거절되었습니다.";
      throw new Error(message);
    }
  }

  const providerMessageId = extractProviderMessageId(responseBody);

  return {
    provider: serverEnv.alimtalkProvider || "generic",
    providerMessageId,
    responseBody,
  };
}
