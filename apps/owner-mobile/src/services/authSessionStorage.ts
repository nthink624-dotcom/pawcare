import type * as ExpoSecureStore from "expo-secure-store";

export type AuthSessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type SecureStoreDriver = {
  getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
};

type SecureStoreOptions = Parameters<typeof ExpoSecureStore.getItemAsync>[1];

declare const require:
  | ((moduleName: "expo-secure-store") => typeof ExpoSecureStore)
  | undefined;

export type CreateSecureStoreAuthSessionStorageOptions = {
  secureStore?: SecureStoreDriver;
  secureStoreOptions?: SecureStoreOptions;
};

function getDefaultSecureStoreDriver(): SecureStoreDriver {
  if (typeof require !== "function") {
    throw new Error("expo-secure-store is not available in this runtime.");
  }

  return require("expo-secure-store");
}

export function createSecureStoreAuthSessionStorage({
  secureStore = getDefaultSecureStoreDriver(),
  secureStoreOptions,
}: CreateSecureStoreAuthSessionStorageOptions = {}): AuthSessionStorage {
  return {
    getItem(key) {
      return secureStore.getItemAsync(key, secureStoreOptions);
    },
    async setItem(key, value) {
      await secureStore.setItemAsync(key, value, secureStoreOptions);
    },
    async removeItem(key) {
      await secureStore.deleteItemAsync(key, secureStoreOptions);
    },
  };
}

export function createMemoryAuthSessionStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    hasItem(key: string) {
      return values.has(key);
    },
  } satisfies AuthSessionStorage & {
    clear(): void;
    hasItem(key: string): boolean;
  };
}
