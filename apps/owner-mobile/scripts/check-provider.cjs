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
const { assertAuthEnvConfigIsReady, getRequiredAuthEnvConfig } = require("../src/services/authEnvConfig");
const { createAuthSessionTokenResolver } = require("../src/services/authSessionProvider");
const { createMockAuthSessionProvider } = require("../src/services/mockAuthSessionProvider");
const { createRealAuthSessionProvider } = require("../src/services/realAuthSessionProvider");
const { toOwnerBootstrapDto } = require("../src/services/ownerBootstrapAdapter");
const { createStaticManualAccessTokenResolver } = require("../src/services/manualAccessToken");
const { createMockOwnerDataProvider } = require("../src/services/mockOwnerDataProvider");
const { loadRealOwnerBootstrap } = require("../src/services/realOwnerDataProvider");
const { selectOwnerDataProvider } = require("../src/services/selectOwnerDataProvider");
const {
  INJECTED_SETTINGS_ACCOUNT_EMAIL,
  MOCK_FETCH_SETTINGS_ACCOUNT_EMAIL,
  SETTINGS_SUMMARY_PREVIEW_INJECTED_READY,
  SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV,
  SETTINGS_SUMMARY_PREVIEW_MOCK_FETCH_READY,
  createInjectedSettingsSummaryPreviewSelectProvider,
} = require("../src/services/settingsSummaryPreviewInjection");
const { loadSettingsSummaryPreview } = require("../src/hooks/useSettingsSummaryPreview");

const apiBaseUrl = "http://owner-api.local";
const ownerEmail = "owner@pawcare.local";
const accessToken = "test-access-token";
const ownedShops = [
  { id: "shop-first", name: "First Shop", address: "Seoul 1", heroImageUrl: "" },
  { id: "shop-second", name: "Second Shop", address: "Seoul 2", heroImageUrl: "" },
];
const envKeys = [
  "EXPO_PUBLIC_OWNER_DATA_PROVIDER",
  "EXPO_PUBLIC_OWNER_API_BASE_URL",
  "EXPO_PUBLIC_OWNER_API_STAGE",
  "EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV",
  "EXPO_PUBLIC_OWNER_DEV_SHOP_ID",
  "EXPO_PUBLIC_OWNER_ACCESS_TOKEN",
  "EXPO_PUBLIC_ACCESS_TOKEN",
  "EXPO_PUBLIC_OWNER_SETTINGS_SUMMARY_PREVIEW",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_SUPABASE_ENV_NAME",
  "EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV",
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN",
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

async function withProviderEnv(values, callback) {
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));

  for (const key of envKeys) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
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

async function checkProviderSelection() {
  let resolverCalled = false;
  const noEnvSelection = await withProviderEnv({}, () =>
    selectOwnerDataProvider({
      accessTokenResolver: () => {
        resolverCalled = true;
        return accessToken;
      },
    }),
  );
  assert.equal(noEnvSelection.mode, "mock");
  assert.equal(noEnvSelection.provider.getBootstrap().mode, ownerBootstrapMock.mode);
  assert.equal(resolverCalled, false);

  resolverCalled = false;
  const mockEnvSelection = await withProviderEnv({ EXPO_PUBLIC_OWNER_DATA_PROVIDER: "mock" }, () =>
    selectOwnerDataProvider({
      accessTokenResolver: () => {
        resolverCalled = true;
        return accessToken;
      },
    }),
  );
  assert.equal(mockEnvSelection.mode, "mock");
  assert.equal(resolverCalled, false);

  let calls = installMockFetch();
  await withProviderEnv(
    {
      EXPO_PUBLIC_OWNER_DATA_PROVIDER: "real",
      EXPO_PUBLIC_OWNER_API_BASE_URL: apiBaseUrl,
    },
    async () => {
      await assert.rejects(() => selectOwnerDataProvider({ ownerEmail }), /access token/i);
    },
  );
  assert.equal(calls.length, 0);

  calls = installMockFetch();
  await withProviderEnv(
    {
      EXPO_PUBLIC_OWNER_DATA_PROVIDER: "real",
      EXPO_PUBLIC_OWNER_API_BASE_URL: apiBaseUrl,
    },
    async () => {
      await assert.rejects(
        () =>
          selectOwnerDataProvider({
            ownerEmail,
            accessTokenResolver: createStaticManualAccessTokenResolver(null),
          }),
        /access token/i,
      );
    },
  );
  assert.equal(calls.length, 0);

  calls = installMockFetch();
  await withProviderEnv(
    {
      EXPO_PUBLIC_OWNER_DATA_PROVIDER: "real",
      EXPO_PUBLIC_OWNER_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_OWNER_ACCESS_TOKEN: "do-not-commit-this",
    },
    async () => {
      await assert.rejects(
        () =>
          selectOwnerDataProvider({
            ownerEmail,
            accessTokenResolver: createStaticManualAccessTokenResolver(accessToken),
          }),
        /public Expo environment variable/i,
      );
    },
  );
  assert.equal(calls.length, 0);

  calls = installMockFetch();
  await withProviderEnv(
    {
      EXPO_PUBLIC_OWNER_DATA_PROVIDER: "real",
    },
    async () => {
      await assert.rejects(() => selectOwnerDataProvider({ accessToken, ownerEmail }), /base URL/i);
    },
  );
  assert.equal(calls.length, 0);

  let loaderCalled = false;
  const realSelection = await withProviderEnv(
    {
      EXPO_PUBLIC_OWNER_DATA_PROVIDER: "real",
      EXPO_PUBLIC_OWNER_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_OWNER_DEV_SHOP_ID: "shop-second",
    },
    () =>
      selectOwnerDataProvider({
        accessTokenResolver: createStaticManualAccessTokenResolver(accessToken),
        ownerEmail,
        loadRealBootstrap: async (config) => {
          loaderCalled = true;
          assert.equal(config.apiBaseUrl, apiBaseUrl);
          assert.equal(config.accessToken, accessToken);
          assert.equal(config.apiConfig?.devShopId, "shop-second");

          return {
            bootstrap: toOwnerBootstrapDto(cloneBootstrapForShop("shop-second"), { ownerEmail }),
            ownedShops,
            selectedShopId: "shop-second",
          };
        },
      }),
  );

  assert.equal(loaderCalled, true);
  assert.equal(realSelection.mode, "real");
  assert.equal(realSelection.selectedShopId, "shop-second");
  assert.equal(realSelection.provider.getBootstrap().shop.id, "shop-second");
}

function checkAppNavigatorMockOnly() {
  const source = fs.readFileSync(path.join(srcRoot, "navigation", "AppNavigator.tsx"), "utf8");
  assert.match(source, /useOwnerDataProvider/);
  assert.match(source, /useSettingsSummaryPreview/);
  assert.match(source, /createInjectedSettingsSummaryPreviewSelectProvider/);
  assert.doesNotMatch(source, /selectOwnerDataProvider/);
  assert.doesNotMatch(source, /createRealOwnerDataProvider/);
  assert.doesNotMatch(source, /loadRealOwnerBootstrap/);
}

function checkSettingsSummaryPreviewScope() {
  const source = fs.readFileSync(path.join(srcRoot, "hooks", "useSettingsSummaryPreview.ts"), "utf8");
  assert.match(source, /selectOwnerDataProvider/);
  assert.match(source, /getSettingsSummary/);
  assert.doesNotMatch(source, /getAppointmentRows/);
  assert.doesNotMatch(source, /getTodayHome/);
  assert.doesNotMatch(source, /getCustomerSummaries/);
  assert.doesNotMatch(source, /getCustomerDetail/);
  assert.doesNotMatch(source, /getAppointmentDetail/);
}

async function checkSettingsSummaryPreviewConditions() {
  const mockProvider = createMockOwnerDataProvider();
  const mockSummary = mockProvider.getSettingsSummary();

  let resolverCalled = false;
  let selectorCalled = false;
  const noEnvPreview = await loadSettingsSummaryPreview({
    mockSummary,
    apiConfig: {
      dataProvider: "mock",
      apiBaseUrl: "",
      apiStage: "development",
      allowProdApiInDev: false,
    },
    accessTokenResolver: () => {
      resolverCalled = true;
      return accessToken;
    },
    selectProvider: async () => {
      selectorCalled = true;
      throw new Error("mock mode must not call selector");
    },
  });
  assert.equal(noEnvPreview.status, "mock");
  assert.equal(noEnvPreview.source, "mock");
  assert.equal(noEnvPreview.viewModel, mockSummary);
  assert.equal(resolverCalled, false);
  assert.equal(selectorCalled, false);

  resolverCalled = false;
  selectorCalled = false;
  const mockEnvPreview = await loadSettingsSummaryPreview({
    mockSummary,
    apiConfig: {
      dataProvider: "mock",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
    },
    accessTokenResolver: () => {
      resolverCalled = true;
      return accessToken;
    },
    selectProvider: async () => {
      selectorCalled = true;
      throw new Error("mock mode must not call selector");
    },
  });
  assert.equal(mockEnvPreview.status, "mock");
  assert.equal(mockEnvPreview.source, "mock");
  assert.equal(resolverCalled, false);
  assert.equal(selectorCalled, false);

  let calls = installMockFetch();
  const missingTokenPreview = await loadSettingsSummaryPreview({
    mockSummary,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
    },
    ownerEmail,
  });
  assert.equal(missingTokenPreview.status, "error");
  assert.equal(missingTokenPreview.source, "mock");
  assert.match(missingTokenPreview.error?.message ?? "", /access token/i);
  assert.equal(calls.length, 0);

  calls = installMockFetch();
  const missingBaseUrlPreview = await loadSettingsSummaryPreview({
    mockSummary,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl: "",
      apiStage: "development",
      allowProdApiInDev: false,
    },
    ownerEmail,
    accessTokenResolver: createStaticManualAccessTokenResolver(accessToken),
  });
  assert.equal(missingBaseUrlPreview.status, "error");
  assert.equal(missingBaseUrlPreview.source, "mock");
  assert.match(missingBaseUrlPreview.error?.message ?? "", /base URL/i);
  assert.equal(calls.length, 0);

  const realSummary = {
    ...mockSummary,
    accountEmail: "real-owner@example.com",
  };
  const readyPreview = await loadSettingsSummaryPreview({
    mockSummary,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
    },
    ownerEmail,
    accessTokenResolver: createStaticManualAccessTokenResolver(accessToken),
    selectProvider: async () => ({
      mode: "real",
      selectedShopId: "shop-first",
      ownedShops,
      provider: {
        ...mockProvider,
        getSettingsSummary: () => realSummary,
      },
    }),
  });
  assert.equal(readyPreview.status, "ready");
  assert.equal(readyPreview.source, "real");
  assert.equal(readyPreview.viewModel.accountEmail, "real-owner@example.com");
}

async function checkInjectedSettingsSummaryPreview() {
  const mockProvider = createMockOwnerDataProvider();
  const mockSummary = mockProvider.getSettingsSummary();

  await withProviderEnv({}, async () => {
    assert.equal(createInjectedSettingsSummaryPreviewSelectProvider(mockSummary), undefined);
  });

  await withProviderEnv(
    {
      [SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV]: SETTINGS_SUMMARY_PREVIEW_INJECTED_READY,
    },
    async () => {
      const injectedSelectProvider = createInjectedSettingsSummaryPreviewSelectProvider(mockSummary);
      assert.equal(typeof injectedSelectProvider, "function");

      const result = await injectedSelectProvider();
      assert.equal(result.mode, "real");
      assert.equal(result.provider.getSettingsSummary().accountEmail, INJECTED_SETTINGS_ACCOUNT_EMAIL);
      assert.throws(() => result.provider.getAppointmentRows(), /must not be used outside Settings/);
      assert.throws(() => result.provider.getTodayHome(), /must not be used outside Settings/);
      assert.throws(() => result.provider.getCustomerSummaries(), /must not be used outside Settings/);
    },
  );

  await withProviderEnv(
    {
      [SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV]: SETTINGS_SUMMARY_PREVIEW_MOCK_FETCH_READY,
    },
    async () => {
      const mockFetchSelectProvider = createInjectedSettingsSummaryPreviewSelectProvider(mockSummary);
      assert.equal(typeof mockFetchSelectProvider, "function");

      const result = await mockFetchSelectProvider({ today: "2026-05-08" });
      const settingsSummary = result.provider.getSettingsSummary();
      assert.equal(result.mode, "real");
      assert.equal(result.selectedShopId, "mock-fetch-shop");
      assert.equal(settingsSummary.accountEmail, MOCK_FETCH_SETTINGS_ACCOUNT_EMAIL);
      assert.equal(settingsSummary.shop.name, "Mock Fetch Grooming");
      assert.equal(settingsSummary.shop.address, "Mock Fetch Street 10");
      assert.equal(result.provider.getAppointmentRows("2026-05-08").length > 0, true);
    },
  );
}

async function checkAuthSessionProviders() {
  const mockAuthProvider = createMockAuthSessionProvider();

  assert.equal(await mockAuthProvider.restoreSession(), null);
  assert.equal(await mockAuthProvider.getSession(), null);
  assert.equal(await mockAuthProvider.getAccessToken(), null);

  const signedInSession = await mockAuthProvider.signIn({
    loginId: "mock-owner",
    password: "mock-password",
  });
  assert.equal(signedInSession.isAuthenticated, true);
  assert.equal(signedInSession.ownerId, "mock-owner");
  assert.equal(signedInSession.accessToken, null);
  assert.equal((await mockAuthProvider.getSession())?.ownerId, "mock-owner");

  const sessionTokenResolver = createAuthSessionTokenResolver(mockAuthProvider);
  assert.equal(await sessionTokenResolver(), null);

  await mockAuthProvider.signOut();
  assert.equal(await mockAuthProvider.restoreSession(), null);

  const realAuthProvider = createRealAuthSessionProvider();
  await assert.rejects(() => realAuthProvider.getSession(), /not implemented yet/i);
  await assert.rejects(() => realAuthProvider.getAccessToken(), /not implemented yet/i);
  await assert.rejects(
    () =>
      realAuthProvider.signIn({
        loginId: "owner",
        password: "password",
      }),
    /not implemented yet/i,
  );
  await assert.rejects(() => realAuthProvider.signOut(), /not implemented yet/i);
  await assert.rejects(() => realAuthProvider.restoreSession(), /not implemented yet/i);
}

async function checkAuthEnvConfig() {
  await withProviderEnv({}, () => {
    assert.throws(() => assertAuthEnvConfigIsReady(), /Supabase URL is required/);
  });

  await withProviderEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: "https://dev-project.supabase.co",
    },
    () => {
      assert.throws(() => assertAuthEnvConfigIsReady(), /anon or publishable key/i);
    },
  );

  await withProviderEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: "https://dev-project.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_service_role_key",
    },
    () => {
      assert.throws(() => assertAuthEnvConfigIsReady(), /service role or secret key/i);
    },
  );

  await withProviderEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: "https://prod-project.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      EXPO_PUBLIC_SUPABASE_ENV_NAME: "production",
      EXPO_PUBLIC_OWNER_API_STAGE: "development",
    },
    () => {
      assert.throws(() => assertAuthEnvConfigIsReady(), /Production Supabase is blocked/);
    },
  );

  await withProviderEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
      EXPO_PUBLIC_SUPABASE_ENV_NAME: "staging",
      EXPO_PUBLIC_OWNER_API_STAGE: "staging",
    },
    () => {
      const config = getRequiredAuthEnvConfig();
      assert.equal(config.supabaseUrl, "https://staging-project.supabase.co");
      assert.equal(config.supabasePublishableKey, "public-publishable-key");
      assert.equal(config.supabaseEnvName, "staging");
      assert.equal(config.appStage, "staging");
    },
  );

  await withProviderEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: "https://dev-project.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN: "must-not-be-public",
    },
    () => {
      assert.throws(() => assertAuthEnvConfigIsReady(), /Forbidden secret-like public Expo environment variable/);
    },
  );
}

async function main() {
  checkAdapterValidation();
  checkAppNavigatorMockOnly();
  checkSettingsSummaryPreviewScope();
  await checkSettingsSummaryPreviewConditions();
  await checkInjectedSettingsSummaryPreview();
  await checkPreflightFailures();
  await checkProviderSelection();
  await checkSelectedDevShop();
  await checkFirstShopFallback();
  await checkAuthSessionProviders();
  await checkAuthEnvConfig();
  console.log("Provider checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
