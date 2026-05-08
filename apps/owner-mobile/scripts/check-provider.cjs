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

const { ownerBootstrapMock } = require("../src/screens/ownerPlaceholderData");
const { toOwnerBootstrapDto } = require("../src/services/ownerBootstrapAdapter");
const { loadRealOwnerBootstrap } = require("../src/services/realOwnerDataProvider");

const apiBaseUrl = "http://owner-api.local";
const ownerEmail = "owner@pawcare.local";
const accessToken = "test-access-token";
const ownedShops = [
  { id: "shop-first", name: "First Shop", address: "Seoul 1", heroImageUrl: "" },
  { id: "shop-second", name: "Second Shop", address: "Seoul 2", heroImageUrl: "" },
];

function cloneBootstrapForShop(shopId) {
  const cloned = JSON.parse(JSON.stringify(ownerBootstrapMock));

  return {
    ...cloned,
    shop: {
      ...cloned.shop,
      id: shopId,
    },
    landingInterests: [{ id: "ignored-interest" }],
    landingFeedback: [{ id: "ignored-feedback" }],
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  };
}

function installMockFetch() {
  const calls = [];

  global.fetch = async (url, init = {}) => {
    const target = new URL(String(url));
    const call = {
      url: String(url),
      method: init.method,
      authorization: init.headers?.Authorization,
    };
    calls.push(call);

    if (target.pathname === "/api/owner/shops") {
      return jsonResponse(ownedShops);
    }

    if (target.pathname === "/api/bootstrap") {
      const shopId = target.searchParams.get("shopId");
      return jsonResponse(cloneBootstrapForShop(shopId));
    }

    throw new Error(`Unexpected mock API path: ${target.pathname}`);
  };

  return calls;
}

function assertOnlyGetCalls(calls) {
  assert.ok(calls.length > 0, "mock fetch should be called");
  for (const call of calls) {
    assert.equal(call.method, "GET");
    assert.equal(call.authorization, `Bearer ${accessToken}`);
  }
}

async function checkSelectedDevShop() {
  const calls = installMockFetch();
  const result = await loadRealOwnerBootstrap({
    accessToken,
    ownerEmail,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
      devShopId: "shop-second",
    },
  });

  assert.equal(result.selectedShopId, "shop-second");
  assert.deepEqual(result.ownedShops, ownedShops);
  assert.equal(result.bootstrap.shop.id, "shop-second");
  assert.equal(result.bootstrap.ownerProfile.email, ownerEmail);
  assert.equal("landingInterests" in result.bootstrap, false);
  assert.equal("landingFeedback" in result.bootstrap, false);
  assert.equal(calls[0].url, `${apiBaseUrl}/api/owner/shops`);
  assert.equal(calls[1].url, `${apiBaseUrl}/api/bootstrap?shopId=shop-second`);
  assertOnlyGetCalls(calls);
}

async function checkFirstShopFallback() {
  const calls = installMockFetch();
  const result = await loadRealOwnerBootstrap({
    accessToken,
    ownerEmail,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
    },
  });

  assert.equal(result.selectedShopId, "shop-first");
  assert.equal(result.bootstrap.shop.id, "shop-first");
  assert.equal(calls[1].url, `${apiBaseUrl}/api/bootstrap?shopId=shop-first`);
  assertOnlyGetCalls(calls);
}

function checkAdapterValidation() {
  const converted = toOwnerBootstrapDto(cloneBootstrapForShop("shop-first"), { ownerEmail });
  assert.equal(converted.ownerProfile.email, ownerEmail);
  assert.equal("landingInterests" in converted, false);
  assert.equal("landingFeedback" in converted, false);

  const missingAppointments = cloneBootstrapForShop("shop-first");
  delete missingAppointments.appointments;
  assert.throws(() => toOwnerBootstrapDto(missingAppointments, { ownerEmail }), /appointments must be an array/);
}

async function checkPreflightFailures() {
  let calls = installMockFetch();
  await assert.rejects(
    () =>
      loadRealOwnerBootstrap({
        ownerEmail,
        apiConfig: {
          dataProvider: "real",
          apiBaseUrl,
          apiStage: "development",
          allowProdApiInDev: false,
        },
      }),
    /access token/i,
  );
  assert.equal(calls.length, 0);

  calls = installMockFetch();
  await assert.rejects(
    () =>
      loadRealOwnerBootstrap({
        accessToken,
        ownerEmail,
        apiConfig: {
          dataProvider: "real",
          apiBaseUrl: "https://www.petmanager.co.kr",
          apiStage: "development",
          allowProdApiInDev: false,
        },
      }),
    /Production owner API is blocked/,
  );
  assert.equal(calls.length, 0);
}

async function main() {
  checkAdapterValidation();
  await checkPreflightFailures();
  await checkSelectedDevShop();
  await checkFirstShopFallback();
  console.log("Provider checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
