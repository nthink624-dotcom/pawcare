import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");
let boundaryHarnessSequence = 0;

function declarationText(sourceText, name, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = sourceFile.statements.find(
    (statement) =>
      (ts.isFunctionDeclaration(statement) && statement.name?.text === name) ||
      (ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (item) => ts.isIdentifier(item.name) && item.name.text === name,
        )),
  );
  assert.ok(declaration, `missing declaration ${name}`);
  return declaration.getText(sourceFile).replace(/^export\s+/, "");
}

async function importMobileApiBoundaryHarness(envSource, apiSource) {
  const moduleSource = [
    'const env = { apiBaseUrl: "", siteUrl: "http://localhost:3000" };',
    'let runtimeStage = "development";',
    "function getSupabaseRuntimeStage() { return runtimeStage; }",
    declarationText(envSource, "DEVELOPMENT_API_ORIGINS", "env.ts"),
    declarationText(envSource, "PRODUCTION_API_ORIGINS", "env.ts"),
    declarationText(envSource, "MAX_API_PATH_DECODE_PASSES", "env.ts"),
    declarationText(envSource, "UNSAFE_API_PATH_CHARACTERS", "env.ts"),
    declarationText(envSource, "ENCODED_API_PATH_SEPARATOR", "env.ts"),
    declarationText(envSource, "parseOriginOnly", "env.ts"),
    declarationText(envSource, "getMobileApiOrigin", "env.ts"),
    declarationText(envSource, "assertMobileApiPathnameStage", "env.ts"),
    declarationText(envSource, "assertSafeMobileApiPathname", "env.ts"),
    declarationText(envSource, "buildMobileApiUrl", "env.ts"),
    "function buildApiUrl(path) { return buildMobileApiUrl(path); }",
    "let tokenReads = 0;",
    "const requests = [];",
    'async function getAccessTokenWithRecovery() { tokenReads += 1; return "qa-access-token"; }',
    `class ApiRequestError extends Error {
      constructor(message, status, body) {
        super(message);
        this.name = "ApiRequestError";
        this.status = status;
        this.body = body;
      }
    }`,
    `async function fetch(url, init) {
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body ?? null,
        authorization: headers.get("Authorization"),
        contentType: headers.get("Content-Type"),
        qaHeader: headers.get("X-QA"),
        credentials: init?.credentials,
        redirect: init?.redirect,
      });
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => '{"ok":true}',
      };
    }`,
    declarationText(apiSource, "fetchApiJsonAtUrl", "api.ts"),
    declarationText(apiSource, "fetchApiJsonWithAuth", "api.ts"),
    "export { buildMobileApiUrl, fetchApiJsonWithAuth };",
    "export function configureHarness(apiBaseUrl, stage) { env.apiBaseUrl = apiBaseUrl; runtimeStage = stage; }",
    "export function readHarnessState() { return { tokenReads, requests: [...requests] }; }",
  ].join("\n");
  const javascript = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  boundaryHarnessSequence += 1;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}#${boundaryHarnessSequence}`);
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

test("mobile API client fails closed to an allowlisted origin before attaching auth", async () => {
  const [envSource, apiSource] = await Promise.all([
    source("src/lib/env.ts"),
    source("src/lib/api.ts"),
  ]);

  assert.match(envSource, /http:\/\/127\.0\.0\.1:3000/);
  assert.match(envSource, /http:\/\/localhost:3000/);
  assert.match(envSource, /https:\/\/app\.petmanager\.co\.kr/);
  assert.match(envSource, /https:\/\/www\.petmanager\.co\.kr/);
  assert.match(envSource, /if \(!candidate\)/);
  assert.match(envSource, /runtimeStage !== "development" && !origin\.startsWith\("https:\/\/"\)/);
  assert.match(envSource, /MAX_API_PATH_DECODE_PASSES = 4/);
  assert.match(envSource, /normalize\("NFKC"\)/);
  assert.match(envSource, /decodeURIComponent\(normalized\)/);
  assert.match(envSource, /!pathname\.startsWith\("\/api\/"\)/);
  assert.match(envSource, /!normalizedUrl\.pathname\.startsWith\("\/api\/"\)/);

  assert.match(apiSource, /return buildMobileApiUrl\(path\)/);
  assert.doesNotMatch(apiSource, /\^https\?:\\\/\\\//);
  assert.match(apiSource, /credentials: "omit"/);
  assert.match(apiSource, /redirect: "error"/);

  const authFunction = apiSource.slice(apiSource.indexOf("export async function fetchApiJsonWithAuth"));
  const pathCheck = authFunction.indexOf("buildApiUrl(input)");
  const originCheck = authFunction.indexOf("getMobileApiOrigin()");
  const tokenRead = authFunction.indexOf("getAccessTokenWithRecovery()");
  const authorizationWrite = authFunction.indexOf('headers.set("Authorization"');
  assert.ok(
    pathCheck >= 0 && pathCheck < originCheck && originCheck < tokenRead && tokenRead < authorizationWrite,
  );
});

test("normalized and repeatedly encoded API paths fail closed before auth or network", async () => {
  const [envSource, apiSource] = await Promise.all([
    source("src/lib/env.ts"),
    source("src/lib/api.ts"),
  ]);
  const harness = await importMobileApiBoundaryHarness(envSource, apiSource);
  const existingInvalidPaths = [
    "/api/../login",
    "/api/./../../login",
    "/api/%2e%2e/login",
    "/api/%2E%2E/login",
    "/api/%2e%2e%2flogin",
    "/api/%2e%2e%5clogin",
    "/api/owner%2f..%2flogin",
    "/api/%5c..%5clogin",
    "/api/%00owner",
    "/api/%0d%0aowner",
    "/api/%7fowner",
    "https://attacker.invalid/api/owner/shops",
    "//attacker.invalid/api/owner/shops",
    "/api\\..\\login",
    "/api/\u0000owner",
    "/api/\r\nowner",
  ];
  const expandedInvalidPaths = [
    "/api/%252e%252e/login",
    "/api/%252E%252E%252flogin",
    "/api/%255c%255cattacker.invalid/path",
    "/api/%250d%250aowner",
    "/api/\u0085owner",
    "/api/%EF%BC%8E%EF%BC%8E/login",
    "/api/%25EF%25BC%258E%25EF%25BC%258E%252flogin",
  ];
  let overlyEncoded = "%2e%2e%2flogin";
  for (let pass = 0; pass < 6; pass += 1) {
    overlyEncoded = overlyEncoded.replaceAll("%", "%25");
  }
  const malformedAndDeepPaths = [
    "/api/%",
    "/api/%zz",
    "/api/%E0%A4%A",
    "/api/%C2%85owner",
    "/api/%25C2%2585owner",
    "/api/／／attacker.invalid/path",
    "/api/＼＼attacker.invalid/path",
    `/api/${overlyEncoded}`,
  ];

  for (const input of [...existingInvalidPaths, ...expandedInvalidPaths, ...malformedAndDeepPaths]) {
    const before = harness.readHarnessState();
    await assert.rejects(harness.fetchApiJsonWithAuth(input), /API 요청 (경로|원점)/, input);
    assert.deepEqual(harness.readHarnessState(), before, input);
  }
  assert.deepEqual(harness.readHarnessState(), { tokenReads: 0, requests: [] });

  harness.configureHarness("https://attacker.invalid", "production");
  await assert.rejects(
    harness.fetchApiJsonWithAuth("/api/owner/shops"),
    /허용되지 않은 API 원점/,
  );
  assert.deepEqual(harness.readHarnessState(), { tokenReads: 0, requests: [] });
});

test("valid API paths preserve unicode query and authenticated request options", async () => {
  const [envSource, apiSource] = await Promise.all([
    source("src/lib/env.ts"),
    source("src/lib/api.ts"),
  ]);
  const harness = await importMobileApiBoundaryHarness(envSource, apiSource);
  const validPaths = [
    "/api/owner/shops",
    "/api/bootstrap?scope=owner&shopId=shop-1",
    "/api/search/v1.1/items?q=%252e%252e%252fowner&next=%25EF%25BC%258Fstaff",
    "/api/resource-name_1",
    "/api/매장/고객?name=%EA%B0%95%EC%95%84%EC%A7%80",
    "/api/%EB%A7%A4%EC%9E%A5/%EA%B3%A0%EA%B0%9D",
    "/api/files/report%2Ejson",
    "/api/Ａ고객",
  ];
  for (const input of validPaths) {
    assert.deepEqual(await harness.fetchApiJsonWithAuth(input), { ok: true });
  }

  const state = harness.readHarnessState();
  assert.equal(state.tokenReads, validPaths.length);
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    validPaths.map((input) => new URL(input, "http://127.0.0.1:3000/").toString()),
  );
  assert.ok(state.requests.every(({ authorization }) => authorization === "Bearer qa-access-token"));

  const body = JSON.stringify({ 이름: "강아지" });
  assert.deepEqual(
    await harness.fetchApiJsonWithAuth("/api/매장/고객?active=true", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/vnd.petmanager.qa+json",
        "X-QA": "preserved",
      },
      credentials: "include",
      redirect: "follow",
    }),
    { ok: true },
  );
  assert.deepEqual(harness.readHarnessState().requests.at(-1), {
    url: new URL("/api/매장/고객?active=true", "http://127.0.0.1:3000/").toString(),
    method: "POST",
    body,
    authorization: "Bearer qa-access-token",
    contentType: "application/vnd.petmanager.qa+json",
    qaHeader: "preserved",
    credentials: "omit",
    redirect: "error",
  });

  harness.configureHarness("https://app.petmanager.co.kr", "production");
  assert.deepEqual(await harness.fetchApiJsonWithAuth("/api/owner/shops?active=true"), { ok: true });
  const productionState = harness.readHarnessState();
  assert.equal(productionState.requests.at(-1)?.url, "https://app.petmanager.co.kr/api/owner/shops?active=true");
});

test("public bootstrap projects only public shop, service, and price-guide data", async () => {
  const [apiSource, bootstrapSource] = await Promise.all([
    source("src/lib/api.ts"),
    source("src/app/api/bootstrap/route.ts"),
  ]);

  const publicType = between(apiSource, "export type PublicBootstrapPayload", "export function buildApiUrl");
  assert.doesNotMatch(publicType, /appointments|groomingRecords|staffMembers/);

  const publicProjection = between(
    bootstrapSource,
    "function projectPublicBootstrap",
    "function assertOwnerBootstrapBoundary",
  );
  assert.match(publicProjection, /shop/);
  assert.match(publicProjection, /services/);
  assert.match(publicProjection, /priceGuideCore/);
  assert.doesNotMatch(publicProjection, /appointments|groomingRecords|staffMembers|ownerProfile/);
  assert.doesNotMatch(bootstrapSource, /getBootstrap|@\/server\/bootstrap/);
  assert.match(bootstrapSource, /auth: scope === "owner" \? "required" : "omit"/);
});

test("owner duplicate routes proxy to canonical APIs and retain boundary gates", async () => {
  const [bootstrapSource, shopsSource, subscriptionSource, authSource, billingSessionSource] = await Promise.all([
    source("src/app/api/bootstrap/route.ts"),
    source("src/app/api/owner/shops/route.ts"),
    source("src/app/api/subscription/route.ts"),
    source("src/server/owner-api-auth.ts"),
    source("src/server/owner-billing-session.ts"),
  ]);

  for (const routeSource of [bootstrapSource, shopsSource, subscriptionSource]) {
    assert.match(routeSource, /requestCanonicalApi/);
    assert.doesNotMatch(routeSource, /getSupabaseAdmin|getSupabaseAuthClient|\.from\("/);
  }
  assert.doesNotMatch(shopsSource, /updateShopSettings|owner-mutations/);
  assert.doesNotMatch(subscriptionSource, /getOwnerSubscriptionSummary|updateOwnerSubscriptionPreferences/);
  assert.match(subscriptionSource, /new URLSearchParams\(\{ shopId \}\)/);
  assert.match(bootstrapSource, /initialSetupReadiness/);
  assert.match(bootstrapSource, /readiness\.completed !== true/);

  assert.match(authSource, /PETMANAGER_MAIN_APP_ORIGIN/);
  assert.match(authSource, /https:\/\/petmanager\.co\.kr/);
  assert.match(authSource, /https:\/\/www\.petmanager\.co\.kr/);
  assert.doesNotMatch(
    between(authSource, "const PRODUCTION_CANONICAL_ORIGINS", "const QUERY_KEYS_BY_PATH"),
    /app\.petmanager\.co\.kr/,
  );
  assert.match(authSource, /credentials: "omit"/);
  assert.match(authSource, /redirect: "error"/);
  assert.doesNotMatch(authSource, /headers\.set\("Cookie"|headers\.set\("cookie"/);
  assert.match(authSource, /user\.app_metadata\?\.account_suspended/);
  assert.doesNotMatch(authSource, /user\.user_metadata\?\.account_suspended/);
  assert.match(authSource, /path: "\/api\/owner\/shops"/);
  assert.match(authSource, /path: "\/api\/bootstrap"/);
  assert.match(authSource, /initialSetupReadiness/);
  assert.match(authSource, /responseShopId !== owner\.shopId/);

  assert.match(billingSessionSource, /requireCanonicalOwnerIdentity/);
  assert.doesNotMatch(billingSessionSource, /getSupabaseAdmin|\.from\("shops"\)|maybeSingle/);
});
