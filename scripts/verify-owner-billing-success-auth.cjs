const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const baseUrl = process.env.OWNER_LOGIN_LATENCY_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.OWNER_LOGIN_E2E_EMAIL ?? process.env.OWNER_LOGIN_SMOKE_EMAIL ?? "devowner@petmanager.test";
const password = process.env.OWNER_LOGIN_E2E_PASSWORD ?? process.env.OWNER_LOGIN_SMOKE_PASSWORD ?? "test1234";
const outputDir = path.resolve("artifacts/owner-login-latency/billing-success-auth");
const successPath = "/owner/billing/success?plan=quarterly&endAt=2026-12-31&method=%EC%B9%B4%EB%93%9C";

function createDiagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    failedRequests.push({ origin: url.origin, path: url.pathname, error: request.failure()?.errorText ?? "unknown" });
  });
  return { consoleErrors, pageErrors, failedRequests };
}

async function prepareSyntheticOwner(request) {
  const response = await request.post(`${baseUrl}/api/dev/create-owner`);
  if (!response.ok()) throw new Error(`Synthetic Development owner setup failed (${response.status()}).`);
}

async function loginToUsableOwner(page) {
  await page.goto(`${baseUrl}/login?next=%2Fowner`, { waitUntil: "domcontentloaded" });
  await page.getByText("개발용 테스트 계정").waitFor({ state: "visible" });
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(password);
  await page.getByTestId("owner-login-submit").click();
  await page.waitForURL(/\/owner(?:\/mobile)?(?:$|\?)/, { timeout: 30_000 });
  await page.waitForFunction(
    () => performance.getEntriesByName("petmanager:owner-login:owner-usable", "mark").length > 0,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(() => document.body.textContent?.includes("테스트 미용실") === true);
  await page.waitForLoadState("networkidle");
}

async function waitForBillingSuccess(page) {
  await page.getByRole("heading", { name: "결제가 완료되었습니다" }).waitFor({ state: "visible" });
  await page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/subscription",
    { timeout: 15_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(3_500);
  if (new URL(page.url()).pathname !== "/owner/billing/success") {
    throw new Error(`Billing success unexpectedly left the return route: ${new URL(page.url()).pathname}`);
  }
}

async function verifyAuthenticatedReturn(browser, viewport, screenshotName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  let loginPostCount = 0;
  let subscriptionRequestCount = 0;
  let subscriptionBearerCount = 0;
  let browserSupabaseAuthRequestCount = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/auth/login") loginPostCount += 1;
    if (url.pathname === "/api/subscription") {
      subscriptionRequestCount += 1;
      if (request.headers().authorization?.startsWith("Bearer ")) subscriptionBearerCount += 1;
    }
    if (url.pathname.startsWith("/auth/v1/")) browserSupabaseAuthRequestCount += 1;
  });

  await loginToUsableOwner(page);
  const browserSupabaseSessionCount = await page.evaluate(
    () => Object.keys(window.localStorage).filter((key) => key.startsWith("sb-")).length,
  );
  await page.goto(`${baseUrl}${successPath}`, { waitUntil: "domcontentloaded" });
  await waitForBillingSuccess(page);
  await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBillingSuccess(page);
  const refreshRecovered = new URL(page.url()).pathname === "/owner/billing/success";

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/owner(?:\/mobile)?(?:$|\?)/, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.textContent?.includes("테스트 미용실") === true);
  await page.waitForLoadState("networkidle");
  const backRecovered = new URL(page.url()).pathname.startsWith("/owner");

  await page.goForward({ waitUntil: "domcontentloaded" });
  await waitForBillingSuccess(page);
  const forwardRecovered = new URL(page.url()).pathname === "/owner/billing/success";

  await page.getByRole("button", { name: "확인" }).click();
  await page.waitForURL(/\/owner(?:\/mobile)?(?:$|\?)/, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.textContent?.includes("테스트 미용실") === true);

  const result = {
    viewport,
    loginPostCount,
    browserSupabaseSessionCount,
    browserSupabaseAuthRequestCount,
    subscriptionRequestCount,
    subscriptionBearerCount,
    refreshRecovered,
    backRecovered,
    forwardRecovered,
    ownerUsableAfterConfirm: new URL(page.url()).pathname.startsWith("/owner"),
    horizontalOverflow: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)),
    consoleErrors: diagnostics.consoleErrors,
    consoleErrorCount: diagnostics.consoleErrors.length,
    pageErrorCount: diagnostics.pageErrors.length,
    failedRequests: diagnostics.failedRequests,
    screenshot: path.join(outputDir, screenshotName),
  };
  await context.close();
  return result;
}

async function verifyFailClosed(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (mode !== "absent") {
    const expiresAt = mode === "expired" ? Date.now() - 60_000 : Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) })).toString("base64url");
    const accessToken = `synthetic.${payload}.invalid`;
    await context.addInitScript(
      ({ serialized }) => {
        window.localStorage.setItem("petmanager.ownerAuthTokenCache", serialized);
        window.sessionStorage.setItem("petmanager.ownerAuthTokenCache", serialized);
      },
      {
        serialized: JSON.stringify({
          accessToken,
          refreshToken: "synthetic-invalid-refresh-token",
          expiresAt,
        }),
      },
    );
  }
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  await page.goto(`${baseUrl}${successPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login\?next=/, { timeout: 20_000 });
  const result = {
    mode,
    failedClosed: new URL(page.url()).pathname === "/login",
    next: new URL(page.url()).searchParams.get("next"),
    pageErrorCount: diagnostics.pageErrors.length,
    unexpectedConsoleErrorCount: diagnostics.consoleErrors.filter(
      (message) => !message.includes("401") && !message.includes("400"),
    ).length,
  };
  await context.close();
  return result;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const setupContext = await browser.newContext();
    await prepareSyntheticOwner(setupContext.request);
    await setupContext.close();

    const report = {
      source: "development_synthetic_owner",
      generatedAt: new Date().toISOString(),
      success1440: await verifyAuthenticatedReturn(browser, { width: 1440, height: 900 }, "billing-success-1440.png"),
      success390: await verifyAuthenticatedReturn(browser, { width: 390, height: 844 }, "billing-success-390.png"),
      absentCredentials: await verifyFailClosed(browser, "absent"),
      expiredCredentials: await verifyFailClosed(browser, "expired"),
      tamperedCredentials: await verifyFailClosed(browser, "tampered"),
    };

    const successes = [report.success1440, report.success390];
    const failures = [report.absentCredentials, report.expiredCredentials, report.tamperedCredentials];
    report.pass =
      successes.every(
        (entry) =>
          entry.loginPostCount === 1 &&
          entry.browserSupabaseSessionCount === 0 &&
          entry.browserSupabaseAuthRequestCount === 0 &&
          entry.subscriptionRequestCount > 0 &&
          entry.subscriptionBearerCount === entry.subscriptionRequestCount &&
          entry.refreshRecovered &&
          entry.backRecovered &&
          entry.forwardRecovered &&
          entry.ownerUsableAfterConfirm &&
          entry.horizontalOverflow === 0 &&
          entry.consoleErrorCount === 0 &&
          entry.pageErrorCount === 0 &&
          entry.failedRequests.filter((request) => request.error !== "net::ERR_ABORTED").length === 0,
      ) &&
      failures.every(
        (entry) =>
          entry.failedClosed &&
          entry.next === "/owner/billing/success" &&
          entry.pageErrorCount === 0 &&
          entry.unexpectedConsoleErrorCount === 0,
      );

    const outputPath = path.join(outputDir, "report.json");
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ outputPath, pass: report.pass, ...report }, null, 2));
    if (!report.pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
