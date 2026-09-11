const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const baseUrl = "http://127.0.0.1:3100";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "typography-r2");
const routes = [
  ["login", "/login"],
  ["find-email", "/login/find-email"],
  ["reset-password", "/login/reset"],
  ["signup", "/signup"],
  ["owner-preview", "/owner/mobile?preview=1"],
  ["owner-mongshop", "/owner/mobile/mongshop"],
  ["customer-booking", "/demo/book"],
  ["customer-booking-start", "/demo/book/start"],
  ["customer-booking-info", "/demo/book/info"],
  ["customer-booking-manage", "/demo/book/manage"],
  ["billing", "/owner/billing"],
  ["billing-process", "/owner/billing/process"],
  ["billing-success", "/owner/billing/success?plan=monthly&endAt=2026-12-31&method=%EC%B9%B4%EB%93%9C"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["refund", "/refund"],
];
const widths = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [1440, 1024, 430, 390, 320];
const approvedSizes = new Set([12, 13, 14, 16, 18, 20, 24, 28, 32, 40]);
const approvedLines = new Map([[12, 18], [13, 20], [14, 20], [16, 24], [18, 26], [20, 28], [24, 32], [28, 36], [32, 40], [40, 48]]);

async function inspect(page) {
  return page.evaluate(({ sizes, lines }) => {
    const allowedSizes = new Set(sizes);
    const allowedLines = new Map(lines);
    const visible = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      return ownText && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const gaps = [];
    for (const element of visible) {
      const style = getComputedStyle(element);
      const size = Number.parseFloat(style.fontSize);
      const line = Number.parseFloat(style.lineHeight);
      const weight = Number(style.fontWeight);
      const familyOk = style.fontFamily.includes("Pretendard Variable");
      const lineExpected = allowedLines.get(size);
      if (!familyOk || !allowedSizes.has(size) || ![400, 500, 600].includes(weight) || (lineExpected && Math.abs(line - lineExpected) > 0.2)) {
        gaps.push({
          tag: element.tagName.toLowerCase(),
          text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
          className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
          family: style.fontFamily,
          size,
          line,
          weight,
          tracking: style.letterSpacing,
        });
      }
    }
    const controls = [...document.querySelectorAll("button,input,select,textarea,a[href]")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      family: getComputedStyle(document.body).fontFamily,
      gaps: gaps.slice(0, 80),
      undersizedTargets: controls.map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(), text: element.textContent.trim().slice(0, 50), width: rect.width, height: rect.height };
      }).filter((item) => item.width < 44 || item.height < 44).slice(0, 80),
    };
  }, { sizes: [...approvedSizes], lines: [...approvedLines] });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 1100 } });
    for (const [name, route] of routes) {
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`page:${error.message}`));
      try {
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(name === "owner-preview" ? 3000 : 350);
        const audit = await inspect(page);
        const screenshot = path.join(outputDir, `${name}-${width}.png`);
        if ((width === 430 || width === 390) && ["login", "signup", "owner-preview", "owner-mongshop", "customer-booking", "privacy"].includes(name)) {
          await page.screenshot({ path: screenshot, fullPage: true });
        }
        results.push({ name, route, width, httpStatus: response?.status() ?? null, url: page.url(), ...audit, errors });
      } catch (error) {
        results.push({ name, route, width, fatal: error instanceof Error ? error.message : String(error), errors });
      } finally {
        await page.close();
      }
    }
    if (width === 430 || width === 390) {
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("caret-color")) errors.push(`console:${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`page:${error.message}`));
      await page.goto(`${baseUrl}/owner/mobile?preview=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      for (const surface of ["예약 조회", "고객관리", "설정"]) {
        const target = page.getByText(surface, { exact: true }).last();
        if (await target.count()) {
          await target.click();
          await page.waitForTimeout(250);
          const name = `owner-${surface === "예약 조회" ? "bookings" : surface === "고객관리" ? "customers" : "settings"}`;
          await page.screenshot({ path: path.join(outputDir, `${name}-${width}.png`), fullPage: true });
          results.push({ name, route: "/owner/mobile?preview=1", width, ...(await inspect(page)), errors: [...errors] });
        }
      }
      await page.close();
    }
    await context.close();
  }

  const stressContext = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  for (const [mode, css] of [
    ["text-200", "html{font-size:200%!important}"],
    ["text-spacing", "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}"],
  ]) {
    for (const [name, route] of [["login", "/login"], ["signup", "/signup"], ["owner-preview", "/owner/mobile?preview=1"], ["customer-booking", "/demo/book"]]) {
      const page = await stressContext.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`page:${error.message}`));
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(350);
        await page.addStyleTag({ content: css });
        await page.waitForTimeout(100);
        const screenshot = path.join(outputDir, `${name}-${mode}-390.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        results.push({ name, route, width: 390, mode, ...(await inspect(page)), errors });
      } finally {
        await page.close();
      }
    }
  }
  await stressContext.close();
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(results, null, 2));
  const totals = results.reduce((acc, item) => {
    acc.gaps += item.gaps?.length ?? 0;
    acc.overflow += item.documentWidth > item.viewportWidth ? 1 : 0;
    acc.errors += item.errors?.length ?? 0;
    acc.fatal += item.fatal ? 1 : 0;
    return acc;
  }, { gaps: 0, overflow: 0, errors: 0, fatal: 0 });
  console.log(JSON.stringify({ outputDir, routes: results.length, totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
