const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = "http://127.0.0.1:3000/demo/owner-web";
const outputDir = path.resolve("artifacts/screenshots/staff-inspector-p0");
fs.mkdirSync(outputDir, { recursive: true });

function staffFixture(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `staff-${index + 1}`,
    name: `데모 직원 ${index + 1}`,
    displayName: `직원 ${index + 1}`,
    phone: "",
    role: "디자이너",
    defaultDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const consoleErrors = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
      for (const staffCount of [1, 2, 3, 4]) {
        const page = await browser.newPage({ viewport });
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        await page.goto(baseUrl, { waitUntil: "networkidle" });
        await page.evaluate((fixture) => localStorage.setItem("petmanager.demo.ownerWeb.staffMembers", JSON.stringify(fixture)), staffFixture(staffCount));
        await page.reload({ waitUntil: "networkidle" });
        const surface = page.locator("[data-staff-count]");
        const schedule = surface.locator(":scope > div").first();
        const emptyText = page.getByText("예약을 선택하세요", { exact: true });
        const noSelection = {
          inspectorCount: await page.locator('[aria-label="예약 상세"]').count(),
          emptyTextCount: await emptyText.count(),
          surface: await surface.boundingBox(),
          schedule: await schedule.boundingBox(),
          documentOverflow: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        };
        await page.screenshot({ path: path.join(outputDir, `${viewport.width}-${staffCount}staff-empty.png`) });
        const booking = page.locator("[data-booking-id]").first();
        if (await booking.count()) await booking.click();
        const selectedInspector = page.locator('[aria-label="예약 상세"]');
        const selected = {
          inspectorCount: await selectedInspector.count(),
          inspector: await selectedInspector.boundingBox(),
          selectedTextMatches: await selectedInspector.getByText("보리", { exact: false }).count() > 0,
        };
        await page.screenshot({ path: path.join(outputDir, `${viewport.width}-${staffCount}staff-selected.png`) });
        await page.keyboard.press("Escape");
        const closed = { inspectorCount: await page.locator('[aria-label="예약 상세"]').count() };
        await page.screenshot({ path: path.join(outputDir, `${viewport.width}-${staffCount}staff-closed.png`) });
        results.push({ viewport, staffCount, noSelection, selected, closed });
        await page.close();
      }
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(baseUrl, { waitUntil: "networkidle" });
    await mobile.evaluate((fixture) => localStorage.setItem("petmanager.demo.ownerWeb.staffMembers", JSON.stringify(fixture)), staffFixture(4));
    await mobile.reload({ waitUntil: "networkidle" });
    await mobile.locator("[data-booking-id]").first().click();
    const mobileInspector = await mobile.locator('[aria-label="예약 상세"]').boundingBox();
    results.push({ viewport: { width: 390, height: 844 }, staffCount: 4, mobileInspector, documentOverflow: await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth) });
    await mobile.close();
  } finally {
    await browser.close();
  }

  for (const item of results.filter((item) => item.viewport.width >= 1024 && item.staffCount >= 3 && item.noSelection)) {
    if (item.noSelection.inspectorCount !== 0 || item.noSelection.emptyTextCount !== 0) throw new Error("3+ staff empty inspector regression");
    if (Math.abs(item.noSelection.surface.right - item.noSelection.schedule.right) > 1) throw new Error("3+ staff reserved right gap regression");
    if (item.noSelection.documentOverflow > 0) throw new Error("desktop horizontal overflow");
    if (item.selected.inspectorCount !== 1 || !item.selected.selectedTextMatches || item.closed.inspectorCount !== 0) throw new Error("contextual drawer lifecycle regression");
  }
  for (const item of results.filter((item) => item.viewport.width >= 1024 && item.staffCount <= 2)) {
    if (item.noSelection.inspectorCount !== 1 || item.noSelection.emptyTextCount !== 1) throw new Error("1-2 staff persistent inspector regression");
  }
  const mobileResult = results.at(-1);
  if (!mobileResult.mobileInspector || mobileResult.mobileInspector.width > 390 || mobileResult.documentOverflow > 0) throw new Error("mobile sheet regression");
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify({ baseUrl, results, consoleErrors }, null, 2));
  console.log(JSON.stringify({ cases: results.length, consoleErrors: 0, pass: true }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
