const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "retention-policy-approval-v01");

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
  const token = await sessionCookie();
  const report = [];
  for (const [width, height, label] of [[1440, 900, "pc"], [390, 844, "mobile"]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addCookies([{ name: "petmanager_admin_session", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    const row = page.getByRole("link", { name: /회원 탈퇴 후 어떤 정보를 남길까요/ });
    await row.click();
    await page.waitForURL("**/admin/approvals/RETENTION-POLICY-V01");
    const buttons = page.locator("button:disabled");
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight }));
    await page.screenshot({ path: path.join(outputDir, `${label}.png`), fullPage: false });
    report.push({ label, url: page.url(), titleCount: await page.getByText("회원 탈퇴 후 어떤 정보를 남길까요?").count(), pendingCount: await page.getByText(/등록 준비 중/).count(), disabledDecisionCount: await buttons.count(), dimensions, consoleErrors: errors });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch((error) => { console.error(error); process.exitCode = 1; });
