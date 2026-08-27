const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const baseUrl = process.env.OWNER_LOGIN_LATENCY_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.OWNER_LOGIN_E2E_EMAIL ?? process.env.OWNER_LOGIN_SMOKE_EMAIL ?? "devowner@petmanager.test";
const password = process.env.OWNER_LOGIN_E2E_PASSWORD ?? process.env.OWNER_LOGIN_SMOKE_PASSWORD ?? "test1234";
const runs = Number(process.env.OWNER_LOGIN_LATENCY_RUNS ?? "20");
const phase = process.env.OWNER_LOGIN_LATENCY_PHASE ?? "after";
const navigationTimeoutMs = Number(process.env.OWNER_LOGIN_NAVIGATION_TIMEOUT_MS ?? "30000");
const allowNavigationTimeouts = process.env.OWNER_LOGIN_ALLOW_TIMEOUTS === "1";
const outputDir = path.resolve(process.env.OWNER_LOGIN_LATENCY_OUTPUT_DIR ?? "artifacts/owner-login-latency");

function percentile(values, ratio) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1));
  return Number(ordered[index].toFixed(1));
}

function parseServerTiming(value) {
  return Object.fromEntries(
    value
      .split(",")
      .map((entry) => entry.trim().match(/^([^;]+);dur=([0-9.]+)$/))
      .filter(Boolean)
      .map((match) => [match[1], Number(match[2])]),
  );
}

function summarize(samples, key) {
  const values = samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value));
  return values.length ? { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) } : null;
}

async function prepareSyntheticOwner(request) {
  const response = await request.post(`${baseUrl}/api/dev/create-owner`);
  if (!response.ok()) {
    throw new Error(`Synthetic Development owner setup failed (${response.status()}).`);
  }
}

async function measureSuccess(browser, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  const startedAt = new Map();

  page.on("request", (request) => {
    startedAt.set(request, performance.now());
  });
  page.on("requestfinished", (request) => {
    const start = startedAt.get(request);
    if (start == null) return;
    const url = new URL(request.url());
    const interesting =
      url.pathname === "/api/auth/login" ||
      url.pathname.startsWith("/api/bootstrap") ||
      url.pathname === "/api/owner/shops" ||
      url.pathname === "/api/subscription" ||
      url.pathname.startsWith("/auth/v1/");
    if (interesting) {
      requests.push({ method: request.method(), path: url.pathname, durationMs: performance.now() - start });
    }
  });

  await page.goto(`${baseUrl}/login?next=%2Fowner`, { waitUntil: "domcontentloaded" });
  await page.getByText("개발용 테스트 계정").waitFor({ state: "visible" });
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(password);

  const responsePromise = page.waitForResponse(
    (response) => response.url() === `${baseUrl}/api/auth/login` && response.request().method() === "POST",
  );
  await page.getByTestId("owner-login-submit").evaluate((button) => button.click());
  const loginResponse = await responsePromise;
  if (!loginResponse.ok()) {
    throw new Error(`Development login failed during run ${index + 1} (${loginResponse.status()}).`);
  }

  try {
    await page.waitForURL(/\/owner(?:\/mobile)?(?:$|\?)/, { timeout: navigationTimeoutMs });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      pathname: window.location.pathname,
      marks: performance
        .getEntriesByType("mark")
        .filter((entry) => entry.name.startsWith("petmanager:owner-login:"))
        .map((entry) => entry.name.replace("petmanager:owner-login:", "")),
      submitDisabled: document.querySelector('[data-testid="owner-login-submit"]')?.hasAttribute("disabled") ?? null,
      elapsedSinceSubmitMs:
        performance.now() -
        (performance.getEntriesByName("petmanager:owner-login:submit", "mark")[0]?.startTime ?? performance.now()),
    }));
    if (allowNavigationTimeouts) {
      const server = parseServerTiming((await loginResponse.headerValue("server-timing")) ?? "");
      await context.close();
      return {
        timedOut: true,
        submitToUsableLowerBoundMs: diagnostic.elapsedSinceSubmitMs,
        profileLookupMs: server.profile_lookup,
        supabaseSignInMs: server.supabase_sign_in,
        profileVerifyMs: server.profile_verify,
        loginPostCount: 1,
        browserSupabaseAuthRequestCount: 0,
        bootstrapRequestCount: 0,
        ownerShopsRequestCount: 0,
        subscriptionRequestCount: 0,
        diagnosticMarks: diagnostic.marks,
      };
    }
    throw new Error(`Owner navigation timeout: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  await page.waitForFunction(
    () => performance.getEntriesByName("petmanager:owner-login:owner-usable", "mark").length > 0,
    undefined,
    { timeout: 30_000 },
  );

  const marks = await page.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType("mark")
        .filter((entry) => entry.name.startsWith("petmanager:owner-login:"))
        .map((entry) => [entry.name.replace("petmanager:owner-login:", ""), entry.startTime]),
    ),
  );
  const server = parseServerTiming((await loginResponse.headerValue("server-timing")) ?? "");
  const sample = {
    submitToApiMs: marks["api-response"] - marks.submit,
    apiToHandoffMs: marks["handoff-ready"] - marks["api-response"],
    handoffToSessionMs: marks["session-ready"] - marks["handoff-ready"],
    sessionToRedirectMs: marks["redirect-start"] - marks["session-ready"],
    redirectToOwnerMountMs: marks["owner-route-mounted"] - marks["redirect-start"],
    ownerMountToUsableMs: marks["owner-usable"] - marks["owner-route-mounted"],
    submitToUsableMs: marks["owner-usable"] - marks.submit,
    profileLookupMs: server.profile_lookup,
    supabaseSignInMs: server.supabase_sign_in,
    profileVerifyMs: server.profile_verify,
    loginPostCount: requests.filter((request) => request.path === "/api/auth/login" && request.method === "POST").length,
    browserSupabaseAuthRequestCount: requests.filter((request) => request.path.startsWith("/auth/v1/")).length,
    bootstrapRequestCount: requests.filter((request) => request.path.startsWith("/api/bootstrap")).length,
    ownerShopsRequestCount: requests.filter((request) => request.path === "/api/owner/shops").length,
    subscriptionRequestCount: requests.filter((request) => request.path === "/api/subscription").length,
  };

  await context.close();
  return sample;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const request = await browser.newContext();
    await prepareSyntheticOwner(request.request);
    await request.close();

    const samples = [];
    for (let index = 0; index < runs; index += 1) {
      samples.push(await measureSuccess(browser, index));
    }

    const keys = [
      "submitToApiMs",
      "profileLookupMs",
      "supabaseSignInMs",
      "profileVerifyMs",
      "handoffToSessionMs",
      "redirectToOwnerMountMs",
      "ownerMountToUsableMs",
      "submitToUsableMs",
      "submitToUsableLowerBoundMs",
    ];
    const report = {
      phase,
      source: "development_synthetic_owner",
      runs,
      timeoutCount: samples.filter((sample) => sample.timedOut).length,
      generatedAt: new Date().toISOString(),
      summary: Object.fromEntries(keys.map((key) => [key, summarize(samples, key)])),
      requestCounts: {
        loginPost: samples.map((sample) => sample.loginPostCount),
        browserSupabaseAuth: samples.map((sample) => sample.browserSupabaseAuthRequestCount),
        bootstrap: samples.map((sample) => sample.bootstrapRequestCount),
        ownerShops: samples.map((sample) => sample.ownerShopsRequestCount),
        subscription: samples.map((sample) => sample.subscriptionRequestCount),
      },
      samples,
    };
    const outputPath = path.join(outputDir, `${phase}-report.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ outputPath, summary: report.summary, requestCounts: report.requestCounts }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
