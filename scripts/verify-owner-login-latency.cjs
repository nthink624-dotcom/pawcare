const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const baseUrl = process.env.OWNER_LOGIN_LATENCY_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.OWNER_LOGIN_E2E_EMAIL ?? process.env.OWNER_LOGIN_SMOKE_EMAIL ?? "devowner@petmanager.test";
const password = process.env.OWNER_LOGIN_E2E_PASSWORD ?? process.env.OWNER_LOGIN_SMOKE_PASSWORD ?? "test1234";
const outputDir = path.resolve("artifacts/owner-login-latency");

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

function summarizeConsoleErrors(consoleErrors, expectedPatterns = []) {
  const unexpected = consoleErrors.filter(
    (message) => !expectedPatterns.some((pattern) => message.includes(pattern)),
  );
  return {
    expectedTransportConsoleCount: consoleErrors.length - unexpected.length,
    unexpectedConsoleErrorCount: unexpected.length,
  };
}

async function prepareSyntheticOwner(request) {
  const response = await request.post(`${baseUrl}/api/dev/create-owner`);
  if (!response.ok()) throw new Error(`Synthetic Development owner setup failed (${response.status()}).`);
}

async function fillLogin(page, submittedPassword = password) {
  await page.goto(`${baseUrl}/login?next=%2Fowner`, { waitUntil: "domcontentloaded" });
  await page.getByText("개발용 테스트 계정").waitFor({ state: "visible" });
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(submittedPassword);
}

async function waitForOwnerUsable(page) {
  await page.waitForURL(/\/owner(?:\/mobile)?(?:$|\?)/, { timeout: 30_000 });
  await page.waitForFunction(
    () => performance.getEntriesByName("petmanager:owner-login:owner-usable", "mark").length > 0,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle");
}

async function verifySuccess(browser, viewport, screenshotName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  let loginPosts = 0;
  const ownerEntries = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/auth/login") loginPosts += 1;
    if (url.pathname === "/owner" || url.pathname === "/owner/mobile") ownerEntries.push(url.pathname);
  });
  await fillLogin(page);
  await page.getByTestId("owner-login-submit").evaluate((button) => button.click());
  await waitForOwnerUsable(page);
  const destination = new URL(page.url()).pathname;
  await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body.textContent?.includes("테스트 미용실") === true,
    undefined,
    { timeout: 30_000 },
  );
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const result = {
    viewport,
    destination,
    loginPosts,
    redirectLoop: ownerEntries.length > 2,
    reloadSessionRecovered: page.url().includes("/owner"),
    horizontalOverflow,
    ...summarizeConsoleErrors(diagnostics.consoleErrors),
    failedRequests: diagnostics.failedRequests,
    pageErrorCount: diagnostics.pageErrors.length,
    screenshot: path.join(outputDir, screenshotName),
  };
  await context.close();
  return result;
}

async function verifyWrongPassword(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  await fillLogin(page, "synthetic-wrong-password");
  await page.getByTestId("owner-login-submit").evaluate((button) => button.click());
  await page.getByText(/이메일 또는 비밀번호를 다시 확인해 주세요/).first().waitFor();
  const result = {
    stayedOnLogin: new URL(page.url()).pathname === "/login",
    retryEnabled: await page.getByTestId("owner-login-submit").isEnabled(),
    ...summarizeConsoleErrors(diagnostics.consoleErrors, ["401 (Unauthorized)"]),
    pageErrorCount: diagnostics.pageErrors.length,
  };
  await context.close();
  return result;
}

async function verifyDelayedDoubleSubmit(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  let loginPosts = 0;
  await page.route("**/api/auth/login", async (route) => {
    loginPosts += 1;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await fillLogin(page);
  const startedAt = Date.now();
  await page.getByTestId("owner-login-submit").click();
  await page.getByTestId("owner-login-submit").evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitForOwnerUsable(page);
  const result = {
    loginPosts,
    elapsedMs: Date.now() - startedAt,
    usable: page.url().includes("/owner"),
    ...summarizeConsoleErrors(diagnostics.consoleErrors),
    pageErrorCount: diagnostics.pageErrors.length,
  };
  await context.close();
  return result;
}

async function verifyNetworkFailure(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  await page.route("**/api/auth/login", (route) => route.abort("failed"));
  await fillLogin(page);
  await page.getByTestId("owner-login-submit").evaluate((button) => button.click());
  await page.getByText("로그인 요청 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.").waitFor();
  const result = {
    stayedOnLogin: new URL(page.url()).pathname === "/login",
    retryEnabled: await page.getByTestId("owner-login-submit").isEnabled(),
    ...summarizeConsoleErrors(diagnostics.consoleErrors, ["net::ERR_FAILED"]),
    pageErrorCount: diagnostics.pageErrors.length,
  };
  await context.close();
  return result;
}

async function verifyNetworkTimeout(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  await page.route("**/api/auth/login", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 16_000));
    await route.abort("timedout").catch(() => undefined);
  });
  await fillLogin(page);
  const startedAt = Date.now();
  await page.getByTestId("owner-login-submit").evaluate((button) => button.click());
  await page.getByText("로그인 서버 응답이 늦어 요청을 중단했어요. 잠시 후 다시 시도해 주세요.").waitFor({
    timeout: 20_000,
  });
  const result = {
    elapsedMs: Date.now() - startedAt,
    stayedOnLogin: new URL(page.url()).pathname === "/login",
    retryEnabled: await page.getByTestId("owner-login-submit").isEnabled(),
    ...summarizeConsoleErrors(diagnostics.consoleErrors, ["net::ERR_"]),
    pageErrorCount: diagnostics.pageErrors.length,
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
      success1440: (console.log("scenario: success1440"), await verifySuccess(browser, { width: 1440, height: 900 }, "after-owner-1440.png")),
      success390: (console.log("scenario: success390"), await verifySuccess(browser, { width: 390, height: 844 }, "after-owner-390.png")),
      wrongPassword: (console.log("scenario: wrongPassword"), await verifyWrongPassword(browser)),
      delayedDoubleSubmit: (console.log("scenario: delayedDoubleSubmit"), await verifyDelayedDoubleSubmit(browser)),
      networkFailure: (console.log("scenario: networkFailure"), await verifyNetworkFailure(browser)),
      networkTimeout: (console.log("scenario: networkTimeout"), await verifyNetworkTimeout(browser)),
    };
    report.pass =
      report.success1440.loginPosts === 1 &&
      report.success390.loginPosts === 1 &&
      !report.success1440.redirectLoop &&
      !report.success390.redirectLoop &&
      report.wrongPassword.retryEnabled &&
      report.delayedDoubleSubmit.loginPosts === 1 &&
      report.networkFailure.retryEnabled &&
      report.networkTimeout.retryEnabled &&
      report.networkTimeout.elapsedMs >= 14_500 &&
      [report.success1440, report.success390, report.wrongPassword, report.delayedDoubleSubmit, report.networkFailure, report.networkTimeout]
        .every((entry) => entry.unexpectedConsoleErrorCount === 0 && entry.pageErrorCount === 0);

    const outputPath = path.join(outputDir, "scenario-report.json");
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ outputPath, ...report }, null, 2));
    if (!report.pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
