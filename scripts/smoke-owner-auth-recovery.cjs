const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

function assertSafeDevEnvironment() {
  const stage = process.env.SUPABASE_ENV_NAME || process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  if (stage === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run auth recovery smoke against production.");
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

async function cleanup(admin, email, name) {
  const profile = await admin
    .from("owner_profiles")
    .select("user_id, shop_id")
    .eq("login_id", email)
    .maybeSingle();

  const userId = profile.data?.user_id;
  const shopId = profile.data?.shop_id;

  if (shopId) await admin.from("shops").delete().eq("id", shopId);
  await admin.from("owner_profiles").delete().eq("login_id", email);
  await admin.from("owner_identity_verifications").delete().eq("name", name);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

async function main() {
  assertSafeDevEnvironment();

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
    await cleanup(admin, email, identity.name);

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

    const profile = await admin
      .from("owner_profiles")
      .select("user_id, login_id, phone_number")
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

    const findEmailToken = await issueLocalVerificationToken({
      purpose: "find-email",
      identity,
    });
    const findEmail = await postJson("/api/auth/find-email", {
      ...identity,
      identityVerificationToken: findEmailToken,
    });
    expectOk("find email", findEmail.response, findEmail.result);
    if (findEmail.result.email !== email) {
      throw new Error(`find email mismatch: ${findEmail.result.email} !== ${email}`);
    }

    const samePasswordToken = await issueLocalVerificationToken({
      purpose: "reset-password",
      email,
    });
    const samePasswordReset = await postJson("/api/auth/reset-password", {
      email,
      identityVerificationToken: samePasswordToken,
      password: initialPassword,
      passwordConfirm: initialPassword,
    });
    expectFail("same password reset guard", samePasswordReset.response);

    const resetToken = await issueLocalVerificationToken({
      purpose: "reset-password",
      email,
    });
    const reset = await postJson("/api/auth/reset-password", {
      email,
      identityVerificationToken: resetToken,
      password: newPassword,
      passwordConfirm: newPassword,
    });
    expectOk("password reset", reset.response, reset.result);

    const oldLogin = await apiLogin(email, initialPassword);
    expectFail("old password login after reset", oldLogin.response);

    const newLogin = await apiLogin(email, newPassword);
    expectOk("new password login after reset", newLogin.response, newLogin.result);

    const directNewLogin = await authClient.auth.signInWithPassword({
      email,
      password: newPassword,
    });
    if (directNewLogin.error || directNewLogin.data.user?.id !== profile.data.user_id) {
      throw new Error(`direct Supabase login with reset password failed: ${directNewLogin.error?.message}`);
    }

    const directOldLogin = await authClient.auth.signInWithPassword({
      email,
      password: initialPassword,
    });
    if (!directOldLogin.error) {
      throw new Error("direct Supabase login with old password unexpectedly succeeded");
    }

    console.log(`OK owner auth recovery smoke passed for ${email} at ${baseUrl}`);
  } finally {
    await cleanup(admin, email, identity.name);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
