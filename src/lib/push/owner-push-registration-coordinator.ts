export type OwnerPushRegistrationIdentity = {
  pushToken: string;
  shopId: string;
  deviceId: string | null;
  appId: string;
};

export type OwnerPushRegistrationIntent = "automatic" | "user";

type RegistrationEntry =
  | { state: "pending"; promise: Promise<void>; userRetryUsed: boolean }
  | { state: "succeeded"; userRetryUsed: boolean }
  | { state: "failed"; userRetryUsed: boolean };

export type OwnerPushRegistrationCoordinator = {
  register(input: {
    identity: OwnerPushRegistrationIdentity;
    intent: OwnerPushRegistrationIntent;
    transport: () => Promise<void>;
  }): Promise<"registered" | "memoized" | "retry-required">;
  reset(): void;
};

function registrationIdentityKey(identity: OwnerPushRegistrationIdentity) {
  return JSON.stringify([
    identity.pushToken,
    identity.shopId,
    identity.deviceId,
    identity.appId,
  ]);
}

export function createOwnerPushRegistrationCoordinator(): OwnerPushRegistrationCoordinator {
  const entries = new Map<string, RegistrationEntry>();

  return {
    async register({ identity, intent, transport }) {
      const key = registrationIdentityKey(identity);
      const current = entries.get(key);

      if (current?.state === "succeeded") return "memoized";
      if (current?.state === "pending") {
        await current.promise;
        return "memoized";
      }
      if (current?.state === "failed" && (intent !== "user" || current.userRetryUsed)) {
        return "retry-required";
      }

      const userRetryUsed = current?.state === "failed" ? true : false;
      const promise = transport()
        .then(() => {
          entries.set(key, { state: "succeeded", userRetryUsed });
        })
        .catch((error) => {
          entries.set(key, { state: "failed", userRetryUsed });
          throw error;
        });

      entries.set(key, { state: "pending", promise, userRetryUsed });
      await promise;
      return "registered";
    },
    reset() {
      entries.clear();
    },
  };
}

export type OwnerPushRuntimeListenerHandle = {
  remove(): Promise<void>;
};

export type OwnerPushRuntimeRegistry = {
  activeGeneration: number;
  nextGeneration: number;
  registrationCoordinator: OwnerPushRegistrationCoordinator;
  listenerGeneration: number | null;
  listenerSetupPromise: Promise<void> | null;
  listenerHandles: OwnerPushRuntimeListenerHandle[];
  listenerDisposalPromise: Promise<void>;
  pendingRegistrationIntent: OwnerPushRegistrationIntent;
};

export type OwnerPushRuntimeOwner = {
  registry: OwnerPushRuntimeRegistry;
  generation: number;
};

type OwnerPushRuntimeGlobal = typeof globalThis & {
  __PETMANAGER_OWNER_PUSH_RUNTIME_REGISTRY_V1__?: OwnerPushRuntimeRegistry;
};

function getOwnerPushRuntimeRegistry() {
  const host = globalThis as OwnerPushRuntimeGlobal;
  if (!host.__PETMANAGER_OWNER_PUSH_RUNTIME_REGISTRY_V1__) {
    host.__PETMANAGER_OWNER_PUSH_RUNTIME_REGISTRY_V1__ = {
      activeGeneration: 0,
      nextGeneration: 0,
      registrationCoordinator: createOwnerPushRegistrationCoordinator(),
      listenerGeneration: null,
      listenerSetupPromise: null,
      listenerHandles: [],
      listenerDisposalPromise: Promise.resolve(),
      pendingRegistrationIntent: "automatic",
    };
  }
  return host.__PETMANAGER_OWNER_PUSH_RUNTIME_REGISTRY_V1__;
}

async function removeListenerHandles(handles: OwnerPushRuntimeListenerHandle[]) {
  await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
}

export function claimOwnerPushRuntimeGeneration(): OwnerPushRuntimeOwner {
  const registry = getOwnerPushRuntimeRegistry();
  const generation = registry.nextGeneration + 1;
  registry.nextGeneration = generation;
  registry.activeGeneration = generation;
  registry.pendingRegistrationIntent = "automatic";

  const staleHandles = registry.listenerHandles;
  const priorDisposal = registry.listenerDisposalPromise;
  registry.listenerGeneration = null;
  registry.listenerSetupPromise = null;
  registry.listenerHandles = [];
  registry.listenerDisposalPromise = priorDisposal
    .catch(() => undefined)
    .then(() => removeListenerHandles(staleHandles));

  return { registry, generation };
}

export function isOwnerPushRuntimeGenerationActive(owner: OwnerPushRuntimeOwner) {
  return owner.registry.activeGeneration === owner.generation;
}

export async function ensureOwnerPushRuntimeListeners(
  owner: OwnerPushRuntimeOwner,
  install: () => Promise<OwnerPushRuntimeListenerHandle[]>,
) {
  const { registry, generation } = owner;
  if (!isOwnerPushRuntimeGenerationActive(owner)) return false;
  if (registry.listenerGeneration === generation && registry.listenerSetupPromise) {
    await registry.listenerSetupPromise;
    return isOwnerPushRuntimeGenerationActive(owner);
  }

  const setupPromise = (async () => {
    await registry.listenerDisposalPromise;
    if (!isOwnerPushRuntimeGenerationActive(owner)) return;

    const handles = await install();
    if (!isOwnerPushRuntimeGenerationActive(owner)) {
      await removeListenerHandles(handles);
      return;
    }
    registry.listenerHandles = handles;
  })();

  registry.listenerGeneration = generation;
  registry.listenerSetupPromise = setupPromise;
  try {
    await setupPromise;
  } catch (error) {
    if (registry.listenerGeneration === generation) {
      registry.listenerGeneration = null;
      registry.listenerSetupPromise = null;
    }
    throw error;
  }
  return isOwnerPushRuntimeGenerationActive(owner);
}

export async function disposeOwnerPushRuntimeGeneration(
  owner: OwnerPushRuntimeOwner,
  options: { resetRegistration?: boolean } = {},
) {
  const { registry, generation } = owner;
  if (!isOwnerPushRuntimeGenerationActive(owner)) return;

  registry.activeGeneration = 0;
  registry.pendingRegistrationIntent = "automatic";
  const handles = registry.listenerHandles;
  registry.listenerGeneration = null;
  registry.listenerSetupPromise = null;
  registry.listenerHandles = [];
  const priorDisposal = registry.listenerDisposalPromise;
  registry.listenerDisposalPromise = priorDisposal
    .catch(() => undefined)
    .then(() => removeListenerHandles(handles));
  await registry.listenerDisposalPromise;

  if (options.resetRegistration) {
    registry.registrationCoordinator.reset();
  }
}
