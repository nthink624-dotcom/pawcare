const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "admin-high-risk-actions-v01");
const endpoints = ["refund", "withdraw", "temporary-password", "payment-method/reset"].map((name) => `/api/admin/owners/${name}`);

function readEnv() {
  return Object.fromEntries(fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]));
}

async function sessionCookie() {
  const env = readEnv();
  const client = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const result = await client.from("admin_accounts").select("id,login_id,is_active").eq("is_active", true).limit(1).maybeSingle();
  if (result.error || !result.data?.is_active) throw result.error || new Error("Demo admin is unavailable");
  const payload = Buffer.from(JSON.stringify({ accountId: result.data.id, loginId: result.data.login_id, exp: Date.now() + 3600000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", env.ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const unauth = await browser.newContext();
  const unauthStatuses = [];
  for (const endpoint of endpoints) unauthStatuses.push((await unauth.request.post(`${baseUrl}${endpoint}`, { data: {} })).status());
  await unauth.close();

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const token = await sessionCookie();
  await context.addCookies([{ name: "petmanager_admin_session", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const authStatuses = [];
  for (const endpoint of endpoints) authStatuses.push((await context.request.post(`${baseUrl}${endpoint}`, { data: {} })).status());
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(`${baseUrl}/admin/owners`, { waitUntil: "networkidle" });
  const forbiddenButtons = await page.getByRole("button", { name: /임시비밀번호 발급|회원탈퇴|결제수단 초기화|이 결제 취소/ }).count();
  const readinessText = await page.getByText(/보안 승인 흐름 준비 중|추가 인증과 2인 승인 흐름/).count();
  await page.evaluate(() => {
    const allowed = /업체 관리|계정 접근 관리|추가 인증과 2인 승인 흐름|결제 내역|등록 결제수단 복구|보안 승인 흐름 준비 중|환불 실행은 보안 승인 흐름 준비 후 제공|관리자 홈|뒤로/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim() || "";
      if (text && !allowed.test(text)) node.textContent = "•••";
    }
  });
  await page.screenshot({ path: path.join(outputDir, "owners-redacted-1440.png") });
  const report = { unauthStatuses, authStatuses, forbiddenButtons, readinessText, consoleErrors, url: page.url() };
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await context.close();
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
