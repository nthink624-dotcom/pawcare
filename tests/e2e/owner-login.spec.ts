import { expect, test } from "@playwright/test";

const loginId = process.env.OWNER_LOGIN_E2E_ID ?? process.env.OWNER_LOGIN_SMOKE_ID ?? "devowner";
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
  }, loginId);

  await page.getByTestId("owner-login-id").fill(loginId);
  await page.getByTestId("owner-login-password").fill(password);
  await page.getByTestId("owner-login-submit").click();

  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();
});
