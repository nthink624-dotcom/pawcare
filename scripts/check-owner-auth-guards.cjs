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
  "buildOwnerAuthEmailCandidates",
  "Owner password login must try current and legacy auth email candidates.",
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
assertNotIncludes(
  "src/components/auth/social-signup-complete-form.tsx",
  "if (!email.trim())",
  "Social signup completion must not require an email for Naver or Kakao owners.",
);
assertNotIncludes(
  "src/components/auth/social-signup-complete-form.tsx",
  "const AGREEMENTS =",
  "Social signup completion must not hard-code owner agreement consent.",
);
assertIncludes(
  "src/components/auth/social-signup-complete-form.tsx",
  "SocialSignupRequiredTerms",
  "Google social signup completion must collect required PetManager terms.",
);
assertIncludes(
  "src/components/auth/social-signup-complete-form.tsx",
  'const isKakaoSignup = resolvedProvider === "kakao";',
  "Kakao Simple Signup must keep owner name and phone out of the manual completion form.",
);
assertIncludes(
  "src/components/auth/social-signup-complete-form.tsx",
  "{!isKakaoSignup ? (",
  "Only non-Kakao signup completion may render owner name and phone fields.",
);
assertIncludes(
  "src/components/auth/login-form.tsx",
  'scopes: provider === "kakao" ? "name,phone_number" : undefined',
  "Kakao OAuth must request the approved owner name and phone number scopes.",
);
assertIncludes(
  "src/app/auth/client-callback/client-callback.tsx",
  'fetch("/api/auth/kakao-profile"',
  "Kakao OAuth callback must hydrate the verified Kakao owner profile before signup completion.",
);
assertFile(
  "src/app/api/auth/kakao-profile/route.ts",
  "Kakao profile hydration API must exist.",
);
assertIncludes(
  "src/app/api/auth/kakao-profile/route.ts",
  'JSON.stringify(["kakao_account.name", "kakao_account.phone_number"])',
  "Kakao profile hydration must request only the required owner name and phone number.",
);
assertIncludes(
  "src/app/api/auth/social-complete/route.ts",
  'provider === "kakao" ? providerOwnerName',
  "Kakao owner names must come from verified Kakao auth metadata.",
);
assertIncludes(
  "src/app/api/auth/social-complete/route.ts",
  'provider === "kakao" ? providerPhoneNumber || null',
  "Kakao owner phone numbers must come from verified Kakao auth metadata.",
);
assertIncludes(
  "src/lib/auth/social-signup-consent.ts",
  'process.env.NEXT_PUBLIC_KAKAO_SIMPLE_SIGNUP_ENABLED === "true"',
  "Kakao Simple Signup must stay feature-gated until the production Kakao app cutover is complete.",
);
assertIncludes(
  "src/lib/auth/social-signup-consent.ts",
  'if (provider === "kakao") return !kakaoSimpleSignupEnabled;',
  "Kakao owners must keep the in-app PetManager terms until Kakao Simple Signup is enabled.",
);
assertIncludes(
  "src/lib/auth/social-signup-consent.ts",
  '"kakao_simple_signup"',
  "Kakao social signup must retain Kakao Simple Signup as its consent source.",
);
assertIncludes(
  "src/app/api/auth/social-complete/route.ts",
  "resolveSocialSignupAgreements(provider, payload.agreements)",
  "The social signup API must derive effective agreements from the verified auth provider.",
);
assertIncludes(
  "src/app/api/auth/social-complete/route.ts",
  "resolveSocialConsentSource(provider)",
  "The social signup API must retain the consent source for audit records.",
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
assertNotIncludes(
  "src/app/api/auth/social-complete/route.ts",
  "payload.termsVersion",
  "The social signup API must use the server-owned current terms version.",
);
assertNotIncludes(
  "src/app/api/auth/naver-profile/route.ts",
  "email_confirm: true",
  "Naver profile hydration must not persist a contact email.",
);
assertIncludes(
  "src/app/api/auth/naver-profile/route.ts",
  "Boolean(name && /^01\\d{8,9}$/.test(phone))",
  "Naver profile hydration must require only the owner name and mobile phone number.",
);

console.log("OK owner auth guard checks passed");
