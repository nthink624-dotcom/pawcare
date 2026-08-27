import { expect, test } from "@playwright/test";

const email = process.env.OWNER_LOGIN_E2E_EMAIL ?? process.env.OWNER_LOGIN_SMOKE_EMAIL ?? "devowner@petmanager.test";
const password = process.env.OWNER_LOGIN_E2E_PASSWORD ?? process.env.OWNER_LOGIN_SMOKE_PASSWORD ?? "test1234";
const devShopName = "테스트 미용실";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/dev/create-owner");
  expect(response.ok(), await response.text()).toBe(true);
});

test("owner can log in, land on /owner, and keep the session after reload", async ({ page }) => {
  await page.goto("/login");

  await page.evaluate((id) => {
    window.localStorage.setItem(
      `petmanager.failedLogin:${id}`,
      JSON.stringify({
        count: 5,
        lockedUntil: Date.now() + 10 * 60 * 1000,
      }),
    );
  }, email);

  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(password);
  await page.getByTestId("owner-login-submit").click();

  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();
});

test("billing success recovers the API-issued owner handoff without a browser Supabase session", async ({ page }) => {
  await page.goto("/login?next=%2Fowner");
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(password);
  await page.getByTestId("owner-login-submit").click();

  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).filter({ visible: true }).first()).toBeVisible();

  const browserSupabaseSessionCount = await page.evaluate(
    () => Object.keys(window.localStorage).filter((key) => key.startsWith("sb-")).length,
  );
  expect(browserSupabaseSessionCount).toBe(0);

  await page.goto("/owner/billing/success?plan=quarterly&endAt=2026-12-31&method=%EC%B9%B4%EB%93%9C");
  await expect(page.getByRole("heading", { name: "결제가 완료되었습니다" })).toBeVisible();
  await expect(page).toHaveURL(/\/owner\/billing\/success/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "결제가 완료되었습니다" })).toBeVisible();
  await expect(page).toHaveURL(/\/owner\/billing\/success/);

  await page.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).filter({ visible: true }).first()).toBeVisible();
});

test("billing success direct access fails closed when owner recovery credentials are absent", async ({ page }) => {
  await page.goto("/owner/billing/success?plan=quarterly");
  await expect(page).toHaveURL(/\/login\?next=(?:%2F|\/)owner(?:%2F|\/)billing(?:%2F|\/)success/i);
});

test("a failed login clears an existing browser session and does not open owner", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill(password);
  await page.getByTestId("owner-login-submit").click();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);

  await page.goto("/login");
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill("wrong-password");
  await page.getByTestId("owner-login-submit").click();

  await expect(page).toHaveURL(/\/login(?:$|\?)/);
  await expect(page.getByText(/이메일 또는 비밀번호를 다시 확인해 주세요/).first()).toBeVisible();

  await page.goto("/owner");
  await expect(page).toHaveURL(/\/login(?:$|\?)/);
});
