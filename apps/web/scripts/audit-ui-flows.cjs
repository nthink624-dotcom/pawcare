const { chromium, expect } = require("@playwright/test");

const baseUrl = process.env.CLICK_AUDIT_BASE_URL || "http://127.0.0.1:3000";

async function runReservationAddFlow(page) {
  await page.goto(`${baseUrl}/demo/owner-web`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  await page.getByRole("button", { name: "다음 날짜" }).click();
  await page.getByRole("button", { name: /예약 추가/ }).click();
  await expect(page.getByText("고객 등록 방식")).toBeVisible();

  await page.getByLabel("고객명").fill("우진");
  await page.getByLabel("반려동물 이름").fill("오오");
  await page.getByLabel("고객 연락처").fill("01012345678");
  await expect(page.getByLabel("고객 연락처")).toHaveValue("010-1234-5678");

  const timeButton = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
  if (await timeButton.isVisible().catch(() => false)) {
    await timeButton.click();
    await expect(page.getByRole("button", { name: "예약 등록" })).toBeEnabled();
  } else {
    await expect(page.getByRole("button", { name: "예약 등록" })).toBeDisabled();
  }

  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("고객 등록 방식")).toBeHidden();
}

async function runReservationPersistentPanelFlow(page) {
  await page.goto(`${baseUrl}/demo/owner-web`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  const sidePanel = page.locator("aside").last();
  const beforeText = await sidePanel.innerText();
  const confirmedCard = page.locator("[data-booking-id]").filter({ hasText: /확정/ }).first();
  const cardText = await confirmedCard.innerText();
  const petName = cardText.split(/\s+/).find(Boolean) || "";
  await confirmedCard.click();
  await expect(page.getByText("예약 작업 패널")).toBeHidden();
  await expect.poll(async () => sidePanel.innerText()).not.toBe(beforeText);
  if (petName && !(await sidePanel.innerText()).includes(petName)) {
    throw new Error(`Persistent side panel did not show selected booking: ${petName}`);
  }

  const pendingCard = page.locator("button").filter({ hasText: /승인대기/ }).first();
  if (await pendingCard.isVisible().catch(() => false)) {
    await pendingCard.click();
    await expect.poll(async () => sidePanel.innerText()).not.toBe(beforeText);
  }
}

async function runStaffScheduleFlow(page) {
  await page.goto(`${baseUrl}/demo/owner-web`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  await page.getByRole("button", { name: "직원 관리" }).click();
  await expect(page.getByRole("button", { name: "주간 근무표" })).toBeVisible();

  await page.getByRole("button", { name: "주간 근무표" }).click();
  const scheduleCell = page.getByRole("button", { name: /^\d{2}:\d{2}-\d{2}:\d{2}$/ }).first();
  if (!(await scheduleCell.isVisible().catch(() => false))) {
    const buttons = await page.locator("button").evaluateAll((items) => items.map((item) => item.innerText || item.getAttribute("aria-label") || ""));
    throw new Error(`No visible schedule cell. Buttons: ${JSON.stringify(buttons)}`);
  }
  await scheduleCell.click();

  await expect(page.getByText("이날 일정")).toBeVisible();
  await page.getByRole("button", { name: /반복 근무 기준/ }).click();
  await expect(page.getByText("반복 근무 요일")).toBeVisible();

  await page.locator("button").filter({ hasText: /^월$/ }).first().click();
  await page.getByRole("button", { name: /반복 근무 기준/ }).click();
  await expect(page.getByText("반복 근무 요일")).toBeHidden();

  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByText("이날 일정")).toBeHidden();
}

async function runCustomerSavedPetFlow(page) {
  await page.goto(`${baseUrl}/demo/book/start`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  const savedPet = page.getByRole("button", { name: /우유/ }).first();
  if (await savedPet.isVisible().catch(() => false)) {
    await savedPet.click();
    await expect(page.getByText("아기 이름")).toBeHidden();
    await page.getByRole("button", { name: /\+ 새 아이 입력/ }).click();
    await expect(page.getByText("아기 이름")).toBeVisible();
  }
}

async function runLoginVisibilityFlow(page) {
  await page.goto(`${baseUrl}/owner/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  const password = page.locator("input[type='password']").first();
  await expect(password).toBeVisible();
  await page.getByRole("button", { name: "비밀번호 보기" }).click();
  await expect(page.locator("input[type='text']").first()).toBeVisible();
}

async function runCustomerDateFlow(page) {
  await page.goto(`${baseUrl}/demo/book`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});

  const before = await page.locator("body").innerText();
  await page.getByRole("button", { name: "다음 날짜 보기" }).click();
  await page.waitForTimeout(250);
  const after = await page.locator("body").innerText();
  if (before === after) {
    throw new Error("Customer next-date button did not update visible page text.");
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.setDefaultTimeout(6000);

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await runReservationAddFlow(page);
    console.log("FLOW reservation-add ok");

    await runReservationPersistentPanelFlow(page);
    console.log("FLOW reservation-persistent-panel ok");

    await runStaffScheduleFlow(page);
    console.log("FLOW staff-schedule ok");

    await runCustomerSavedPetFlow(page);
    console.log("FLOW customer-saved-pet ok");

    await runLoginVisibilityFlow(page);
    console.log("FLOW login-password-toggle ok");

    await runCustomerDateFlow(page);
    console.log("FLOW customer-date-navigation ok");
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.log(JSON.stringify({ pageErrors: errors }, null, 2));
    process.exitCode = 1;
  }
})();
