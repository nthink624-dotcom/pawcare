const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(file, needle, message) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message}\n- file: ${file}\n- missing: ${needle}`);
  }
}

function assertNotIncludes(file, needle, message) {
  const source = read(file);
  if (source.includes(needle)) {
    throw new Error(`${message}\n- file: ${file}\n- forbidden: ${needle}`);
  }
}

function assertFile(relativePath, message) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`${message}\n- missing file: ${relativePath}`);
  }
}

assertIncludes(
  "src/app/api/auth/login/route.ts",
  "getSupabaseAuthClient",
  "Owner password login must verify credentials with the Supabase auth client.",
);
assertIncludes(
  "src/app/api/auth/login/route.ts",
  "signInWithPassword({ email, password })",
  "Owner password login must verify the email and password directly with Supabase Auth.",
);
assertNotIncludes(
  "src/app/api/auth/login/route.ts",
  "loginId",
  "Owner password login must not accept a username-style loginId payload.",
);
assertIncludes(
  "src/app/api/auth/login/route.ts",
  "accessToken",
  "Owner password login must return an access token to the browser.",
);
assertIncludes(
  "src/app/api/auth/login/route.ts",
  "refreshToken",
  "Owner password login must return a refresh token to the browser.",
);

assertIncludes(
  "src/components/auth/login-form.tsx",
  "supabase.auth.setSession",
  "Login form must store the returned Supabase session before redirecting to /owner.",
);
assertIncludes(
  "src/components/auth/login-form.tsx",
  "writeOwnerAuthHandoff",
  "Login form must write a handoff session for the owner page.",
);
assertIncludes(
  "src/components/auth/login-form.tsx",
  "writeOwnerAuthSessionCache",
  "Login form must write an owner auth session cache for API recovery.",
);
assertNotIncludes(
  "src/components/auth/login-form.tsx",
  "lockedUntil:",
  "Login form must not write a local browser lockout that can block valid credentials.",
);

assertIncludes(
  "src/app/owner/page.tsx",
  "consumeOwnerAuthHandoff",
  "Owner page must consume login handoff tokens before checking the stored Supabase session.",
);
assertIncludes(
  "src/app/owner/page.tsx",
  "refreshSession",
  "Owner page must attempt Supabase session refresh before redirecting to /login.",
);
assertIncludes(
  "src/app/owner/page.tsx",
  "readOwnerAuthTokenCache",
  "Owner page must support access-token cache fallback before redirecting to /login.",
);

assertIncludes(
  "src/lib/api.ts",
  "refreshSession",
  "Authenticated API calls must attempt session refresh before failing.",
);
assertIncludes(
  "src/lib/api.ts",
  "readOwnerAuthTokenCache",
  "Authenticated API calls must use owner access-token cache as a final recovery path.",
);

assertFile("scripts/smoke-owner-login.cjs", "Owner login API smoke test must exist.");
assertFile("tests/e2e/owner-login.spec.ts", "Owner login browser E2E test must exist.");

assertIncludes(
  "src/components/auth/signup-form.tsx",
  "identityVerificationToken: verificationToken",
  "General owner signup must submit the completed identity verification token.",
);
assertNotIncludes(
  "src/components/auth/signup-form.tsx",
  "loginId",
  "Owner signup must not expose or submit a username-style loginId.",
);
assertIncludes(
  "src/app/api/auth/signup/route.ts",
  "name: payload.name.trim()",
  "General owner signup must save the verified owner name.",
);
assertIncludes(
  "src/app/api/auth/signup/route.ts",
  "phone_number: payload.phoneNumber",
  "General owner signup must save the verified owner phone number.",
);
assertIncludes(
  "src/app/api/auth/signup/route.ts",
  "identity_verified_at: now",
  "General owner signup must record successful identity verification.",
);
assertIncludes(
  "src/app/api/auth/signup/route.ts",
  "email_confirm: true",
  "Owner signup must allow an identity-verified owner to log in without an email confirmation step.",
);
assertNotIncludes(
  "src/app/api/auth/signup/route.ts",
  "sendOwnerEmailConfirmation",
  "Owner signup must not send an email confirmation as a login gate.",
);
assertIncludes(
  "src/app/api/auth/signup/route.ts",
  "signInWithPassword({ email, password: payload.password })",
  "Owner signup must create a session immediately after the identity-verified account is created.",
);
assertNotIncludes(
  "src/app/api/auth/login/route.ts",
  "email_confirmed_at",
  "Owner login must not block an identity-verified account on email confirmation.",
);
assertFile(
  "src/app/api/owner/account/email/route.ts",
  "Owner settings must provide a protected login-email change endpoint.",
);
assertIncludes(
  "src/app/api/owner/account/email/route.ts",
  "currentPassword",
  "Login email changes must verify the current password.",
);
assertIncludes(
  "src/components/owner-web/owner-profile-settings-panel.tsx",
  "로그인 이메일 변경",
  "Owner profile settings must let the owner correct the login email.",
);
assertIncludes(
  "backend/src/server.ts",
  'app.get("/api/auth/check-email"',
  "The legacy Express server must use the shared email availability endpoint.",
);
assertIncludes(
  "backend/src/server.ts",
  "const email = normalizeOwnerEmail(payload.email);",
  "The legacy Express server must normalize the submitted owner email.",
);
assertNotIncludes(
  "backend/src/server.ts",
  "check-login-id",
  "The legacy Express server must not retain the username availability endpoint.",
);
assertNotIncludes(
  "backend/src/server.ts",
  "buildOwnerAuthEmail",
  "The legacy Express server must not generate virtual owner email aliases.",
);
assertNotIncludes(
  "backend/src/server.ts",
  "payload.loginId",
  "The legacy Express server must not accept a username-style owner payload.",
);
assertNotIncludes(
  "backend/src/lib/auth/owner-credentials.ts",
  "owner.petmanager.local",
  "Legacy owner credentials must not create internal email aliases.",
);
assertNotIncludes(
  "backend/src/lib/auth/owner-credentials.ts",
  "normalizeOwnerLoginId",
  "Legacy owner credentials must not preserve username normalization.",
);
assertIncludes(
  "src/components/owner-web/service-management-screen.tsx",
  "useRef(getServiceFormSignature(initialServiceForm))",
  "The service editor must treat its initial server state as saved and avoid write-on-load.",
);
assertNotIncludes(
  "src/components/owner/owner-shell.tsx",
  "void refreshSummary();\n    window.addEventListener",
  "Owner shell must reuse the fresh subscription summary supplied by the owner page on first render.",
);
assertNotIncludes(
  "src/components/owner-web/owner-web-preview.tsx",
  "fetchOwnerSubscriptionSummary",
  "Owner web preview must reuse the plan summary already loaded by the owner page.",
);
assertIncludes(
  "src/app/owner/page.tsx",
  "void loadSubscription().catch",
  "Owner home must not block its first render on the secondary subscription summary request.",
);
assertNotIncludes(
  "src/app/api/auth/verify-pass/route.ts",
  "/confirm",
  "Browser-based PortOne identity verification must poll the completed result instead of confirming it again.",
);
assertIncludes(
  "src/app/api/auth/verify-pass/route.ts",
  'normalized.includes("unauthorized")',
  "PortOne server API authorization failures must be translated into a useful configuration error.",
);
console.log("OK owner auth guard checks passed");
