import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

function harness(file, marker) {
  const source = readFileSync(new URL(`../../src/components/owner-web/${file}`, import.meta.url), "utf8");
  const start = source.lastIndexOf("  useEffect(() => {", source.indexOf(marker));
  const end = source.indexOf("\n  ]);", start);
  const singleLineEnd = source.indexOf("\n  }, [initialData.mode", start);
  const effect = source.slice(start, singleLineEnd >= 0 && (end < 0 || singleLineEnd < end)
    ? source.indexOf(";", singleLineEnd) + 1 : end + "\n  ]);".length);
  const listeners = new Map();
  let calls = 0;
  let updates = 0;
  let complete;
  let cleanup;
  let dependencies;
  let now = 0;
  const data = { mode: "supabase", shop: { id: "shop-1" } };
  class FakeDate extends Date {
    static now() { return now; }
  }
  const context = {
    Date: FakeDate,
    bootstrapData: data, initialData: data,
    bootstrapDataRef: { current: data }, latestDataRef: { current: data },
    onDataChangeRef: { current: () => { updates++; } },
    selectedDate: "2026-10-06", monthAnchor: "2026-10-01",
    scheduleDialogOpen: false, scheduleSaving: false,
    statusChangeInFlightRef: { current: false },
    careReportChoiceBooking: null, photoStatusAction: null, earlyStartBooking: null,
    getMonthRange: () => ({ from: "2026-10-01", to: "2026-10-31" }),
    fetchOwnerScheduleRange: () => { calls++; return new Promise(resolve => { complete = resolve; }); },
    replaceScheduleRangeInBootstrap: current => ({ ...current }),
    applyRecentStatusOverrides: value => value,
    setBootstrapData: () => {}, console,
    useEffect: (fn, deps) => { dependencies = deps; cleanup = fn(); },
    window: { setTimeout: fn => { listeners.set("initialTimeout", fn); return 2; }, clearTimeout: () => listeners.delete("initialTimeout"),
      setInterval: fn => { listeners.set("interval", fn); return 1; }, clearInterval: () => {},
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    document: { visibilityState: "visible", addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name) },
  };
  vm.runInNewContext(effect, context);
  return { source, effect, context, listeners, cleanup, dependencies,
    calls: () => calls, updates: () => updates,
    setNow: value => { now = value; },
    finish: async () => { complete({}); await new Promise(resolve => setImmediate(resolve)); } };
}

for (const [file, marker] of [
  ["calendar-management-screen.tsx", "const syncScheduleRange = async"],
  ["calendar-records-screen.tsx", "const syncMonthRange = async"],
]) {
  test(`${file}: callback changes cannot restart polling; focus and timer cannot overlap`, async () => {
    const h = harness(file, marker);
    const initialRefreshIsDeferred = file === "calendar-management-screen.tsx";
    assert.doesNotMatch(h.effect, /\bonDataChange\s*[,\]]/);
    assert.equal(h.calls(), initialRefreshIsDeferred ? 0 : 1);
    await h.listeners.get("focus")();
    await h.listeners.get("interval")();
    assert.equal(h.calls(), initialRefreshIsDeferred ? 0 : 1);
    if (initialRefreshIsDeferred) {
      h.setNow(5_000);
      h.listeners.get("initialTimeout")();
      assert.equal(h.calls(), 1);
    }
    let latestCallbackCalls = 0;
    h.context.onDataChangeRef.current = () => { latestCallbackCalls++; };
    await h.finish();
    assert.equal(latestCallbackCalls, 1);
    h.context.document.visibilityState = "hidden";
    await h.listeners.get("interval")();
    assert.equal(h.calls(), 1);
    h.context.document.visibilityState = "visible";
    if (initialRefreshIsDeferred) h.setNow(10_000);
    const refresh = h.listeners.get("interval")();
    assert.equal(h.calls(), 2);
    await h.finish();
    await refresh;
    h.cleanup();
  });
  test(`${file}: late responses after cleanup do not update data`, async () => {
    const h = harness(file, marker);
    if (file === "calendar-management-screen.tsx") {
      h.setNow(5_000);
      h.listeners.get("initialTimeout")();
    }
    h.cleanup();
    await h.finish();
    assert.equal(h.updates(), 0);
    assert.equal(h.listeners.has("focus"), false);
    assert.equal(h.listeners.has("visibilitychange"), false);
  });
}

test("schedule endpoint omits unused owner projections without removing authorization or staff scoping", () => {
  const source = readFileSync(new URL("../../src/app/api/owner/schedule/route.ts", import.meta.url), "utf8");
  for (const option of ["includeOwnerExtras", "includeOwnerProfile", "includeStaffProfileImages", "includePilotCohort"]) {
    assert.match(source, new RegExp(`${option}: false`));
  }
  assert.match(source, /await requireOwnerShop\(request, requestedShopId\)/);
  assert.match(source, /scopeBootstrapForStaff\(data, owner\)/);
});

test("owner dashboard preloads profitability code without fetching unused report data", () => {
  const preview = readFileSync(new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url), "utf8");
  const profitabilityScreen = readFileSync(new URL("../../src/components/owner-web/profitability-analytics-screen.tsx", import.meta.url), "utf8");
  assert.match(preview, /preloadProfitabilityScreen/);
  assert.match(preview, /import\("@\/components\/owner-web\/profitability-analytics-screen"\)/);
  assert.doesNotMatch(preview, /api\/owner\/profitability/);
  assert.match(profitabilityScreen, /api\/owner\/profitability/);
});
