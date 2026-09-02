import { expect, test } from "@playwright/test";

const email = process.env.OWNER_LOGIN_E2E_EMAIL ?? process.env.OWNER_LOGIN_SMOKE_EMAIL ?? "devowner@petmanager.test";
const devShopName = "테스트 미용실";

test("development test owner is ensured without exposing credentials and keeps the session", async ({ page }) => {
  await page.goto("/login");

  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/dev/create-owner") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "검수용 테스트 오너로 시작하기" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const result = (await response.json()) as Record<string, unknown>;
  expect(result.email).toBeUndefined();
  expect(result.password).toBeUndefined();

  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);
  await expect(page.getByText(devShopName).first()).toBeVisible();
});

test("a failed login clears an existing browser session and does not open owner", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "검수용 테스트 오너로 시작하기" }).click();
  await expect(page).toHaveURL(/\/owner(?:$|\?)/);

  await page.goto("/login");
  await page.getByTestId("owner-login-email").fill(email);
  await page.getByTestId("owner-login-password").fill("wrong-password");
  await page.getByTestId("owner-login-submit").click();

  await expect(page).toHaveURL(/\/login(?:$|\?)/);
  const loginError = page.getByText("아이디 또는 비밀번호를 확인해 주세요.", { exact: true });
  await expect(loginError).toHaveAttribute("role", "alert");

  await page.goto("/owner");
  await expect(page).toHaveURL(/\/login(?:$|\?)/);
});
