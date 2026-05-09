import type { AuthSessionProvider } from "@/services/authSessionProvider";
import type { AuthSessionStorage } from "@/services/authSessionStorage";
import {
  mapSupabaseSessionToAuthSession,
  type SupabaseSessionLike,
} from "@/services/authSessionMapper";
import type { OwnerSupabaseAuthClient } from "@/services/supabaseAuthClient";
import type { AuthSession, AuthSignInCredentials } from "@/types/auth";

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
  signInSource?: {
    signIn(credentials: AuthSignInCredentials): Promise<SupabaseSessionLike | null>;
  };
  signOutSource?: {
    signOut(): Promise<void>;
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
  const canUseInjectedAuth = Boolean(
    resolvedDependencies.sessionSource || resolvedDependencies.signInSource || resolvedDependencies.signOutSource,
  );

  return {
    async getSession() {
      if (canUseInjectedAuth) {
        return currentSession;
      }

      throw new Error(notImplementedMessage);
    },
    async getAccessToken() {
      if (canUseInjectedAuth) {
        return currentSession?.accessToken ?? null;
      }

      throw new Error(notImplementedMessage);
    },
    async signIn(credentials) {
      if (!resolvedDependencies.signInSource) {
        throw new Error(notImplementedMessage);
      }

      try {
        const sessionLike = await resolvedDependencies.signInSource.signIn(credentials);
        currentSession = mapSupabaseSessionToAuthSession(sessionLike, {
          now: resolvedDependencies.now,
        });

        if (!currentSession) {
          throw new Error("Owner sign in did not return a valid session.");
        }

        return currentSession;
      } catch (error) {
        currentSession = null;
        resolvedDependencies.logger.error("Failed to sign in owner auth session.");
        throw error;
      }
    },
    async signOut() {
      if (!resolvedDependencies.signOutSource) {
        throw new Error(notImplementedMessage);
      }

      try {
        await resolvedDependencies.signOutSource.signOut();
        currentSession = null;
      } catch (error) {
        currentSession = null;
        resolvedDependencies.logger.error("Failed to sign out owner auth session.");
        throw error;
      }
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
