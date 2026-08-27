const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "signup-flow-review");
const captureIds = ["terms", "account", "shop", "validation-error", "duplicate-email", "reused-identity"];

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

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const token = await adminCookie();
  const report = { source: "actual_local_capture", fixture: true, capturedAt: new Date().toISOString(), developmentAdminReadOnly: true, productionCalls: 0, externalRequests: [], consoleErrors: [], pageErrors: [], captures: [], gallery: [] };

  try {
    for (const id of captureIds) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
        text: document.body.innerText,
      }));
      const file = path.join(outputDir, `${id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      report.captures.push({ id, url, httpStatus: response?.status(), file, viewport: "390x844", horizontalOverflow: metrics.scrollWidth - metrics.innerWidth, scrollHeight: metrics.scrollHeight, innerHeight: metrics.innerHeight, fixture: metrics.fixture, emailLikeTextCount: (metrics.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length });
      await context.close();
    }

    for (const viewport of [{ name: "admin-home-1440", width: 1440, height: 900, path: "/admin" }, { name: "gallery-1440", width: 1440, height: 900, path: "/admin/reviews/signup-flow" }, { name: "gallery-390", width: 390, height: 844, path: "/admin/reviews/signup-flow" }]) {
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
        await page.getByRole("button", { name: /계정 정보/ }).click();
        await page.getByRole("button", { name: /계정 정보 캡처 크게 보기/ }).click();
        await page.getByRole("button", { name: "확대 보기 닫기" }).click();
        await page.getByRole("button", { name: /다음 화면/ }).click();
        await page.getByRole("button", { name: "이전 화면", exact: true }).click();
        await page.getByRole("button", { name: /약관 동의/ }).click();
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
      const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, text: document.body.innerText }));
      const file = path.join(outputDir, `${viewport.name}.png`);
      if (viewport.path !== "/admin") await page.screenshot({ path: file, fullPage: false });
      report.gallery.push({ name: viewport.name, url: viewport.path === "/admin" ? `${baseUrl}/admin` : page.url(), clickTarget, httpStatus: response?.status(), file, horizontalOverflow: metrics.scrollWidth - metrics.innerWidth, inventoryTextCount: (metrics.text.match(/기본 단계 3\/3/g) || []).length, emailLikeTextCount: (metrics.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  report.productionCalls = report.externalRequests.length;
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  if (report.externalRequests.length || report.consoleErrors.length || report.pageErrors.length) throw new Error("Signup review safety verification failed");
  if (report.captures.some((item) => item.httpStatus !== 200 || item.horizontalOverflow > 0 || item.fixture !== item.id || item.emailLikeTextCount !== 0)) throw new Error("Signup capture contract failed");
  if (report.gallery.some((item) => item.horizontalOverflow > 0 || item.inventoryTextCount !== 1 || item.emailLikeTextCount !== 0)) throw new Error("Signup gallery contract failed");
  process.stdout.write(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
