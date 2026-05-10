import type { AuthSessionProvider } from "@/services/authSessionProvider";
import type { AuthSessionStorage } from "@/services/authSessionStorage";
import {
  mapSupabaseSessionToAuthSession,
  type SupabaseSessionLike,
} from "@/services/authSessionMapper";
import { getOwnerSupabaseAuthClient, type OwnerSupabaseAuthClient } from "@/services/supabaseAuthClient";
import type { AuthSession, AuthSignInCredentials } from "@/types/auth";

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

function getSupabaseClient(dependencies: RealAuthSessionProviderDependencies) {
  if (dependencies.supabaseClient) return dependencies.supabaseClient;
  if (dependencies.supabaseClientFactory) return dependencies.supabaseClientFactory();

  return getOwnerSupabaseAuthClient(undefined, {
    authStorage: dependencies.sessionStorage,
  });
}

function mapRequiredSession(sessionLike: SupabaseSessionLike | null, now: () => number) {
  const authSession = mapSupabaseSessionToAuthSession(sessionLike, { now });
  if (!authSession) {
    throw new Error("Owner auth did not return a valid session.");
  }

  return authSession;
}

export function createRealAuthSessionProvider(
  dependencies: RealAuthSessionProviderDependencies = {},
): AuthSessionProvider {
  const resolvedDependencies = {
    now: Date.now,
    logger: noopLogger,
    ...dependencies,
  };
  let currentSession: AuthSession | null = null;

  return {
    async getSession() {
      return currentSession;
    },
    async getAccessToken() {
      return currentSession?.accessToken ?? null;
    },
    async signIn(credentials) {
      try {
        const sessionLike = resolvedDependencies.signInSource
          ? await resolvedDependencies.signInSource.signIn(credentials)
          : await signInWithSupabasePassword(getSupabaseClient(resolvedDependencies), credentials);
        currentSession = mapRequiredSession(sessionLike, resolvedDependencies.now);

        return currentSession;
      } catch (error) {
        currentSession = null;
        resolvedDependencies.logger.error("Failed to sign in owner auth session.");
        throw error;
      }
    },
    async signOut() {
      try {
        if (resolvedDependencies.signOutSource) {
          await resolvedDependencies.signOutSource.signOut();
        } else {
          await signOutWithSupabase(getSupabaseClient(resolvedDependencies));
        }
        currentSession = null;
      } catch (error) {
        currentSession = null;
        resolvedDependencies.logger.error("Failed to sign out owner auth session.");
        throw error;
      }
    },
    async restoreSession() {
      try {
        const sessionLike = resolvedDependencies.sessionSource
          ? await resolvedDependencies.sessionSource.readSession()
          : await restoreSupabaseSession(getSupabaseClient(resolvedDependencies));
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

async function signInWithSupabasePassword(client: OwnerSupabaseAuthClient, credentials: AuthSignInCredentials) {
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.loginId,
    password: credentials.password,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

async function restoreSupabaseSession(client: OwnerSupabaseAuthClient) {
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

async function signOutWithSupabase(client: OwnerSupabaseAuthClient) {
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}
