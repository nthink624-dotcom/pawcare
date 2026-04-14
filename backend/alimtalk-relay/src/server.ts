import "dotenv/config";

import express from "express";
import { z } from "zod";

const env = {
  port: Number(process.env.PORT || 4010),
  relaySecret: process.env.RELAY_SECRET || "",
  ssodaaApiUrl: process.env.SSODAA_API_URL || "https://apis.ssodaa.com/kakao/send/alimtalk",
  ssodaaApiKey: process.env.SSODAA_API_KEY || "",
  ssodaaTokenKey: process.env.SSODAA_TOKEN_KEY || "",
  ssodaaSenderKey: process.env.SSODAA_SENDER_KEY || "",
};

const requestSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
  templateKey: z.string().min(1),
  templateType: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
});

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
  });
});

app.post("/alimtalk/send", async (request, response) => {
  try {
    requireRelaySecret(request.headers["x-relay-secret"]?.toString() ?? null);
    ensureProviderConfig();

    const payload = requestSchema.parse(request.body);

    const providerResponse = await fetch(env.ssodaaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ssodaaApiKey,
      },
      body: JSON.stringify({
        token_key: env.ssodaaTokenKey,
        sender_key: env.ssodaaSenderKey,
        template_code: payload.templateKey,
        template_type: payload.templateType ?? "alimtalk",
        msg_body: payload.message,
        dest_phone: payload.to,
        dest_name: payload.recipientName ?? "",
        metadata: payload.metadata ?? null,
      }),
    });

    const contentType = providerResponse.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("application/json")
      ? await providerResponse.json()
      : await providerResponse.text();

    if (!providerResponse.ok) {
      const errorMessage =
        typeof responseBody === "string"
          ? responseBody
          : (responseBody as { message?: string; error?: string } | null)?.message ||
            (responseBody as { message?: string; error?: string } | null)?.error ||
            "쏘다 알림톡 발송에 실패했습니다.";

      return response
        .status(providerResponse.status)
        .json({ message: errorMessage, providerResponse: responseBody });
    }

    const providerMessageId =
      typeof responseBody === "object" && responseBody !== null
        ? ((responseBody as { messageId?: string; requestId?: string; cmid?: string; id?: string })
            .messageId ||
            (responseBody as {
              messageId?: string;
              requestId?: string;
              cmid?: string;
              id?: string;
            }).requestId ||
            (responseBody as { messageId?: string; requestId?: string; cmid?: string; id?: string })
              .cmid ||
            (responseBody as { messageId?: string; requestId?: string; cmid?: string; id?: string }).id ||
            null)
        : null;

    return response.json({
      ok: true,
      provider: "ssodaa",
      providerMessageId,
      providerResponse: responseBody,
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
