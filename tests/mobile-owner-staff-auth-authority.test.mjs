import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const loginRoute = await readFile(new URL("../src/app/api/auth/login/route.ts", import.meta.url), "utf8");
const ownerPage = await readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8");
const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const ownerShell = await readFile(new URL("../src/components/owner/owner-shell.tsx", import.meta.url), "utf8");
const integritySource = await readFile(new URL("../src/lib/owner-customer-pet-integrity.ts", import.meta.url), "utf8");

function extractFunction(source, name, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `missing function ${name}`);
  return declaration.getText(sourceFile).replace(/^function /, "export function ");
}

async function importFunctions(source, names, fileName) {
  const selected = names.map((name) => extractFunction(source, name, fileName)).join("\n");
  const javascript = ts.transpileModule(selected, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function loadIntegrityModule() {
  const output = ts.transpileModule(integritySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  Function("module", "exports", output)(compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

test("staff login authenticates first and verifies the canonical membership API without owner_profiles", () => {
  assert.doesNotMatch(loginRoute, /owner_profiles|getSupabaseAdmin|\.from\(/);
  assert.match(loginRoute, /getCanonicalApiOrigin/);
  assert.match(loginRoute, /new URL\("\/api\/owner\/shops"/);
  assert.match(loginRoute, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(loginRoute, /credentials: "omit"/);
  assert.match(loginRoute, /redirect: "error"/);

  const executeLogin = loginRoute.slice(loginRoute.indexOf("async function executeLogin"));
  assert.ok(executeLogin.indexOf("signInWithPassword") < executeLogin.indexOf("verifyCanonicalShopMembership"));
});

test("mobile role is derived from the canonical staff-scoped bootstrap, not URL or user metadata", async () => {
  assert.doesNotMatch(ownerPage, /roleParam|staffIdParam|user_metadata\?\.account_suspended/);
  const { resolveOwnerMobileRoleContext } = loadIntegrityModule();
  assert.deepEqual(
    resolveOwnerMobileRoleContext({ ownerProfile: null, staffMembers: [{ id: "staff-7" }], appointments: [] }),
    { appRole: "staff", currentStaffId: "staff-7" },
  );
  assert.deepEqual(
    resolveOwnerMobileRoleContext({ ownerProfile: { user_id: "owner-1" }, staffMembers: [{ id: "staff-7" }], appointments: [] }),
    { appRole: "owner", currentStaffId: null },
  );
  for (const payload of [
    { ownerProfile: null, staffMembers: [], appointments: [] },
    { ownerProfile: null, staffMembers: [{ id: "staff-7" }, { id: "staff-8" }], appointments: [] },
    { ownerProfile: null, staffMembers: [{ id: "" }], appointments: [] },
    { ownerProfile: null, staffMembers: [{ id: "   " }], appointments: [] },
    { ownerProfile: null, staffMembers: [{ id: null }], appointments: [] },
    { ownerProfile: undefined, staffMembers: [], appointments: [] },
    { ownerProfile: null, staffMembers: [{ id: "staff-7" }], appointments: [{ staff_id: "staff-8" }] },
    { ownerProfile: null, staffMembers: [{ id: "staff-7" }], appointments: [{ staff_id: null }] },
  ]) {
    assert.throws(() => resolveOwnerMobileRoleContext(payload), /계정 권한을 확인하지 못했습니다/);
  }
  assert.ok(ownerPage.indexOf("assertOwnerBootstrapPayload(bootstrap") < ownerPage.indexOf("resolveOwnerMobileRoleContext(canonicalBootstrap)"));
  assert.match(ownerPage, /message === OWNER_MOBILE_AUTHORITY_ERROR_MESSAGE/);
  assert.match(ownerPage, /title: "계정 권한을 확인하지 못했습니다"/);
  assert.match(ownerPage, /setLoadFailure\(getOwnerMobileLoadFailure\(error\)\)/);
});

test("initial mobile role waits for the full bootstrap authority projection", () => {
  const loadStart = ownerPage.indexOf("const bootstrap = await fetchApiJsonWithAuth<CanonicalOwnerBootstrapPayload>(");
  const roleResolution = ownerPage.indexOf("const roleContext = resolveOwnerMobileRoleContext(canonicalBootstrap);", loadStart);
  const loadEnd = ownerPage.indexOf("} catch (error) {", roleResolution);
  assert.ok(loadStart >= 0 && roleResolution > loadStart && loadEnd > roleResolution, "initial bootstrap role block must exist");

  const initialRoleLoad = ownerPage.slice(loadStart, loadEnd);
  assert.match(initialRoleLoad, /`\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(resolvedShopId\)\}`/);
  assert.doesNotMatch(initialRoleLoad, /phase=essential|deferred refresh/);
  assert.ok(initialRoleLoad.indexOf("assertOwnerBootstrapPayload(bootstrap") < initialRoleLoad.indexOf("resolveOwnerMobileRoleContext(canonicalBootstrap)"));
  assert.match(initialRoleLoad, /setMobileRoleContext\(roleContext\)/);
  assert.match(initialRoleLoad, /setData\(canonicalBootstrap\)/);
});

test("staff appointment UI scope rejects a missing or stale staff binding", async () => {
  const { matchesMobileRoleAppointmentScope } = await importFunctions(
    ownerApp,
    ["matchesMobileRoleAppointmentScope"],
    "owner-app.tsx",
  );
  assert.equal(matchesMobileRoleAppointmentScope({ staff_id: "staff-8" }, "owner", null), true);
  assert.equal(matchesMobileRoleAppointmentScope({ staff_id: "staff-7" }, "staff", "staff-7"), true);
  assert.equal(matchesMobileRoleAppointmentScope({ staff_id: "staff-8" }, "staff", "staff-7"), false);
  assert.equal(matchesMobileRoleAppointmentScope({ staff_id: "staff-7" }, "staff", null), false);
  assert.match(ownerApp, /props\.appRole === "staff" && !props\.currentStaffId\?\.trim\(\)/);
});

test("staff entry does not depend on the owner-only subscription endpoint", () => {
  assert.match(
    ownerPage,
    /roleContext\.appRole === "owner"\s*&&\s*readiness\.completed\s*&&\s*shouldResolveSubscriptionBeforeRender\s*\? await fetchApiJsonWithAuth<OwnerSubscriptionSummary>/,
  );
  assert.match(ownerPage, /: null;/);
  assert.ok(ownerPage.indexOf("resolveOwnerMobileRoleContext(canonicalBootstrap)") < ownerPage.indexOf('`/api/subscription?shopId='));
});

test("Android renders after full authority bootstrap and refreshes subscription in OwnerShell", () => {
  assert.match(ownerPage, /const isAndroidApp = Capacitor\.getPlatform\(\) === "android";/);
  assert.match(ownerPage, /const shouldResolveSubscriptionBeforeRender = !isAndroidApp;/);
  assert.match(ownerPage, /readiness\.completed && shouldResolveSubscriptionBeforeRender/);
  assert.match(ownerShell, /void refreshSummary\(\);/);
});
