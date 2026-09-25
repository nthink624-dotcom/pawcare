import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.SUPABASE_URL = "https://qefxdtmdtvnzgupmjlom.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ALLOWED_DEV_SUPABASE_REFS = "qefxdtmdtvnzgupmjlom";
process.env.SUPABASE_ENV_NAME = "development";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const { upsertService } = await import("../../src/server/owner-mutations.ts");

function input(overrides = {}) {
  return {
    shopId: "shop-a",
    serviceId: "svc-request-idempotency",
    operation: "create",
    requestId: "22222222-2222-4222-8222-222222222222",
    name: "목욕",
    price: 30000,
    priceType: "starting",
    durationMinutes: 60,
    isActive: true,
    category: "미용",
    description: "",
    sortOrder: 1,
    capacityLabel: "동일 시간 1건",
    staffSelectionMode: "all",
    priceGuide: {},
    ...overrides,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function createSupabaseFetch({ services = [], ledger = [] } = {}) {
  const requests = [];
  const fetch = async (inputRequest, init) => {
    const request = inputRequest instanceof Request ? inputRequest : new Request(inputRequest, init);
    const url = new URL(request.url);
    const body = request.method === "GET" ? null : JSON.parse(await request.text() || "null");
    requests.push({ path: url.pathname, method: request.method, body });

    if (url.pathname.endsWith("/services")) {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      if (request.method === "GET") return json(services.filter((service) => service.id === id));
      if (request.method === "POST") {
        services.push(body);
        return json([], 201);
      }
    }

    if (url.pathname.endsWith("/owner_service_save_requests")) {
      const requestId = url.searchParams.get("request_id")?.replace(/^eq\./, "");
      if (request.method === "POST") {
        if (ledger.some((entry) => entry.request_id === body.request_id)) return json({ code: "23505" }, 409);
        ledger.push({ ...body, completed_at: null });
        return json([], 201);
      }
      if (request.method === "GET") return json(ledger.find((entry) => entry.request_id === requestId) ?? null);
      if (request.method === "PATCH") {
        const entry = ledger.find((item) => item.request_id === requestId);
        if (entry) entry.completed_at = body.completed_at;
        return json([]);
      }
    }

    throw new Error(`Unexpected Supabase request: ${request.method} ${url.pathname}`);
  };

  return { fetch, requests, services, ledger };
}

let restoreFetch;
afterEach(() => {
  if (restoreFetch) restoreFetch();
  restoreFetch = undefined;
});

test("Supabase ownership preflight leaves foreign/stale requests with zero service and ledger mutations", async () => {
  const foreign = createSupabaseFetch({ services: [{ id: "svc-foreign", shop_id: "shop-b" }] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = foreign.fetch;
  restoreFetch = () => { globalThis.fetch = originalFetch; };

  await assert.rejects(() => upsertService(input({ serviceId: "svc-foreign" })), (error) => error?.status === 404);
  assert.equal(foreign.ledger.length, 0);
  assert.equal(foreign.services.length, 1);
  assert.equal(foreign.requests.some((request) => request.path.endsWith("owner_service_save_requests")), false);

  const stale = createSupabaseFetch();
  globalThis.fetch = stale.fetch;
  await assert.rejects(() => upsertService(input({ operation: "update", serviceId: "svc-missing" })), (error) => error?.status === 404);
  assert.equal(stale.ledger.length, 0);
  assert.equal(stale.services.length, 0);
  assert.equal(stale.requests.some((request) => request.path.endsWith("owner_service_save_requests")), false);
});

test("Supabase ledger replays one owned create and rejects a changed payload without mutation", async () => {
  const branch = createSupabaseFetch();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = branch.fetch;
  restoreFetch = () => { globalThis.fetch = originalFetch; };

  await upsertService(input());
  await upsertService(input());
  await assert.rejects(() => upsertService(input({ price: 31000 })), (error) => error?.status === 409);

  assert.equal(branch.services.length, 1);
  assert.equal(branch.ledger.length, 1);
  assert.ok(branch.ledger[0].completed_at);
  assert.equal(branch.requests.filter((request) => request.path.endsWith("/services") && request.method === "POST").length, 1);
});
