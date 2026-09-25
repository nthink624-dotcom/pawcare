const { chromium } = require("@playwright/test");

const baseUrl = process.env.CLICK_AUDIT_BASE_URL || "http://127.0.0.1:3000";
const argvRoutes = process.argv.slice(2).filter(Boolean);

const defaultRoutes = [
  "/owner/web-preview",
  "/demo/owner-web",
  "/entry/demo-shop",
  "/demo/book",
  "/demo/book/start",
  "/demo/book/manage",
  "/owner/login",
  "/signup",
];

const routes = argvRoutes.length ? argvRoutes : defaultRoutes;

const selector = [
  "button",
  "[role='button']",
  "select",
  "summary",
  "input[type='checkbox']",
  "input[type='radio']",
  "a[href]",
].join(", ");

const dangerousWords = [
  "\uc0ad\uc81c",
  "\ud0c8\ud1f4",
  "\ub85c\uadf8\uc544\uc6c3",
  "\ucd08\uae30\ud654",
  "\ub4f1\ub85d",
  "\uc800\uc7a5",
  "\ud655\uc815",
  "\uac70\uc808",
  "\ucde8\uc18c",
  "\ud658\ubd88",
  "\uacb0\uc81c",
  "\ubc1c\uc1a1",
  "\ubcf4\ub0b4\uae30",
  "\uc2b9\uc778",
  "\ubbf8\uc2b9\uc778",
  "\uc7ac\uc2dc\ub3c4",
  "\uc885\ub8cc",
  "\ub2eb\uae30",
];

const safeNoopWords = [
  "\uc624\ub298",
];

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function isDangerous(name) {
  const text = cleanText(name);
  if (!text) return true;
  return dangerousWords.some((word) => text.includes(word));
}

function isExpectedNoop(name) {
  const text = cleanText(name);
  return safeNoopWords.some((word) => text === word);
}

async function collectCandidates(page) {
  return page.locator(selector).evaluateAll((elements) => {
    const tagCounts = {};
    return elements.map((element, index) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const aria = element.getAttribute("aria-label") || "";
      const title = element.getAttribute("title") || "";
      const text = element.innerText || element.textContent || "";
      const placeholder = element.getAttribute("placeholder") || "";
      const role = element.getAttribute("role") || "";
      const href = element.getAttribute("href") || "";
      const tag = element.tagName.toLowerCase();
      const type = element.getAttribute("type") || "";
      const scopedKey = `${tag}:${type || role || ""}`;
      const scopedIndex = tagCounts[scopedKey] || 0;
      tagCounts[scopedKey] = scopedIndex + 1;
      const disabled = Boolean(element.disabled || element.getAttribute("aria-disabled") === "true");
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.pointerEvents !== "none";

      return {
        index,
        aria,
        title,
        text,
        placeholder,
        role,
        href,
        tag,
        type,
        scopedKey,
        scopedIndex,
        visible,
        disabled,
      };
    });
  });
}

async function loadRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function firstVisible(locator, timeout = 500) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible({ timeout }).catch(() => false)) {
      return item;
    }
  }
  return locator.first();
}

async function auditRoute(browser, route) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.setDefaultTimeout(2500);

  const errors = [];
  const results = [];
  const seenConsoleErrors = new Set();

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (seenConsoleErrors.has(text)) return;
    seenConsoleErrors.add(text);
    errors.push(`console: ${text}`);
  });

  try {
    await loadRoute(page, route);
  } catch (error) {
    await page.close();
    return { route, loadError: error.message, errors, results };
  }

  const originalUrl = page.url();
  const rawCandidates = await collectCandidates(page);
  const candidates = rawCandidates
    .map((candidate) => ({
      ...candidate,
      name: cleanText(
        candidate.aria ||
          candidate.title ||
          candidate.text ||
          candidate.placeholder ||
          `${candidate.tag}:${candidate.type || candidate.role || candidate.index}`,
      ),
    }))
    .filter((candidate) => candidate.visible && !candidate.disabled)
    .filter((candidate) => !isDangerous(candidate.name))
    .filter((candidate) => {
      if (candidate.tag !== "a") return true;
      if (!candidate.href || candidate.href.startsWith("#")) return true;
      return candidate.href.startsWith("/") && !candidate.href.includes("logout");
    })
    .slice(0, Number(process.env.CLICK_AUDIT_MAX || 45));

  console.error(`[click-audit] ${route}: ${candidates.length}/${rawCandidates.length} safe visible controls`);

  for (const candidate of candidates) {
    const clickPage = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    clickPage.setDefaultTimeout(2500);

    clickPage.on("pageerror", (error) => {
      errors.push(`pageerror: ${error.message}`);
    });
    clickPage.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (seenConsoleErrors.has(text)) return;
      seenConsoleErrors.add(text);
      errors.push(`console: ${text}`);
    });

    try {
      await loadRoute(clickPage, route);

      let item;
      if (candidate.name && candidate.tag === "a") {
        item = await firstVisible(clickPage.getByRole("link", { name: candidate.name }));
      } else if (candidate.name && (candidate.tag === "button" || candidate.role === "button")) {
        item = await firstVisible(clickPage.getByRole("button", { name: candidate.name }));
      } else if (candidate.tag === "select") {
        item = clickPage.locator("select").nth(candidate.scopedIndex);
      } else if (candidate.tag === "input" && candidate.type === "checkbox") {
        item = clickPage.locator("input[type='checkbox']").nth(candidate.scopedIndex);
      } else if (candidate.tag === "input" && candidate.type === "radio") {
        item = clickPage.locator("input[type='radio']").nth(candidate.scopedIndex);
      } else {
        item = clickPage.locator(selector).nth(candidate.index);
      }

      if (!(await item.isVisible({ timeout: 700 }).catch(() => false))) {
        results.push({ name: candidate.name, tag: candidate.tag, ok: false, error: "not visible on retry" });
        await clickPage.close();
        continue;
      }

      const beforeUrl = clickPage.url();
      const beforeExpanded = await item.getAttribute("aria-expanded").catch(() => null);
      const beforeChecked = await item.isChecked().catch(() => null);
      const beforeBody = await clickPage.locator("body").evaluate((body) => body.innerText.length).catch(() => 0);

      await item.click({ timeout: 1400 });
      await clickPage.waitForTimeout(220);

      const afterUrl = clickPage.url();
      const afterExpanded = await item.getAttribute("aria-expanded").catch(() => null);
      const afterChecked = await item.isChecked().catch(() => null);
      const afterBody = await clickPage.locator("body").evaluate((body) => body.innerText.length).catch(() => 0);

      const changed =
        beforeUrl !== afterUrl ||
        beforeExpanded !== afterExpanded ||
        beforeChecked !== afterChecked ||
        Math.abs(beforeBody - afterBody) > 3 ||
        isExpectedNoop(candidate.name);

      results.push({
        name: candidate.name,
        tag: candidate.tag,
        ok: true,
        changed,
        urlChanged: beforeUrl !== afterUrl,
      });

      await clickPage.close();
    } catch (error) {
      results.push({
        name: candidate.name,
        tag: candidate.tag,
        ok: false,
        error: error.message,
      });
      await clickPage.close().catch(() => {});
    }
  }

  await page.close();
  return { route, errors, results };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const summaries = [];

  try {
    for (const route of routes) {
      console.error(`[click-audit] start ${route}`);
      const result = await auditRoute(browser, route);
      const failures = result.results.filter((item) => !item.ok);
      const suspicious = result.results.filter((item) => item.ok && !item.changed);
      const summary = {
        route: result.route,
        loadError: result.loadError,
        clicked: result.results.length,
        failures,
        pageErrors: result.errors,
        suspicious,
      };
      summaries.push(summary);
      console.log(`AUDIT_ROUTE ${JSON.stringify(summary)}`);
      console.error(`[click-audit] done ${route}`);
    }
  } finally {
    await browser.close();
  }

  const failures = summaries.flatMap((summary) => summary.failures.map((item) => ({ route: summary.route, ...item })));
  const loadErrors = summaries.filter((summary) => summary.loadError);
  const pageErrors = summaries.flatMap((summary) => summary.pageErrors.map((error) => ({ route: summary.route, error })));

  console.log(JSON.stringify({ summaries, failures, loadErrors, pageErrors }, null, 2));

  if (failures.length || loadErrors.length || pageErrors.length) {
    process.exitCode = 1;
  }
})();
