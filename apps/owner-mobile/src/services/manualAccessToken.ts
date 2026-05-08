export type ManualAccessTokenResolver = () => string | null | undefined | Promise<string | null | undefined>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const PUBLIC_ENV_PREFIX = "EXPO_PUBLIC_";
const TOKEN_ENV_PATTERN = /TOKEN/i;

export const emptyManualAccessTokenResolver: ManualAccessTokenResolver = () => null;

export function createStaticManualAccessTokenResolver(token: string | null | undefined): ManualAccessTokenResolver {
  return () => normalizeManualAccessToken(token);
}

export function normalizeManualAccessToken(token: string | null | undefined) {
  const normalized = token?.trim();
  return normalized ? normalized : null;
}

export function assertNoPublicAccessTokenEnv() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return;

  const publicTokenKey = Object.keys(env).find((key) => {
    const value = env[key]?.trim();
    return key.startsWith(PUBLIC_ENV_PREFIX) && TOKEN_ENV_PATTERN.test(key) && Boolean(value);
  });

  if (publicTokenKey) {
    throw new Error(
      `Owner access token must not be stored in public Expo environment variable ${publicTokenKey}. Use a dev-only runtime resolver instead.`,
    );
  }
}
