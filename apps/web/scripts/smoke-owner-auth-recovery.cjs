const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("@playwright/test");

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const baseUrl = (process.env.OWNER_AUTH_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

function assertSafeTestEnvironment() {
  const stage = process.env.SUPABASE_ENV_NAME || process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  if (stage !== "test" || process.env.VERCEL_ENV === "production") {
    throw new Error("Destructive auth recovery smoke requires a dedicated SUPABASE_ENV_NAME=test project.");
  }

  if (siteUrl && !siteUrl.includes("127.0.0.1") && !siteUrl.includes("localhost")) {
    throw new Error(`Refusing to run auth recovery smoke with non-local NEXT_PUBLIC_SITE_URL: ${siteUrl}`);
  }
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) return `0${digits.slice(2)}`.slice(0, 11);
  return digits.slice(0, 11);
}

function uniqueDigits(length) {
  return String(Date.now()).slice(-length).padStart(length, "0");
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function postJson(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await readJson(response);
  return { response, result };
}

async function patchJson(pathname, body, accessToken) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const result = await readJson(response);
  return { response, result };
}

function expectOk(label, response, result) {
  if (!response.ok || result?.success === false) {
    throw new Error(`${label} failed (${response.status}): ${result?.message || JSON.stringify(result)}`);
  }
}

function expectFail(label, response) {
  if (response.ok) {
    throw new Error(`${label} unexpectedly succeeded`);
  }
}

async function issueLocalVerificationToken({ purpose, identity, email }) {
  const requestPayload = {
    purpose,
    method: "local",
    email,
    name: identity?.name,
    birthDate: identity?.birthDate,
    phoneNumber: identity?.phoneNumber,
  };
  const requested = await postJson("/api/auth/request-verification-code", requestPayload);
  expectOk(`${purpose} verification request`, requested.response, requested.result);

  if (!requested.result.verificationRequestId || !requested.result.devVerificationCode) {
    throw new Error(`${purpose} verification did not return a development code`);
  }

  const verified = await postJson("/api/auth/verify-identity", {
    purpose,
    verificationRequestId: requested.result.verificationRequestId,
    email,
    name: identity?.name,
    birthDate: identity?.birthDate,
    phoneNumber: identity?.phoneNumber,
    code: requested.result.devVerificationCode,
  });
  expectOk(`${purpose} verification complete`, verified.response, verified.result);

  if (!verified.result.verificationToken) {
    throw new Error(`${purpose} verification did not return a token`);
  }

  return verified.result.verificationToken;
}

async function apiLogin(email, password) {
  return postJson("/api/auth/login", { email, password });
}

async function verifyFailedBrowserLoginClearsSession(email, password) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const login = await apiLogin(email, password);
    expectOk("browser session setup login", login.response, login.result);
    const session = login.result.session;
    if (!session?.accessToken || !session.refreshToken) {
      throw new Error("browser session setup did not return a session");
    }

    await page.evaluate((sessionPayload) => {
      const expiresAt = Date.now() + 30 * 60 * 1000;
      const tokenCache = JSON.stringify({
        accessToken: sessionPayload.accessToken,
        refreshToken: sessionPayload.refreshToken,
        expiresAt,
      });
      const handoff = JSON.stringify(sessionPayload);
      window.localStorage.setItem("petmanager.ownerAuthTokenCache", tokenCache);
      window.sessionStorage.setItem("petmanager.ownerAuthTokenCache", tokenCache);
      window.localStorage.setItem("petmanager.ownerAuthHandoff", handoff);
      window.sessionStorage.setItem("petmanager.ownerAuthHandoff", handoff);
    }, session);

    await page.getByTestId("owner-login-email").fill(email);
    await page.getByTestId("owner-login-password").fill("wrong-password");
    await page.getByTestId("owner-login-submit").click();

    await page.waitForTimeout(300);
    if (new URL(page.url()).pathname !== "/login") {
      throw new Error(`failed browser login unexpectedly navigated to ${page.url()}`);
    }

    const pageText = await page.locator("body").innerText();
    if (!pageText.includes("이메일") || !pageText.includes("비밀번호")) {
      throw new Error("failed browser login did not show the credential error");
    }

    const cachedAuthState = await page.evaluate(() => ({
      handoff: window.localStorage.getItem("petmanager.ownerAuthHandoff"),
      tokenCache: window.localStorage.getItem("petmanager.ownerAuthTokenCache"),
    }));
    if (cachedAuthState.handoff || cachedAuthState.tokenCache) {
      throw new Error(`failed browser login did not clear the previous auth state: ${JSON.stringify(cachedAuthState)}`);
    }

    await page.goto(`${baseUrl}/owner`, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login", { timeout: 20_000 });
  } finally {
    await browser.close();
  }
}

async function cleanup(admin, emails, name) {
  let userId;
  let shopId;
  for (const email of emails) {
    const profile = await admin
      .from("owner_profiles")
      .select("user_id, shop_id")
      .eq("login_id", email)
      .maybeSingle();

    userId ||= profile.data?.user_id;
    shopId ||= profile.data?.shop_id;
    await admin.from("owner_profiles").delete().eq("login_id", email);
  }

  if (shopId) await admin.from("shops").delete().eq("id", shopId);
  await admin.from("owner_identity_verifications").delete().eq("name", name);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

async function main() {
  assertSafeTestEnvironment();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    throw new Error("Supabase local development environment is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = uniqueDigits(8);
  const email = `smoke${suffix}@petmanager.test`;
  const updatedEmail = `smoke${suffix}changed@petmanager.test`;
  const initialPassword = "Aa1234!";
  const newPassword = "Bb5678!";
  const identity = {
    name: `Auth Smoke ${suffix}`,
    birthDate: "19900101",
    phoneNumber: `8210${suffix}`,
  };
  const normalizedPhone = normalizePhone(identity.phoneNumber);
  const shopName = `Auth Smoke Shop ${suffix}`;

  try {
    await cleanup(admin, [email, updatedEmail], identity.name);

    const signupToken = await issueLocalVerificationToken({
      purpose: "signup",
      identity,
    });

    const signup = await postJson("/api/auth/signup", {
      email,
      password: initialPassword,
      passwordConfirm: initialPassword,
      name: identity.name,
      birthDate: identity.birthDate,
      phoneNumber: identity.phoneNumber,
      identityVerificationToken: signupToken,
      shopName,
      shopPhone: identity.phoneNumber,
      shopAddress: "Seoul Auth Smoke 1",
      agreements: { service: true, privacy: true, location: false, marketing: false },
    });
    expectOk("signup", signup.response, signup.result);
    if (!signup.result.session?.accessToken || !signup.result.session?.refreshToken) {
      throw new Error("signup did not return an immediate login session");
    }

    const profile = await admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id, phone_number")
      .eq("login_id", email)
      .maybeSingle();
    if (profile.error || !profile.data?.user_id) {
      throw new Error(`profile lookup failed: ${profile.error?.message || "missing profile"}`);
    }
    if (profile.data.phone_number !== normalizedPhone) {
      throw new Error(`phone normalization failed: ${profile.data.phone_number} !== ${normalizedPhone}`);
    }

    const createdUser = await admin.auth.admin.getUserById(profile.data.user_id);
    if (createdUser.error || createdUser.data.user?.email !== email) {
      throw new Error(`email signup failed: ${createdUser.data.user?.email || createdUser.error?.message}`);
    }

    const initialLogin = await apiLogin(email, initialPassword);
    expectOk("initial login", initialLogin.response, initialLogin.result);
    if (!initialLogin.result.session?.accessToken || !profile.data.shop_id) {
      throw new Error("initial login did not return an access token or profile shop id");
    }

    await verifyFailedBrowserLoginClearsSession(email, initialPassword);

    const emailChange = await patchJson(
      "/api/owner/account/email",
      {
        shopId: profile.data.shop_id,
        email: updatedEmail,
        currentPassword: initialPassword,
      },
      initialLogin.result.session.accessToken,
    );
    expectOk("login email change", emailChange.response, emailChange.result);
    if (emailChange.result.profile?.login_id !== updatedEmail) {
      throw new Error(`login email change mismatch: ${emailChange.result.profile?.login_id}`);
    }

    const oldEmailLogin = await apiLogin(email, initialPassword);
    expectFail("old email login after email change", oldEmailLogin.response);

    const changedEmailLogin = await apiLogin(updatedEmail, initialPassword);
    expectOk("changed email login", changedEmailLogin.response, changedEmailLogin.result);

    const findEmailToken = await issueLocalVerificationToken({
      purpose: "find-email",
      identity,
    });
    const findEmail = await postJson("/api/auth/find-email", {
      identityVerificationToken: findEmailToken,
    });
    expectOk("find email", findEmail.response, findEmail.result);
    if (findEmail.result.email !== updatedEmail) {
      throw new Error(`find email mismatch: ${findEmail.result.email} !== ${updatedEmail}`);
    }

    const samePasswordToken = await issueLocalVerificationToken({
      purpose: "reset-password",
      email: updatedEmail,
    });
    const samePasswordReset = await postJson("/api/auth/reset-password", {
      email: updatedEmail,
      identityVerificationToken: samePasswordToken,
      password: initialPassword,
      passwordConfirm: initialPassword,
    });
    expectFail("same password reset guard", samePasswordReset.response);

    const resetToken = await issueLocalVerificationToken({
      purpose: "reset-password",
      email: updatedEmail,
    });
    const reset = await postJson("/api/auth/reset-password", {
      email: updatedEmail,
      identityVerificationToken: resetToken,
      password: newPassword,
      passwordConfirm: newPassword,
    });
    expectOk("password reset", reset.response, reset.result);

    const oldLogin = await apiLogin(updatedEmail, initialPassword);
    expectFail("old password login after reset", oldLogin.response);

    const newLogin = await apiLogin(updatedEmail, newPassword);
    expectOk("new password login after reset", newLogin.response, newLogin.result);

    const directNewLogin = await authClient.auth.signInWithPassword({
      email: updatedEmail,
      password: newPassword,
    });
    if (directNewLogin.error || directNewLogin.data.user?.id !== profile.data.user_id) {
      throw new Error(`direct Supabase login with reset password failed: ${directNewLogin.error?.message}`);
    }

    const directOldLogin = await authClient.auth.signInWithPassword({
      email: updatedEmail,
      password: initialPassword,
    });
    if (!directOldLogin.error) {
      throw new Error("direct Supabase login with old password unexpectedly succeeded");
    }

    console.log(`OK owner auth recovery smoke passed for ${updatedEmail} at ${baseUrl}`);
  } finally {
    await cleanup(admin, [email, updatedEmail], identity.name);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
