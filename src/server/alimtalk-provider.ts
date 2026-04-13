import { serverEnv } from "@/lib/server-env";

type AlimtalkMetadata = Record<string, string | boolean | number | null | undefined>;

type SendAlimtalkInput = {
  to: string;
  message: string;
  templateKey?: string | null;
  recipientName?: string | null;
  metadata?: AlimtalkMetadata | null;
};

type SendAlimtalkResult = {
  provider: string;
  providerMessageId: string | null;
  responseBody: unknown;
};

export async function sendAlimtalkMessage(input: SendAlimtalkInput): Promise<SendAlimtalkResult> {
  if (!serverEnv.alimtalkApiUrl || !serverEnv.alimtalkApiKey) {
    throw new Error("알림톡 발송 환경변수가 아직 설정되지 않았습니다.");
  }

  const payload = {
    profileKey: serverEnv.alimtalkProfileKey ?? null,
    senderKey: serverEnv.alimtalkSenderKey ?? null,
    to: input.to,
    message: input.message,
    templateKey: input.templateKey ?? null,
    recipientName: input.recipientName ?? null,
    metadata: input.metadata ?? null,
  };

  const response = await fetch(serverEnv.alimtalkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.alimtalkApiKey}`,
      "x-api-key": serverEnv.alimtalkApiKey,
    },
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
          (responseBody as { messageId?: string; requestId?: string; id?: string }).id ||
          null)
      : null;

  return {
    provider: serverEnv.alimtalkProvider || "generic",
    providerMessageId,
    responseBody,
  };
}
