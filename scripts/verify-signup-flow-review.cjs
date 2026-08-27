const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "signup-flow-review");
const captureIds = ["terms", "account", "shop", "validation-error", "duplicate-email", "reused-identity"];
const reviewItems = [
  { id: "step-1-terms", title: "약관 동의", file: "terms.png" },
  { id: "step-2-account", title: "계정 정보", file: "account.png" },
  { id: "step-3-shop", title: "매장 정보", file: "shop.png" },
  { id: "state-validation-error", title: "필드 검증 오류", file: "validation-error.png" },
  { id: "state-duplicate-email", title: "중복 이메일", file: "duplicate-email.png" },
  { id: "state-reused-identity", title: "기존 가입자 안내", file: "reused-identity.png" },
];

function readEnv() {
  return Object.fromEntries(fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]));
}

async function adminCookie() {
  const env = readEnv();
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.includes("qefxdtmdtvnzgupmjlom")) throw new Error("Local capture must use the Development Supabase project");
  const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const result = await client.from("admin_accounts").select("id,login_id,is_active").eq("is_active", true).limit(1).maybeSingle();
  if (result.error || !result.data?.is_active) throw result.error || new Error("Development admin unavailable");
  const payload = Buffer.from(JSON.stringify({ accountId: result.data.id, loginId: result.data.login_id, exp: Date.now() + 3600000 })).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;
}

function registerGuards(page, report) {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== baseUrl) report.externalRequests.push({ method: request.method(), url: `${url.origin}${url.pathname}` });
  });
}

function readPngDimensions(file) {
  const png = fs.readFileSync(file);
  if (png.toString("ascii", 1, 4) !== "PNG") throw new Error(`Not a PNG: ${file}`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function selectAndVerifyReviewItem(page, item) {
  let target = page.locator(`button[data-review-item-id="${item.id}"]:visible`).first();
  if (await target.count() === 0) {
    const disclosure = page.locator("details").filter({ has: page.getByText("중요 상태", { exact: false }) });
    if (await disclosure.count() && !(await disclosure.first().evaluate((element) => element.hasAttribute("open")))) {
      await disclosure.first().locator("summary").click();
    }
    target = page.locator(`button[data-review-item-id="${item.id}"]:visible`).first();
  }
  await target.click();
  await page.waitForFunction(({ id, title, expectedPath }) => {
    const section = document.querySelector(`[data-selected-id="${id}"]`);
    const image = section?.querySelector(`img[data-review-item-id="${id}"]`);
    const trigger = section?.querySelector("button[aria-label$='캡처 크게 보기']");
    if (!(image instanceof HTMLImageElement) || !(trigger instanceof HTMLButtonElement)) return false;
    const source = new URL(image.src, window.location.href);
    return section?.getAttribute("data-selected-title") === title
      && image.alt.includes(title)
      && source.pathname === expectedPath
      && image.complete
      && image.naturalWidth > 0
      && trigger.getAttribute("aria-busy") === "false"
      && !trigger.disabled;
  }, { id: item.id, title: item.title, expectedPath: `/admin/reviews/signup-flow/assets/${item.file}` });
  return page.evaluate(({ id, title, expectedPath }) => {
    const section = document.querySelector(`[data-selected-id="${id}"]`);
    const image = section?.querySelector(`img[data-review-item-id="${id}"]`);
    const source = image instanceof HTMLImageElement ? new URL(image.src, window.location.href) : null;
    return {
      selectedId: section?.getAttribute("data-selected-id") ?? null,
      heading: section?.getAttribute("data-selected-title") ?? null,
      imgSrc: source?.pathname ?? null,
      imgAlt: image?.getAttribute("alt") ?? null,
      expectedCaptureUrl: expectedPath,
      complete: image instanceof HTMLImageElement ? image.complete : false,
      naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
      mismatch: section?.getAttribute("data-selected-id") !== id
        || section?.getAttribute("data-selected-title") !== title
        || source?.pathname !== expectedPath
        || !image?.getAttribute("alt")?.includes(title),
    };
  }, { id: item.id, title: item.title, expectedPath: `/admin/reviews/signup-flow/assets/${item.file}` });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const token = await adminCookie();
  const gallerySource = fs.readFileSync(path.join(process.cwd(), "src", "components", "admin", "signup-flow-review-gallery.tsx"), "utf8");
  const report = { source: "actual_local_capture", fixture: true, capturedAt: new Date().toISOString(), developmentAdminReadOnly: true, productionCalls: 0, externalRequests: [], consoleErrors: [], pageErrors: [], captures: [], gallery: [], keyboard: [], selectionChecks: [], tokenAudit: { typeSystem: "ADMIN_TYPOGRAPHY", rawArbitraryTextSizeCount: (gallerySource.match(/text-\[(?:\d|clamp|calc)/g) || []).length, allowedRadiusValues: ["8", "10", "14", "18", "full"], disallowedRadiusCount: (gallerySource.match(/rounded-(?:xl|lg|md|sm)|rounded-\[(?!(?:8|10|14|18)px\])/g) || []).length } };

  try {
    for (const id of captureIds) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      await context.addCookies([{ name: "petmanager_admin_session", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      registerGuards(page, report);
      const url = `${baseUrl}/admin/reviews/signup-flow/capture/${id}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        fixture: document.querySelector("[data-review-fixture='true']")?.getAttribute("data-capture-id"),
        adminFrameCount: document.querySelectorAll("[data-admin-global-nav], [data-device-mockup], [data-type-system='ADMIN_TYPOGRAPHY']").length,
        text: document.body.innerText,
      }));
      const file = path.join(outputDir, `${id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      const dimensions = readPngDimensions(file);
      let fullPageFile = null;
      let fullPageDimensions = null;
      if (metrics.scrollHeight > metrics.innerHeight) {
        fullPageFile = path.join(outputDir, `${id}-full.png`);
        await page.screenshot({ path: fullPageFile, fullPage: true });
        fullPageDimensions = readPngDimensions(fullPageFile);
      }
      report.captures.push({ id, url, httpStatus: response?.status(), file, cssViewport: { width: 390, height: 844 }, deviceScaleFactor: 2, pixelDimensions: dimensions, expectedPixelDimensions: { width: 780, height: 1688 }, fullPageFile, fullPageDimensions, viewport: "390x844", horizontalOverflow: metrics.scrollWidth - metrics.innerWidth, scrollHeight: metrics.scrollHeight, innerHeight: metrics.innerHeight, fixture: metrics.fixture, outerFrameCount: metrics.adminFrameCount, emailLikeTextCount: (metrics.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length });
      await context.close();
    }

    for (const viewport of [{ name: "admin-home-1440", width: 1440, height: 900, path: "/admin" }, { name: "gallery-1440", width: 1440, height: 900, path: "/admin/reviews/signup-flow" }, { name: "gallery-1024", width: 1024, height: 768, path: "/admin/reviews/signup-flow" }, { name: "gallery-390", width: 390, height: 844, path: "/admin/reviews/signup-flow" }]) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      await context.addCookies([{ name: "petmanager_admin_session", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      registerGuards(page, report);
      const response = await page.goto(`${baseUrl}${viewport.path}`, { waitUntil: "networkidle" });
      let clickTarget = null;
      if (viewport.path === "/admin") {
        const file = path.join(outputDir, `${viewport.name}.png`);
        await page.screenshot({ path: file, fullPage: false });
        const entry = page.getByRole("link", { name: /회원가입 흐름 검수/ });
        if (await entry.count()) {
          await entry.click();
          await page.waitForURL("**/admin/reviews/signup-flow");
          clickTarget = page.url();
        }
      }
      if (viewport.path.includes("signup-flow")) {
        await selectAndVerifyReviewItem(page, reviewItems[1]);
        const opener = page.getByRole("button", { name: /계정 정보 캡처 크게 보기/ });
        await opener.click();
        const initialFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
        await page.keyboard.press("Tab");
        const tabTrapped = await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")));
        await page.keyboard.press("Escape");
        const escapeClosed = await page.getByRole("dialog").count() === 0;
        await page.waitForTimeout(32);
        const focusReturned = await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.includes("캡처 크게 보기") ?? false);
        await opener.click();
        await page.getByRole("button", { name: "확대 보기 닫기" }).click();
        report.keyboard.push({ viewport: viewport.name, initialFocus, tabTrapped, escapeClosed, focusReturned });
        await page.getByRole("button", { name: /다음 화면/ }).click();
        await page.getByRole("button", { name: "이전 화면", exact: true }).click();
        const transitions = [];
        for (let index = 0; index < 20; index += 1) {
          transitions.push(await selectAndVerifyReviewItem(page, reviewItems[index % reviewItems.length]));
        }
        const defaultSelection = await selectAndVerifyReviewItem(page, reviewItems[0]);
        await page.locator("details[open]").evaluateAll((elements) => elements.forEach((element) => element.removeAttribute("open")));
        report.selectionChecks.push({
          viewport: viewport.name,
          transitionCount: transitions.length,
          mismatchCount: transitions.filter((item) => item.mismatch).length,
          defaultSelection,
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
      const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, text: document.body.innerText, selectedImageTop: document.querySelector("button[aria-label$='캡처 크게 보기']")?.getBoundingClientRect().top ?? null, typeSystem: document.querySelector("[data-type-system]")?.getAttribute("data-type-system") ?? null }));
      const file = path.join(outputDir, `${viewport.name}.png`);
      if (viewport.path !== "/admin") await page.screenshot({ path: file, fullPage: false });
      report.gallery.push({ name: viewport.name, url: viewport.path === "/admin" ? `${baseUrl}/admin` : page.url(), clickTarget, httpStatus: response?.status(), file, horizontalOverflow: metrics.scrollWidth - metrics.innerWidth, inventoryTextCount: (metrics.text.match(/기본 단계 3\/3/g) || []).length, emailLikeTextCount: (metrics.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length, selectedImageTop: metrics.selectedImageTop, typeSystem: metrics.typeSystem });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  report.productionCalls = report.externalRequests.length;
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  if (report.externalRequests.length || report.consoleErrors.length || report.pageErrors.length) throw new Error("Signup review safety verification failed");
  if (report.captures.some((item) => item.httpStatus !== 200 || item.horizontalOverflow > 0 || item.fixture !== item.id || item.emailLikeTextCount !== 0 || item.outerFrameCount !== 0 || item.pixelDimensions.width !== item.expectedPixelDimensions.width || item.pixelDimensions.height !== item.expectedPixelDimensions.height)) throw new Error("Signup capture contract failed");
  if (report.gallery.some((item) => item.horizontalOverflow > 0 || item.inventoryTextCount !== 1 || item.emailLikeTextCount !== 0)) throw new Error("Signup gallery contract failed");
  if (report.tokenAudit.rawArbitraryTextSizeCount !== 0 || report.tokenAudit.disallowedRadiusCount !== 0) throw new Error("Signup gallery token contract failed");
  if (report.keyboard.some((item) => item.initialFocus !== "확대 보기 닫기" || !item.tabTrapped || !item.escapeClosed || !item.focusReturned)) throw new Error("Signup gallery keyboard contract failed");
  if (report.selectionChecks.length !== 3 || report.selectionChecks.some((item) => item.transitionCount !== 20 || item.mismatchCount !== 0 || item.defaultSelection.mismatch || !item.defaultSelection.complete || item.defaultSelection.naturalWidth <= 0)) throw new Error("Signup gallery selected capture identity contract failed");
  const mobileGallery = report.gallery.find((item) => item.name === "gallery-390");
  if (!mobileGallery || mobileGallery.selectedImageTop === null || mobileGallery.selectedImageTop > 420) throw new Error("Signup gallery mobile evidence placement failed");
  process.stdout.write(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
