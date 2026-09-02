const { chromium } = require("@playwright/test");

const baseUrl = (process.env.OWNER_LOGIN_SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const email = process.env.OWNER_LOGIN_E2E_EMAIL || process.env.OWNER_LOGIN_SMOKE_EMAIL || "devowner@petmanager.test";
const password = process.env.OWNER_LOGIN_E2E_PASSWORD || process.env.OWNER_LOGIN_SMOKE_PASSWORD || "test1234";
const warmRuns = Number(process.env.OWNER_LOGIN_WARM_RUNS || 20);
const coldRuns = Number(process.env.OWNER_LOGIN_COLD_RUNS || 5);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(samples) {
  const keys = ["clickFeedback", "submitToApiResponse", "apiToUsable", "submitToUsable", "loginResource", "essentialBootstrap", "fullBootstrap", "ownerShops"];
  return Object.fromEntries(keys.map((key) => {
    const values = samples.map((sample) => sample[key]).filter(Number.isFinite);
    return [key, values.length ? { count: values.length, median: Number(percentile(values, 0.5).toFixed(1)), p95: Number(percentile(values, 0.95).toFixed(1)) } : null];
  }));
}

function parseServerTiming(value) {
  return Object.fromEntries((value || "").split(",").map((entry) => {
    const [name, ...params] = entry.trim().split(";");
    const duration = params.find((param) => param.startsWith("dur="));
    return [name, duration ? Number(duration.slice(4)) : null];
  }).filter(([name]) => name));
}

async function measureRun(browser, run, mode) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let loginServerTiming = {};
  page.on("response", (response) => {
    if (response.url().includes("/api/auth/login")) loginServerTiming = parseServerTiming(response.headers()["server-timing"]);
  });
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.getByTestId("owner-login-email").fill(email);
    await page.getByTestId("owner-login-password").fill(password);
    await page.evaluate(() => performance.mark("petmanager:owner-login:playwright-click"));
    await page.getByTestId("owner-login-submit").click();
    await page.waitForURL(/\/owner(?:$|\?)/, { timeout: 30_000, waitUntil: "commit" });
    await page.waitForFunction(() => performance.getEntriesByName("petmanager:owner-login:owner-usable").length > 0, null, { timeout: 30_000 });
    const sample = await page.evaluate(() => {
      const mark = (name) => performance.getEntriesByName(name).at(-1)?.startTime ?? null;
      const resource = (fragment) => performance.getEntriesByType("resource").find((entry) => entry.name.includes(fragment));
      const click = mark("petmanager:owner-login:playwright-click");
      const submit = mark("petmanager:owner-login:submit");
      const apiResponse = mark("petmanager:owner-login:api-response");
      const usable = mark("petmanager:owner-login:owner-usable");
      return {
        clickFeedback: click != null && submit != null ? submit - click : null,
        submitToApiResponse: submit != null && apiResponse != null ? apiResponse - submit : null,
        apiToUsable: apiResponse != null && usable != null ? usable - apiResponse : null,
        submitToUsable: submit != null && usable != null ? usable - submit : null,
        loginResource: resource("/api/auth/login")?.duration ?? null,
        essentialBootstrap: resource("phase=essential")?.duration ?? null,
        fullBootstrap: resource("phase=full")?.duration ?? null,
        ownerShops: resource("/api/owner/shops")?.duration ?? null,
        resources: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/") || entry.name.includes("/owner")).map((entry) => ({ name: new URL(entry.name).pathname + new URL(entry.name).search, start: Number(entry.startTime.toFixed(1)), duration: Number(entry.duration.toFixed(1)) })),
      };
    });
    return { run, mode, ...sample, loginServerTiming };
  } finally {
    await context.close();
  }
}

async function main() {
  const warmBrowser = await chromium.launch({ headless: true });
  const warmSamples = [];
  const coldSamples = [];
  try {
    for (let run = 1; run <= warmRuns; run += 1) {
      const sample = await measureRun(warmBrowser, run, "warm");
      warmSamples.push(sample);
      console.log(JSON.stringify(sample));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await warmBrowser.close();
  }
  for (let run = 1; run <= coldRuns; run += 1) {
    const browser = await chromium.launch({ headless: true });
    try {
      const sample = await measureRun(browser, run, "cold");
      coldSamples.push(sample);
      console.log(JSON.stringify(sample));
    } finally {
      await browser.close();
    }
  }
  console.log(JSON.stringify({ summary: { warm: summarize(warmSamples), cold: summarize(coldSamples) } }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
