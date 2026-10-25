import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const coordinatorPath = new URL("../src/lib/push/owner-push-registration-coordinator.ts", import.meta.url);
const pushPath = new URL("../src/lib/push/owner-push-notifications.ts", import.meta.url);
const settingsPath = new URL("../src/components/owner/owner-app-notification-settings.tsx", import.meta.url);
const [coordinatorSource, pushSource, settingsSource] = await Promise.all([
  readFile(coordinatorPath, "utf8"),
  readFile(pushPath, "utf8"),
  readFile(settingsPath, "utf8"),
]);

const coordinatorOutput = ts.transpileModule(coordinatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadCoordinatorModule(context = vm.createContext({ Map, JSON, Promise, Symbol })) {
  const compiledModule = { exports: {} };
  context.module = compiledModule;
  context.exports = compiledModule.exports;
  vm.runInContext(`(function (module, exports) { ${coordinatorOutput}\n})(module, exports);`, context);
  return compiledModule.exports;
}

function loadCoordinator() {
  return loadCoordinatorModule().createOwnerPushRegistrationCoordinator();
}

const identity = {
  pushToken: "private-token-a",
  shopId: "shop-a",
  deviceId: "device-a",
  appId: "kr.petmanager.owner",
};

test("three concurrent triggers join one transport and identical remounts stay memoized", async () => {
  const coordinator = loadCoordinator();
  let calls = 0;
  let release;
  const transport = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };

  const first = coordinator.register({ identity, intent: "automatic", transport });
  const second = coordinator.register({ identity, intent: "automatic", transport });
  const third = coordinator.register({ identity, intent: "automatic", transport });
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second, third]);
  await coordinator.register({ identity, intent: "automatic", transport });
  assert.equal(calls, 1);
});

test("a real identity change registers once without array or caller ordering", async () => {
  const coordinator = loadCoordinator();
  let calls = 0;
  const transport = async () => { calls += 1; };

  await coordinator.register({ identity, intent: "automatic", transport });
  await coordinator.register({ identity: { ...identity, pushToken: "private-token-b" }, intent: "automatic", transport });
  await coordinator.register({ identity: { ...identity, shopId: "shop-b" }, intent: "automatic", transport });
  assert.equal(calls, 3);
});

test("failure blocks automatic loops and permits only one explicit retry", async () => {
  const coordinator = loadCoordinator();
  let calls = 0;
  const failingTransport = async () => {
    calls += 1;
    throw new Error("controlled failure");
  };

  await assert.rejects(coordinator.register({ identity, intent: "automatic", transport: failingTransport }));
  assert.equal(await coordinator.register({ identity, intent: "automatic", transport: failingTransport }), "retry-required");
  await assert.rejects(coordinator.register({ identity, intent: "user", transport: failingTransport }));
  assert.equal(await coordinator.register({ identity, intent: "user", transport: failingTransport }), "retry-required");
  assert.equal(calls, 2);
});

test("reset permits an intentional preference off and on registration", async () => {
  const coordinator = loadCoordinator();
  let calls = 0;
  const transport = async () => { calls += 1; };

  await coordinator.register({ identity, intent: "automatic", transport });
  await coordinator.register({ identity, intent: "automatic", transport });
  coordinator.reset();
  await coordinator.register({ identity, intent: "user", transport });

  assert.equal(calls, 2);
});

test("HMR generations share one coordinator and stale delayed listeners cannot transport", async () => {
  const context = vm.createContext({ Map, JSON, Promise, Symbol });
  const firstModule = loadCoordinatorModule(context);
  const firstOwner = firstModule.claimOwnerPushRuntimeGeneration();
  let staleHandleRemovals = 0;
  await firstModule.ensureOwnerPushRuntimeListeners(firstOwner, async () => [{
    remove: async () => { staleHandleRemovals += 1; },
  }]);

  const secondModule = loadCoordinatorModule(context);
  const secondOwner = secondModule.claimOwnerPushRuntimeGeneration();
  await secondModule.ensureOwnerPushRuntimeListeners(secondOwner, async () => [{ remove: async () => undefined }]);
  await secondOwner.registry.listenerDisposalPromise;

  assert.equal(firstModule.isOwnerPushRuntimeGenerationActive(firstOwner), false);
  assert.equal(secondModule.isOwnerPushRuntimeGenerationActive(secondOwner), true);
  assert.equal(staleHandleRemovals, 1);
  assert.equal(secondOwner.registry.listenerHandles.length, 1);
  assert.equal(firstOwner.registry.registrationCoordinator, secondOwner.registry.registrationCoordinator);

  let transportCalls = 0;
  const transport = async () => { transportCalls += 1; };
  const fire = (module, owner, nextIdentity = identity) => {
    if (!module.isOwnerPushRuntimeGenerationActive(owner)) return Promise.resolve("stale");
    return owner.registry.registrationCoordinator.register({
      identity: nextIdentity,
      intent: "automatic",
      transport,
    });
  };

  await Promise.all([
    fire(firstModule, firstOwner),
    fire(secondModule, secondOwner),
    fire(secondModule, secondOwner),
  ]);
  assert.equal(transportCalls, 1);
  await fire(secondModule, secondOwner);
  assert.equal(transportCalls, 1);
  await fire(secondModule, secondOwner, { ...identity, pushToken: "private-token-b" });
  assert.equal(transportCalls, 2);
});

test("native callbacks and the visible retry control use the shared coordinator intent", () => {
  assert.match(coordinatorSource, /__PETMANAGER_OWNER_PUSH_RUNTIME_REGISTRY_V1__/);
  assert.match(pushSource, /owner\.registry\.registrationCoordinator\.register\(\{/);
  assert.match(pushSource, /identity:\s*\{[\s\S]*pushToken,[\s\S]*shopId: context\.shopId,[\s\S]*deviceId,[\s\S]*appId: APP_ID/);
  assert.match(pushSource, /owner\.registry\.pendingRegistrationIntent = options\.userInitiated \? "user" : "automatic"/);
  assert.match(pushSource, /isOwnerPushRuntimeGenerationActive\(owner\)/);
  assert.match(pushSource, /ensureOwnerPushRuntimeListeners\(owner/);
  assert.match(pushSource, /registerPushToken\(activePushToken, "user"\)/);
  assert.match(pushSource, /registry\.registrationCoordinator\.reset\(\)/);
  assert.doesNotMatch(pushSource, /const registrationCoordinator =/);
  assert.doesNotMatch(pushSource, /let listenerSetupPromise/);
  assert.match(settingsSource, /syncOwnerPushNotifications\(context, \{ userInitiated: true \}\)/);
});
