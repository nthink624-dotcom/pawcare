const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots");

const routes = [
  { name: "home", url: "/" },
  { name: "login", url: "/login" },
  { name: "signup", url: "/signup" },
  { name: "signup-social", url: "/signup/social?provider=naver" },
  { name: "find-id", url: "/login/find-id" },
  { name: "reset-password", url: "/login/reset" },
  { name: "landing-business", url: "/business" },
  { name: "landing-privacy", url: "/privacy" },
  { name: "landing-terms", url: "/terms" },
  { name: "landing-refund", url: "/refund" },
  { name: "admin-login", url: "/admin/login" },
  { name: "admin-register", url: "/admin/register" },
  { name: "admin-reset", url: "/admin/reset" },
  { name: "owner-billing", url: "/owner/billing" },
  { name: "owner-billing-success", url: "/owner/billing/success?plan=monthly&endAt=2026-12-31&method=%EC%B9%B4%EB%93%9C" },
  { name: "owner-demo", url: "/owner/demo" },
  { name: "demo-owner", url: "/demo/owner" },
  { name: "demo-book", url: "/demo/book" },
  { name: "demo-book-start", url: "/demo/book/start" },
  { name: "demo-book-info", url: "/demo/book/info" },
  { name: "demo-book-manage", url: "/demo/book/manage" },
  { name: "book-demo-shop", url: "/book/demo-shop" },
  { name: "book-demo-shop-info", url: "/book/demo-shop/info" },
  { name: "book-demo-shop-manage", url: "/book/demo-shop/manage" },
  { name: "entry-demo-shop", url: "/entry/demo-shop" },
  { name: "owner", url: "/owner" },
  { name: "owner-admin", url: "/owner/admin" },
  { name: "admin", url: "/admin" },
];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function capture() {
  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const results = [];

  for (const route of routes) {
    const target = `${baseUrl}${route.url}`;
    const filePath = path.join(outputDir, `${route.name}.png`);

    try {
      await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });
      await page.screenshot({ path: filePath, fullPage: true });
      results.push({
        name: route.name,
        url: target,
        status: "ok",
        file: filePath,
        title: await page.title(),
      });
    } catch (error) {
      results.push({
        name: route.name,
        url: target,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await browser.close();

  const summaryPath = path.join(outputDir, "summary.json");
  await fs.promises.writeFile(summaryPath, JSON.stringify(results, null, 2), "utf8");
  console.log(summaryPath);
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
