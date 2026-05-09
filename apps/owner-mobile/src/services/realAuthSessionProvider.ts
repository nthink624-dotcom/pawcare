import type { AuthSessionProvider } from "@/services/authSessionProvider";
import type { AuthSessionStorage } from "@/services/authSessionStorage";
import type { OwnerSupabaseAuthClient } from "@/services/supabaseAuthClient";

const notImplementedMessage =
  "Real Supabase Auth session provider is not implemented yet. Use the mock auth provider until the approved auth step.";

export type RealAuthSessionLogger = {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

export type RealAuthSessionProviderDependencies = {
  supabaseClient?: OwnerSupabaseAuthClient;
  supabaseClientFactory?: () => OwnerSupabaseAuthClient;
  sessionStorage?: AuthSessionStorage;
  now?: () => number;
  logger?: RealAuthSessionLogger;
};

const noopLogger: RealAuthSessionLogger = {
  warn() {},
  error() {},
};

export function createRealAuthSessionProvider(
  dependencies: RealAuthSessionProviderDependencies = {},
): AuthSessionProvider {
  const resolvedDependencies = {
    now: Date.now,
    logger: noopLogger,
    ...dependencies,
  };

  void resolvedDependencies;

  return {
    async getSession() {
      throw new Error(notImplementedMessage);
    },
    async getAccessToken() {
      throw new Error(notImplementedMessage);
    },
    async signIn() {
      throw new Error(notImplementedMessage);
    },
    async signOut() {
      throw new Error(notImplementedMessage);
    },
    async restoreSession() {
      throw new Error(notImplementedMessage);
    },
  };
}
