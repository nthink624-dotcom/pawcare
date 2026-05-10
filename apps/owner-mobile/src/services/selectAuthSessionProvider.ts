import { assertAuthEnvConfigIsReady, type AuthEnvConfig } from "@/services/authEnvConfig";
import type { AuthSessionProvider } from "@/services/authSessionProvider";
import { mockAuthSessionProvider } from "@/services/mockAuthSessionProvider";
import { createRealAuthSessionProvider } from "@/services/realAuthSessionProvider";

export type OwnerAuthProviderMode = "mock" | "real";

export type AuthSessionProviderSelection =
  | {
      mode: OwnerAuthProviderMode;
      provider: AuthSessionProvider;
      error?: undefined;
    }
  | {
      mode: "real";
      provider?: undefined;
      error: Error;
    };

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

function readEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
}

export function getOwnerAuthProviderMode(): OwnerAuthProviderMode {
  return readEnv("EXPO_PUBLIC_OWNER_AUTH_PROVIDER") === "real" ? "real" : "mock";
}

export function selectAuthSessionProvider(options?: {
  authProviderMode?: OwnerAuthProviderMode;
  authEnvConfig?: AuthEnvConfig;
  mockProvider?: AuthSessionProvider;
  realProviderFactory?: () => AuthSessionProvider;
}): AuthSessionProviderSelection {
  const mode = options?.authProviderMode ?? getOwnerAuthProviderMode();

  if (mode === "mock") {
    return {
      mode: "mock",
      provider: options?.mockProvider ?? mockAuthSessionProvider,
    };
  }

  try {
    assertAuthEnvConfigIsReady(options?.authEnvConfig);

    return {
      mode: "real",
      provider: options?.realProviderFactory?.() ?? createRealAuthSessionProvider(),
    };
  } catch (error) {
    return {
      mode: "real",
      error: error instanceof Error ? error : new Error("Owner auth provider configuration is invalid."),
    };
  }
}
