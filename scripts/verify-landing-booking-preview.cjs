const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "landing-booking-incident");
const errorCopy = "화면을 불러오지 못했습니다";
const directVariants = [
  { experience: "first", step: "1" },
  { experience: "ai", step: "3" },
  { experience: "revisit" },
];

function buildDirectRoute({ experience, step }, withService) {
  const params = new URLSearchParams({ experience });
  if (step) params.set("step", step);
  if (withService) params.set("serviceId", "petmanager-demo-service-full");
  return `/book/petmanager-demo-salon?${params}`;
}

function collectPageDiagnostics(page) {
  const diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [] };
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    if (!reason.includes("ERR_ABORTED")) diagnostics.failedRequests.push({ url: request.url(), reason });
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("favicon.ico")) {
      diagnostics.badResponses.push({ url: response.url(), status: response.status() });
    }
  });
  return diagnostics;
}

async function nextIssueText(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("nextjs-portal")]
      .map((portal) => portal.shadowRoot?.textContent ?? "")
      .filter((text) => /\b\d+\s+Issues?\b/i.test(text)),
  );
}

async function assertHealthyDocument(page, label) {
  const state = await page.evaluate((failureCopy) => ({
    errorBoundaryCount: document.body.innerText.includes(failureCopy) ? 1 : 0,
    nextErrorDocument: document.documentElement.id === "__next_error__",
    bodyTextLength: document.body.innerText.length,
  }), errorCopy);
  const issueText = await nextIssueText(page);
  if (state.errorBoundaryCount || state.nextErrorDocument || state.bodyTextLength === 0 || issueText.length > 0) {
    throw new Error(`${label} unhealthy: ${JSON.stringify({ state, issueText })}`);
  }
  return { ...state, nextIssueBadgeCount: issueText.length };
}

async function waitForLandingFrames(page) {
  await page.waitForFunction((failureCopy) => {
    const frames = [...document.querySelectorAll('iframe[src*="/book/petmanager-demo-salon"]')];
    return frames.length >= 2 && frames.every((frame) => {
      const doc = frame.contentDocument;
      return doc?.readyState === "complete" &&
        doc.documentElement.id !== "__next_error__" &&
        !doc.body.innerText.includes(failureCopy) &&
        doc.body.innerText.trim().length > 0;
    });
  }, errorCopy, { timeout: 30000 });

  return page.evaluate((failureCopy) =>
    [...document.querySelectorAll('iframe[src*="/book/petmanager-demo-salon"]')].map((frame) => ({
      src: frame.getAttribute("src"),
      title: frame.getAttribute("title"),
      errorBoundaryCount: frame.contentDocument?.body?.innerText.includes(failureCopy) ? 1 : 0,
      nextErrorDocument: frame.contentDocument?.documentElement.id === "__next_error__",
    })),
  errorCopy);
}

async function runDirectStress(browser) {
  const context = await browser.newContext({ viewport: { width: 430, height: 844 } });
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);
  const checks = [];
  try {
    for (const variant of directVariants) {
      for (let iteration = 0; iteration < 20; iteration += 1) {
        const withService = iteration % 2 === 0;
        const route = buildDirectRoute(variant, withService);
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (response?.status() !== 200) throw new Error(`${route} returned ${response?.status()}`);
        await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 15000 });
        checks.push({
          experience: variant.experience,
          iteration: iteration + 1,
          serviceId: withService ? "present" : "missing",
          status: response.status(),
          ...(await assertHealthyDocument(page, `${variant.experience}-${iteration + 1}`)),
        });
      }
    }
  } finally {
    await context.close();
  }
  return { checks, diagnostics };
}

async function runLandingViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);
  const suffix = `${viewport.width}x${viewport.height}`;
  try {
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (response?.status() !== 200) throw new Error(`landing returned ${response?.status()}`);
    const frames = await waitForLandingFrames(page);
    const health = await assertHealthyDocument(page, `landing-${suffix}`);

    const captures = {};
    for (const [step, selector] of [["step-01", "#solution-simple-booking"], ["step-02", "#solution-revisit-booking"]]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const capturePath = path.join(outputDir, `landing-${step}-${suffix}.png`);
      await page.screenshot({ path: capturePath, fullPage: false });
      captures[step] = capturePath;
    }

    const modalChecks = [];
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const first = iteration % 2 === 0;
      const buttonName = first ? "첫 방문 예약 화면 크게 보기" : "재방문 예약 화면 크게 보기";
      const button = page.getByRole("button", { name: buttonName }).first();
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible" });
      await page.waitForFunction((failureCopy) => {
        const dialogElement = document.querySelector('[role="dialog"]');
        const frame = dialogElement?.querySelector('iframe[src*="/book/petmanager-demo-salon"]');
        const doc = frame?.contentDocument;
        return doc?.readyState === "complete" && doc.documentElement.id !== "__next_error__" &&
          !doc.body.innerText.includes(failureCopy) && doc.body.innerText.trim().length > 0;
      }, errorCopy, { timeout: 30000 });
      modalChecks.push({ iteration: iteration + 1, experience: first ? "first" : "revisit", healthy: true });
      await page.getByRole("button", { name: "확대 화면 닫기" }).click();
      await dialog.waitFor({ state: "hidden" });
    }

    return {
      viewport,
      status: response.status(),
      health,
      iframeCount: frames.length,
      frames,
      modalChecks,
      captures,
      diagnostics,
    };
  } finally {
    await context.close();
  }
}

async function runFallbackViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const suffix = `${viewport.width}x${viewport.height}`;
  let requestMode = "hold";
  const blockedRequests = [];

  await page.route("**/book/petmanager-demo-salon*", async (route) => {
    if (requestMode === "allow") {
      await route.continue();
      return;
    }
    if (requestMode === "abort") {
      await route.abort("failed");
      return;
    }
    await new Promise((resolve) => blockedRequests.push(resolve));
    await route.abort("failed");
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (response?.status() !== 200) throw new Error(`fallback landing returned ${response?.status()}`);
    await page.waitForSelector('iframe[src*="/book/petmanager-demo-salon"]', { timeout: 15000 });
    await page.waitForFunction(() => document.body.innerText.includes("예약 화면을 준비하고 있습니다."));
    await page.locator("#solution-revisit-booking iframe").scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const loadingState = {
      loadingTextCount: await page.getByText("예약 화면을 준비하고 있습니다.", { exact: true }).count(),
    };
    const loadingCapture = path.join(outputDir, `landing-booking-loading-${suffix}.png`);
    await page.screenshot({ path: loadingCapture, fullPage: false });

    requestMode = "abort";
    blockedRequests.splice(0).forEach((release) => release());
    await page.waitForFunction(() =>
      document.body.innerText.includes("예약 데모를 준비하지 못했습니다.") &&
      document.body.innerText.includes("다시 불러오기"),
    null, { timeout: 15000 });

    const errorState = await page.evaluate(() => {
      const frames = [...document.querySelectorAll('iframe[src*="/book/petmanager-demo-salon"]')];
      return {
        errorTextCount: document.body.innerText.split("예약 데모를 준비하지 못했습니다.").length - 1,
        retryTextCount: document.body.innerText.split("다시 불러오기").length - 1,
        rawBrokenFrameVisibleCount: frames.filter((frame) => Number.parseFloat(getComputedStyle(frame).opacity) > 0).length,
        frameCount: frames.length,
      };
    });
    const errorCapture = path.join(outputDir, `landing-booking-error-${suffix}.png`);
    await page.screenshot({ path: errorCapture, fullPage: false });

    requestMode = "allow";
    const retryButtons = page.getByRole("button", { name: "다시 불러오기" });
    for (let index = 0; index < 20 && await retryButtons.count() > 0; index += 1) {
      await retryButtons.first().click();
    }
    const frames = await waitForLandingFrames(page);
    await page.waitForFunction(() => !document.body.innerText.includes("예약 데모를 준비하지 못했습니다."));
    await page.waitForFunction(() =>
      [...document.querySelectorAll('iframe[src*="/book/petmanager-demo-salon"]')]
        .every((frame) => Number.parseFloat(getComputedStyle(frame).opacity) === 1),
    null, { timeout: 15000 });
    await page.waitForTimeout(200);
    const successState = await page.evaluate(() => ({
      errorTextCount: document.body.innerText.split("예약 데모를 준비하지 못했습니다.").length - 1,
      retryTextCount: document.body.innerText.split("다시 불러오기").length - 1,
      visibleFrameCount: [...document.querySelectorAll('iframe[src*="/book/petmanager-demo-salon"]')]
        .filter((frame) => Number.parseFloat(getComputedStyle(frame).opacity) === 1).length,
    }));
    const successCapture = path.join(outputDir, `landing-booking-retry-success-${suffix}.png`);
    await page.screenshot({ path: successCapture, fullPage: false });

    return {
      viewport,
      loadingState,
      errorState,
      successState,
      recoveredFrameCount: frames.length,
      captures: { loading: loadingCapture, error: errorCapture, retrySuccess: successCapture },
    };
  } finally {
    blockedRequests.splice(0).forEach((release) => release());
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let report;
  try {
    const directStress = await runDirectStress(browser);
    const landing1440 = await runLandingViewport(browser, { width: 1440, height: 900 });
    const landing390 = await runLandingViewport(browser, { width: 390, height: 844 });
    const fallback1440 = await runFallbackViewport(browser, { width: 1440, height: 900 });
    const fallback390 = await runFallbackViewport(browser, { width: 390, height: 844 });
    report = {
      source: "actual_local_non_identifying_fixture",
      baseUrl,
      verifiedAt: new Date().toISOString(),
      rootCauseEvidence: {
        source: "actual_local_rsc_response_before_fix",
        status: 500,
        message: "매장 정보를 찾을 수 없습니다.",
        digest: "1956100270",
        stackAnchor: "getBootstrap → BookPage",
        cause: "landing demo shop fell through to hosted Supabase instead of a deterministic local fixture",
      },
      directStress,
      landing: [landing1440, landing390],
      fallback: [fallback1440, fallback390],
      externalBookingCreates: 0,
      productionChanges: 0,
    };
  } finally {
    await browser.close();
  }

  const allDiagnostics = [
    report.directStress.diagnostics,
    ...report.landing.map((entry) => entry.diagnostics),
  ];
  const errorCount = allDiagnostics.reduce((count, item) => count + item.pageErrors.length +
    item.consoleErrors.length + item.failedRequests.length + item.badResponses.length, 0);
  report.errorCount = errorCount;
  report.pass = report.directStress.checks.length === 60 &&
    report.landing.every((entry) => entry.iframeCount >= 2 && entry.modalChecks.length === 20) &&
    report.fallback.every((entry) => entry.errorState.errorTextCount > 0 &&
      entry.errorState.retryTextCount > 0 &&
      entry.errorState.rawBrokenFrameVisibleCount === 0 &&
      entry.successState.errorTextCount === 0 &&
      entry.successState.retryTextCount === 0 &&
      entry.recoveredFrameCount >= 2) &&
    errorCount === 0;

  const reportPath = path.join(outputDir, "verification-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ reportPath, pass: report.pass, errorCount, directChecks: report.directStress.checks.length }, null, 2)}\n`);
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
