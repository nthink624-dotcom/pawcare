import type { AuthSessionProvider } from "@/services/authSessionProvider";
import type { AuthSessionStorage } from "@/services/authSessionStorage";
import {
  mapSupabaseSessionToAuthSession,
  type SupabaseSessionLike,
} from "@/services/authSessionMapper";
import type { OwnerSupabaseAuthClient } from "@/services/supabaseAuthClient";
import type { AuthSession } from "@/types/auth";

const notImplementedMessage =
  "Real Supabase Auth session provider is not implemented yet. Use the mock auth provider until the approved auth step.";

export type RealAuthSessionLogger = {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

export type RealAuthSessionProviderDependencies = {
  supabaseClient?: OwnerSupabaseAuthClient;
  supabaseClientFactory?: () => OwnerSupabaseAuthClient;
  sessionSource?: {
    readSession(): Promise<SupabaseSessionLike | null>;
  };
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
  let currentSession: AuthSession | null = null;
  const canReadInjectedSession = Boolean(resolvedDependencies.sessionSource);

  return {
    async getSession() {
      if (canReadInjectedSession) {
        return currentSession;
      }

      throw new Error(notImplementedMessage);
    },
    async getAccessToken() {
      if (canReadInjectedSession) {
        return currentSession?.accessToken ?? null;
      }

      throw new Error(notImplementedMessage);
    },
    async signIn() {
      throw new Error(notImplementedMessage);
    },
    async signOut() {
      throw new Error(notImplementedMessage);
    },
    async restoreSession() {
      if (!resolvedDependencies.sessionSource) {
        throw new Error(notImplementedMessage);
      }

      try {
        const sessionLike = await resolvedDependencies.sessionSource.readSession();
        currentSession = mapSupabaseSessionToAuthSession(sessionLike, {
          now: resolvedDependencies.now,
        });

        return currentSession;
      } catch {
        currentSession = null;
        resolvedDependencies.logger.error("Failed to restore owner auth session.");
        return null;
      }
    },
  };
}
