export type HttpsTransportUrlOptions = {
  allowLoopbackInDevelopment?: boolean;
  runtimeEnvironment?: string;
};

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function requireHttpsTransportUrl(
  value: string,
  label: string,
  options: HttpsTransportUrlOptions = {},
) {
  const normalized = value.trim();
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label}: HTTPS transport is required.`);
  }

  if (parsed.protocol === "https:") return normalized;

  const runtimeEnvironment = options.runtimeEnvironment ?? process.env.NODE_ENV;
  const isDevelopmentRuntime =
    runtimeEnvironment === "development" || runtimeEnvironment === "test";
  const isAllowedDevelopmentLoopback =
    options.allowLoopbackInDevelopment === true &&
    isDevelopmentRuntime &&
    parsed.protocol === "http:" &&
    LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());

  if (isAllowedDevelopmentLoopback) return normalized;

  throw new Error(`${label}: HTTPS transport is required.`);
}
