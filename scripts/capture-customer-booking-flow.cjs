const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const baseUrl = process.env.PM_CAPTURE_URL || "http://127.0.0.1:3000/entry/shop-4d57f170";
const outDir = path.join(process.cwd(), "captures", "customer-booking-flow");

async function clickFirst(page, candidates) {
  for (const candidate of candidates) {
    const locator = typeof candidate === "string" ? page.getByText(candidate, { exact: false }) : candidate;
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      await locator.first().click();
      return true;
    }
  }
  return false;
}

async function clickLastVisibleButtonByText(page, texts) {
  const clicked = await page.evaluate((texts) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const visibleButtons = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !button.disabled;
    });
    const target = visibleButtons.reverse().find((button) => texts.some((text) => button.innerText.includes(text)));
    if (!target) return false;
    target.click();
    return true;
  }, texts);
  await page.waitForTimeout(700);
  return clicked;
}

async function clickFirstVisibleButtonByPattern(page, patternSource) {
  const clicked = await page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource);
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !button.disabled && pattern.test(button.innerText);
    });
    if (!target) return false;
    target.click();
    return true;
  }, patternSource);
  await page.waitForTimeout(700);
  return clicked;
}

async function fillInputs(page, values) {
  const inputs = page.locator("input:visible");
  const count = await inputs.count();
  for (let index = 0; index < Math.min(count, values.length); index += 1) {
    await inputs.nth(index).fill(values[index]);
  }
}

async function waitForStable(page) {
  await page.waitForTimeout(1200);
  await page.locator("text=Compiling").waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [data-next-badge-root],
      .nextjs-toast-errors-parent {
        display: none !important;
      }
    `,
  }).catch(() => undefined);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
  }).catch(() => undefined);
}

async function screenshot(page, name) {
  await waitForStable(page);
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await screenshot(page, "01-customer-front.png");

  await clickFirst(page, ["예약하기", page.locator("a[href*='/book/']").first()]);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await screenshot(page, "02-reservation-info.png");

  await fillInputs(page, ["정우진", "010-8498-2077", "우유", "말티즈"]);
  await clickLastVisibleButtonByText(page, ["다음"]);
  await page.waitForTimeout(700);
  await screenshot(page, "03-service-select.png");

  await clickFirstVisibleButtonByPattern(page, "전체|스포팅|위생|클리핑|가위|목욕");
  await clickLastVisibleButtonByText(page, ["다음"]);
  await page.waitForTimeout(900);

  await clickFirstVisibleButtonByPattern(page, "빠른 선택|원장|정우진|디자이너");
  const dateButtons = page.locator("button[data-date-value]");
  if ((await dateButtons.count()) > 0) {
    await dateButtons.first().click();
  }
  await page.waitForTimeout(900);
  await clickFirstVisibleButtonByPattern(page, "\\d{1,2}:\\d{2}");
  await screenshot(page, "04-designer-date-time.png");

  await clickLastVisibleButtonByText(page, ["예약 요청", "예약하기"]);
  await page.waitForTimeout(7000);
  await page.getByText("최종 확인", { exact: false }).waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  await screenshot(page, "05-complete.png");

  await browser.close();
  console.log(outDir);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
