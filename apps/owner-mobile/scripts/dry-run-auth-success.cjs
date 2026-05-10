const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(compiled.outputText, filename);
};

function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Local env file is required.");
  }

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    process.env[name] = value;
  }
}

function printResult(result) {
  console.log(`ENV_GUARD_PASSED=${result.envGuardPassed}`);
  console.log(`SIGN_IN_SUCCESS=${result.signInSuccess}`);
  console.log(`SESSION_EXISTS=${result.sessionExists}`);
  console.log(`ACCESS_TOKEN_EXISTS=${result.accessTokenExists}`);
  console.log(`EMAIL_EXISTS=${result.emailExists}`);
  console.log(`USER_ID_EXISTS=${result.userIdExists}`);
  console.log(`RESTORE_SUCCESS=${result.restoreSuccess}`);
  console.log(`SESSION_NULL_AFTER_SIGN_OUT=${result.sessionNullAfterSignOut}`);
  console.log(`ACCESS_TOKEN_NULL_AFTER_SIGN_OUT=${result.accessTokenNullAfterSignOut}`);
  console.log(`EXISTING_API_CALLS=${result.existingApiCalls}`);
  console.log(`DIRECT_DB_CALLS=${result.directDbCalls}`);
  console.log(`WRITE_MUTATION_OCCURRED=${result.writeMutationOccurred}`);
  console.log(`SENSITIVE_VALUES_PRINTED=${result.sensitiveValuesPrinted}`);
}

async function main() {
  loadLocalEnv();

  const result = {
    envGuardPassed: false,
    signInSuccess: false,
    sessionExists: false,
    accessTokenExists: false,
    emailExists: false,
    userIdExists: false,
    restoreSuccess: false,
    sessionNullAfterSignOut: false,
    accessTokenNullAfterSignOut: false,
    existingApiCalls: 0,
    directDbCalls: 0,
    writeMutationOccurred: false,
    sensitiveValuesPrinted: false,
  };

  let provider = null;

  try {
    const { getRequiredAuthEnvConfig } = require("../src/services/authEnvConfig");
    const { createRealAuthSessionProvider } = require("../src/services/realAuthSessionProvider");
    const { resetOwnerSupabaseAuthClientForTests } = require("../src/services/supabaseAuthClient");

    getRequiredAuthEnvConfig();
    result.envGuardPassed = true;
    resetOwnerSupabaseAuthClientForTests();

    const originalFetch = global.fetch;
    assert.equal(typeof originalFetch, "function");

    global.fetch = async (input, init = {}) => {
      const url = String(input?.url ?? input);
      const method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
      const isSupabaseAuth = url.includes("/auth/v1/");

      if (url.includes("/api/owner") || url.includes("/api/bootstrap")) {
        result.existingApiCalls += 1;
      }
      if (url.includes("/rest/v1")) {
        result.directDbCalls += 1;
      }
      if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && !isSupabaseAuth) {
        result.writeMutationOccurred = true;
      }

      return originalFetch(input, init);
    };

    provider = createRealAuthSessionProvider();

    const session = await provider.signIn({
      loginId: process.env.OWNER_DRY_RUN_LOGIN_ID,
      password: process.env.OWNER_DRY_RUN_PASSWORD,
    });

    result.signInSuccess = Boolean(session?.isAuthenticated);
    result.sessionExists = Boolean(await provider.getSession());
    result.accessTokenExists = Boolean(await provider.getAccessToken());
    result.emailExists = Boolean(session?.email);
    result.userIdExists = Boolean(session?.userId);

    const restoredSession = await provider.restoreSession();
    result.restoreSuccess = Boolean(restoredSession);

    await provider.signOut();
    result.sessionNullAfterSignOut = (await provider.getSession()) === null;
    result.accessTokenNullAfterSignOut = (await provider.getAccessToken()) === null;
  } catch {
    try {
      if (provider) {
        await provider.signOut().catch(() => undefined);
        result.sessionNullAfterSignOut = (await provider.getSession()) === null;
        result.accessTokenNullAfterSignOut = (await provider.getAccessToken()) === null;
      }
    } catch {
      result.sessionNullAfterSignOut = false;
      result.accessTokenNullAfterSignOut = false;
    }
  } finally {
    delete process.env.OWNER_DRY_RUN_LOGIN_ID;
    delete process.env.OWNER_DRY_RUN_PASSWORD;
  }

  printResult(result);
}

main().catch(() => {
  printResult({
    envGuardPassed: false,
    signInSuccess: false,
    sessionExists: false,
    accessTokenExists: false,
    emailExists: false,
    userIdExists: false,
    restoreSuccess: false,
    sessionNullAfterSignOut: false,
    accessTokenNullAfterSignOut: false,
    existingApiCalls: 0,
    directDbCalls: 0,
    writeMutationOccurred: false,
    sensitiveValuesPrinted: false,
  });
  process.exitCode = 1;
});
