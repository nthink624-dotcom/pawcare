const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const baseUrl = "http://127.0.0.1:3000";
const authConfigPath = path.join(process.cwd(), "artifacts", "screenshots", "auth-accounts.json");
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "auth");

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function captureOwner(browser, owner) {
  const context = await browser.newContext({
    viewport: { width: 430, height: 2200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log("owner: goto login");
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[placeholder="아이디"]').fill(owner.loginId);
  await page.locator('input[placeholder="비밀번호"]').fill(owner.password);
  console.log("owner: submit login");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/owner/, { timeout: 30000 });
  console.log("owner: landed", page.url());

  const captures = [];

  async function shot(name) {
    const file = path.join(outputDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    captures.push({ name, file, url: page.url() });
  }

  await shot("owner-home-auth");

  console.log("owner: reservations");
  await page.getByText("예약 조회").click();
  await page.waitForTimeout(600);
  await shot("owner-reservations-auth");

  console.log("owner: customers");
  await page.getByText("고객관리").click();
  await page.waitForTimeout(600);
  await shot("owner-customers-auth");

  console.log("owner: settings");
  await page.getByText("설정").click();
  await page.waitForTimeout(600);
  await shot("owner-settings-auth");

  await context.close();
  return captures;
}

async function captureAdmin(browser, admin) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log("admin: goto login");
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[placeholder="관리자 아이디"]').fill(admin.loginId);
  await page.locator('input[placeholder="관리자 비밀번호"]').fill(admin.password);
  console.log("admin: submit login");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await page.waitForURL(/\/admin/, { timeout: 30000 });
  console.log("admin: landed", page.url());

  const captures = [];

  async function shot(name) {
    const file = path.join(outputDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    captures.push({ name, file, url: page.url() });
  }

  await shot("admin-dashboard-auth");

  console.log("admin: owner admin");
  await page.goto(`${baseUrl}/owner/admin`, { waitUntil: "networkidle", timeout: 30000 });
  await shot("admin-owner-management-auth");

  await context.close();
  return captures;
}

async function main() {
  await ensureDir(outputDir);

  const authConfig = JSON.parse(await fs.promises.readFile(authConfigPath, "utf8"));
  const browser = await chromium.launch({ headless: true });

  const ownerCaptures = await captureOwner(browser, authConfig.owner);
  const adminCaptures = await captureAdmin(browser, authConfig.admin);

  await browser.close();

  const summaryPath = path.join(outputDir, "summary.json");
  await fs.promises.writeFile(
    summaryPath,
    JSON.stringify([...ownerCaptures, ...adminCaptures], null, 2),
    "utf8",
  );
  console.log(summaryPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
