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

console.log("OK owner auth guard checks passed");
