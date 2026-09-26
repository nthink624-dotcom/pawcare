import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test, { after } from "node:test";

const managedEnvironmentKeys = [
  "NODE_ENV",
  "VERCEL",
  "RELAY_SECRET",
  "SSODAA_API_URL",
  "SSODAA_SENT_LIST_URL",
  "SSODAA_API_KEY",
  "SSODAA_TOKEN_KEY",
  "SSODAA_SENDER_KEY",
  "ALIMTALK_TEMPLATE_BOOKING_CONFIRMED",
  "RELAY_PROVIDER_TIMEOUT_MS",
] as const;
const originalEnvironment = Object.fromEntries(
  managedEnvironmentKeys.map((key) => [key, process.env[key]]),
);

Object.assign(process.env, {
  NODE_ENV: "test",
  VERCEL: "1",
  RELAY_SECRET: "relay-test-secret",
  SSODAA_API_URL: "https://apis.ssodaa.com/kakao/send/alimtalk",
  SSODAA_SENT_LIST_URL: "https://apis.ssodaa.com/kakao/alimtalk/sent/list",
  SSODAA_API_KEY: "stub-api-key",
  SSODAA_TOKEN_KEY: "stub-token-key",
  SSODAA_SENDER_KEY: "stub-sender-key",
  ALIMTALK_TEMPLATE_BOOKING_CONFIRMED: "approved_template_1",
  RELAY_PROVIDER_TIMEOUT_MS: "100",
});

const originalFetch = globalThis.fetch;
let originalProviderFetchCount = 0;
globalThis.fetch = (async () => {
  originalProviderFetchCount += 1;
  throw new Error("Unexpected provider fetch.");
}) as typeof fetch;

const { default: app } = await import("../src/server.ts");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Test relay did not bind to an ephemeral TCP port.");
}

type RelayRequest = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
};

async function requestRelay(input: RelayRequest) {
  const bodyText = input.rawBody ?? (input.body === undefined ? "" : JSON.stringify(input.body));
  const headers: Record<string, string | number> = { ...input.headers };
  if (bodyText) {
    headers["content-type"] ??= "application/json";
    headers["content-length"] = Buffer.byteLength(bodyText);
  }

  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: unknown;
    text: string;
  }>((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path: input.path,
        method: input.method ?? "GET",
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = text;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            // Non-JSON responses are returned as text for assertions.
          }
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body,
            text,
          });
        });
      },
    );
    request.on("error", reject);
    if (bodyText) request.write(bodyText);
    request.end();
  });
}

function validSendBody() {
  return {
    to: "010-1234-5678",
    message: "예약 안내",
    templateAlias: null,
    templateKey: "approved_template_1",
    templateType: "alimtalk",
    senderChannelMode: "petmanager",
    senderProfileKey: null,
    senderChannelName: null,
    senderChannelUrl: null,
    recipientName: "테스트 고객",
    metadata: { appointmentId: "stub-appointment" },
    mediaAttachments: [
      {
        attachmentId: "stub-attachment",
        mediaAssetId: "stub-media",
        role: "before",
        url: "https://example.test/stub-image.jpg",
        contentType: "image/jpeg",
        byteSize: 123,
        variantKey: "original",
        expiresInSeconds: 60,
        metadata: { source: "test" },
      },
    ],
    buttons: [
      {
        type: "WL",
        name: "예약 보기",
        linkMobile: "https://example.test/reservation",
        linkPc: "https://example.test/reservation",
      },
    ],
  };
}

function validLocalConfig(overrides: Record<string, unknown> = {}) {
  return {
    relaySecret: "relay-test-secret",
    ssodaaApiUrl: "https://apis.ssodaa.com/kakao/send/alimtalk",
    ssodaaSentListUrl: "https://apis.ssodaa.com/kakao/alimtalk/sent/list",
    ssodaaApiKey: "stub-api-key",
    ssodaaTokenKey: "stub-token-key",
    ssodaaSenderKey: "stub-sender-key",
    templateBookingReceived: "",
    templateBookingConfirmed: "approved_template_1",
    templateBookingRejected: "",
    templateBookingCancelled: "",
    templateBookingTimeProposed: "",
    templateBookingRescheduledConfirmed: "",
    templateBookingManageLinkRequested: "",
    templateAppointmentReminder10m: "",
    templateVisitScheduleNotice: "",
    templateVisitReminderNotice: "",
    templateGroomingStarted: "",
    templateGroomingAlmostDone: "",
    templateGroomingCompleted: "",
    templateGroomingCompletedWithoutReport: "",
    templateRevisitNotice: "",
    templateBirthdayGreeting: "",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  assert.equal(server.listening, false);

  for (const key of managedEnvironmentKeys) {
    const originalValue = originalEnvironment[key];
    if (originalValue === undefined) delete process.env[key];
    else process.env[key] = originalValue;
  }
});

test("stateless relay security contract", async (t) => {
  await t.test("health is public, minimal, and non-sensitive", async () => {
    const response = await requestRelay({ path: "/health" });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      ok: true,
      provider: "ssodaa",
      configured: true,
    });
    assert.equal(response.text.includes("relay-test-secret"), false);
    assert.equal(response.text.includes("cwd"), false);
    assert.equal(response.text.includes("length"), false);
  });

  await t.test("protected send rejects missing relay authentication", async () => {
    const response = await requestRelay({
      method: "POST",
      path: "/alimtalk/send",
      body: validSendBody(),
    });
    assert.equal(response.status, 401);
    assert.equal(originalProviderFetchCount, 0);
  });

  await t.test("browser Origin requests are rejected without CORS opt-in", async () => {
    const response = await requestRelay({
      path: "/health",
      headers: { origin: "https://untrusted.example" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  });

  await t.test("JSON bodies above 64KB fail with 413 before provider access", async () => {
    const response = await requestRelay({
      method: "POST",
      path: "/alimtalk/send",
      headers: { "x-relay-secret": "relay-test-secret" },
      rawBody: JSON.stringify({
        ...validSendBody(),
        message: "x".repeat(70 * 1024),
      }),
    });
    assert.equal(response.status, 413);
    assert.equal(originalProviderFetchCount, 0);
  });

  await t.test("strict validation rejects unknown request keys", async () => {
    const response = await requestRelay({
      method: "POST",
      path: "/alimtalk/send",
      headers: { "x-relay-secret": "relay-test-secret" },
      body: { ...validSendBody(), unexpected: "blocked" },
    });
    assert.equal(response.status, 400);
    assert.equal(originalProviderFetchCount, 0);
  });

  await t.test("Vercel blocks file-backed config updates", async () => {
    const response = await requestRelay({
      method: "PUT",
      path: "/admin/config",
      headers: { "x-relay-secret": "relay-test-secret" },
      body: validLocalConfig(),
    });
    assert.equal(response.status, 405);
    assert.equal((response.body as { ok?: unknown }).ok, false);
  });

  await t.test("invalid or credential-bearing provider URLs fail closed", async () => {
    process.env.VERCEL = "0";
    try {
      const response = await requestRelay({
        method: "PUT",
        path: "/admin/config",
        headers: { "x-relay-secret": "relay-test-secret" },
        body: validLocalConfig({
          ssodaaApiUrl: "https://user:password@apis.ssodaa.com/kakao/send/alimtalk",
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(originalProviderFetchCount, 0);
    } finally {
      process.env.VERCEL = "1";
    }
  });

  await t.test("provider timeout is bounded and send is attempted once", async () => {
    let sendAttempts = 0;
    globalThis.fetch = (async (input, init) => {
      assert.equal(String(input), "https://apis.ssodaa.com/kakao/send/alimtalk");
      sendAttempts += 1;
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return reject(new Error("Missing provider timeout signal."));
        const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) rejectAbort();
        else signal.addEventListener("abort", rejectAbort, { once: true });
      });
    }) as typeof fetch;

    const startedAt = Date.now();
    const response = await requestRelay({
      method: "POST",
      path: "/alimtalk/send",
      headers: { "x-relay-secret": "relay-test-secret" },
      body: validSendBody(),
    });
    assert.equal(response.status, 504);
    assert.equal(sendAttempts, 1);
    assert.ok(Date.now() - startedAt < 2_000);
  });

  await t.test("normal stubbed send uses approved targets and one send POST", async () => {
    const outboundCalls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      outboundCalls.push({ url, method: init?.method ?? "GET", body });

      if (url === "https://apis.ssodaa.com/kakao/send/alimtalk") {
        return jsonResponse({
          code: 200,
          content: { sent_messages: [{ msg_id: "stub-message-id" }] },
        });
      }
      if (url === "https://apis.ssodaa.com/kakao/alimtalk/sent/list") {
        return jsonResponse({
          code: 200,
          result: [
            {
              msg_id: "stub-message-id",
              status: "성공",
              dest_phone: "01012345678",
              msg_body: "예약 안내",
            },
          ],
        });
      }
      throw new Error("Unapproved provider target.");
    }) as typeof fetch;

    const response = await requestRelay({
      method: "POST",
      path: "/alimtalk/send",
      headers: { "x-relay-secret": "relay-test-secret" },
      body: validSendBody(),
    });
    assert.equal(response.status, 200);
    assert.equal(
      outboundCalls.filter((call) => call.url.endsWith("/kakao/send/alimtalk")).length,
      1,
    );
    assert.equal(outboundCalls.length, 2);
    assert.ok(outboundCalls.every((call) => call.method === "POST"));
    assert.ok(outboundCalls.every((call) => new URL(call.url).origin === "https://apis.ssodaa.com"));
    assert.equal(outboundCalls[0]?.body.dest_phone, "01012345678");
    assert.equal(outboundCalls[0]?.body.msg_body, "예약 안내");
    assert.deepEqual(response.body, {
      ok: true,
      provider: "ssodaa",
      providerMessageId: "stub-message-id",
      deliveryStatus: "성공",
      deliveryFound: true,
    });
    assert.equal(response.text.includes("providerResponse"), false);
    assert.equal(response.text.includes("templateKey"), false);
    assert.equal(response.text.includes("예약 안내"), false);
    assert.equal(response.text.includes("01012345678"), false);
    assert.equal(originalProviderFetchCount, 0);
  });
});
