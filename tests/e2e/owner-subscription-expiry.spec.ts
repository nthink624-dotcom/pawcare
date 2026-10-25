import { expect, test, type Page } from "@playwright/test";

async function seedOwnerAccessToken(page: Page) {
  await page.addInitScript(() => {
    const tokenCache = JSON.stringify({
      accessToken: "test-owner-access-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    window.localStorage.setItem("petmanager.ownerAuthTokenCache", tokenCache);
    window.sessionStorage.setItem("petmanager.ownerAuthTokenCache", tokenCache);
  });
}

function trackRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("expired owners see the renewal screen from a protected owner route", async ({ page }) => {
  let bootstrapRequestCount = 0;
  const runtimeErrors = trackRuntimeErrors(page);

  await seedOwnerAccessToken(page);

  await page.route("**/api/subscription", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        userId: "test-owner",
        shopId: "test-shop",
        status: "expired",
        currentPlanCode: "monthly",
        trialEndsAt: "2026-07-14T00:00:00.000Z",
        currentPeriodEndsAt: "2026-07-27T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/bootstrap**", async (route) => {
    bootstrapRequestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto("/owner/alimtalk-credits");

  await expect(page.getByRole("heading", { name: /서비스 이용 기간이\s*종료되었습니다/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "서비스 기간 연장하기" })).toHaveAttribute(
    "href",
    /\/owner\/billing\?.*notice=expired/,
  );
  expect(bootstrapRequestCount).toBe(0);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: /서비스 이용 기간이\s*종료되었습니다/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});

test("active owners continue to the requested owner route", async ({ page }) => {
  let bootstrapRequestCount = 0;
  const runtimeErrors = trackRuntimeErrors(page);

  await seedOwnerAccessToken(page);

  await page.route("**/api/subscription", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        userId: "test-owner",
        shopId: "test-shop",
        status: "active",
        currentPlanCode: "monthly",
      }),
    });
  });

  await page.route("**/api/bootstrap**", async (route) => {
    bootstrapRequestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        alimtalkCreditSummary: {
          remaining_total: 120,
          included_remaining: 100,
          purchased_remaining: 20,
        },
      }),
    });
  });

  await page.goto("/owner/alimtalk-credits");

  await expect(
    page.getByRole("heading", { name: "추가 발송 이용권 판매가 종료되었습니다" }),
  ).toBeVisible();
  expect(bootstrapRequestCount).toBe(0);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "추가 발송 이용권 판매가 종료되었습니다" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});
