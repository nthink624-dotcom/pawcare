import { serverEnv } from "@/lib/server-env";

type AlimtalkMetadata = Record<string, string | boolean | number | null | undefined>;

type SendAlimtalkInput = {
  to: string;
  message: string;
  templateKey?: string | null;
  templateType?: string | null;
  recipientName?: string | null;
  metadata?: AlimtalkMetadata | null;
};

type SendAlimtalkResult = {
  provider: string;
  providerMessageId: string | null;
  responseBody: unknown;
};

export async function sendAlimtalkMessage(input: SendAlimtalkInput): Promise<SendAlimtalkResult> {
  if (serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret) {
    const relayResponse = await fetch(serverEnv.alimtalkRelayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-secret": serverEnv.alimtalkRelaySecret,
      },
      body: JSON.stringify({
        to: input.to,
        message: input.message,
        templateKey: input.templateKey ?? null,
        templateType: input.templateType ?? null,
        recipientName: input.recipientName ?? null,
        metadata: input.metadata ?? null,
      }),
      cache: "no-store",
    });

    const relayContentType = relayResponse.headers.get("content-type") ?? "";
    const relayBody = relayContentType.includes("application/json") ? await relayResponse.json() : await relayResponse.text();

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
  }

  if (!serverEnv.alimtalkApiUrl || !serverEnv.alimtalkApiKey) {
    throw new Error("알림톡 발송 환경변수가 아직 설정되지 않았습니다.");
  }

  const payload =
    serverEnv.alimtalkProvider === "ssodaa"
      ? {
          token_key: serverEnv.alimtalkTokenKey ?? "",
          sender_key: serverEnv.alimtalkSenderKey ?? serverEnv.alimtalkProfileKey ?? "",
          template_code: input.templateKey ?? "",
          msg_body: input.message,
          dest_phone: input.to,
          dest_name: input.recipientName ?? "",
          template_type: input.templateType ?? "alimtalk",
          metadata: input.metadata ?? null,
        }
      : {
          profileKey: serverEnv.alimtalkProfileKey ?? null,
          senderKey: serverEnv.alimtalkSenderKey ?? null,
          to: input.to,
          message: input.message,
          templateKey: input.templateKey ?? null,
          templateType: input.templateType ?? null,
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

  const providerMessageId =
    typeof responseBody === "object" && responseBody !== null
      ? ((responseBody as { messageId?: string; requestId?: string; id?: string }).messageId ||
          (responseBody as { messageId?: string; requestId?: string; id?: string }).requestId ||
          (responseBody as { messageId?: string; requestId?: string; id?: string; cmid?: string }).cmid ||
          (responseBody as { messageId?: string; requestId?: string; id?: string }).id ||
          null)
      : null;

  return {
    provider: serverEnv.alimtalkProvider || "generic",
    providerMessageId,
    responseBody,
  };
}
