const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.SECURE_PRICE_GUIDE_BASE_URL || "http://127.0.0.1:3108";
const fixturePath = path.resolve("artifacts/secure-ai-price-guide-import-v0.1/korean-price-guide-fixture.png");
const screenshotPath = path.resolve("artifacts/secure-ai-price-guide-import-v0.2/mobile-confirmed-after-purge.png");
const deviceFingerprint = "p0_v02_fixture_device_1234567890";

async function token(page) {
  const result = await page.evaluate(async ({ deviceFingerprint }) => {
    const response = await fetch("/api/auth/signup/price-guide-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceFingerprint }),
    });
    return { status: response.status, payload: await response.json() };
  }, { deviceFingerprint });
  assert.equal(result.status, 200);
  assert.equal(typeof result.payload.token, "string");
  return result.payload.token;
}

async function chunkedOversize(context, bearerToken) {
  const cookies = await context.cookies(`${baseUrl}/api/auth/signup/price-guide-preview`);
  const cookie = cookies.map((item) => `${item.name}=${item.value}`).join("; ");
  const target = new URL("/api/auth/signup/price-guide-preview", baseUrl);
  return await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Cookie: cookie,
        Origin: baseUrl,
        "Sec-Fetch-Site": "same-origin",
        "X-PM-Device-Fingerprint": deviceFingerprint,
        "X-PetManager-Fixture": "korean-price-guide-v1",
        "Content-Type": "multipart/form-data; boundary=p0-v02-boundary",
        "Transfer-Encoding": "chunked",
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, payload: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.on("error", reject);
    const chunk = Buffer.alloc(256 * 1024, 0x61);
    let sent = 0;
    const send = () => {
      if (sent >= 9 * 1024 * 1024 || request.destroyed) return request.end();
      sent += chunk.length;
      if (request.write(chunk)) setImmediate(send);
      else request.once("drain", send);
    };
    send();
  });
}

(async () => {
  mkdirSync(path.dirname(screenshotPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/dev/secure-ai-price-guide-preview`, { waitUntil: "networkidle" });
    const oversizedToken = await token(page);
    const oversized = await page.evaluate(async ({ oversizedToken, deviceFingerprint }) => {
      const formData = new FormData();
      formData.set("file", new File([new Uint8Array(9 * 1024 * 1024)], "oversized.png", { type: "image/png" }));
      const response = await fetch("/api/auth/signup/price-guide-preview", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${oversizedToken}`,
          "X-PM-Device-Fingerprint": deviceFingerprint,
          "X-PetManager-Fixture": "korean-price-guide-v1",
        },
      });
      return { status: response.status, payload: await response.json() };
    }, { oversizedToken, deviceFingerprint });
    assert.equal(oversized.status, 413, JSON.stringify(oversized));
    assert.equal(oversized.payload.code, "REQUEST_BODY_TOO_LARGE");

    const chunkedToken = await token(page);
    const chunked = await chunkedOversize(context, chunkedToken);
    assert.equal(chunked.status, 413, JSON.stringify(chunked));
    assert.equal(chunked.payload.code, "REQUEST_BODY_TOO_LARGE");

    const deleteStatuses = [];
    page.on("response", (response) => {
      if (response.request().method() === "DELETE" && response.url().includes("price-guide-preview")) {
        deleteStatuses.push(response.status());
      }
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await page.getByRole("textbox", { name: "서비스명" }).first().waitFor();
    await page.getByRole("button", { name: "이 내용으로 등록" }).click();
    await page.getByRole("button", { name: "가입 정보 입력" }).waitFor();
    assert.deepEqual(deleteStatuses, [200]);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
    process.stdout.write(JSON.stringify({ contentLengthOversize: 413, chunkedOversize: 413, confirmedPurge: 200, screenshotPath }));
  } finally {
    await context.close();
    await browser.close();
  }
})();
