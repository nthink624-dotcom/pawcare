const PLACEHOLDER_HOSTS = new Set(["example.com", "www.example.com"]);
const PUBLIC_SITE_HOST = "www.petmanager.co.kr";

export const CANONICAL_OWNER_MOBILE_WEB_URL = "https://app.petmanager.co.kr/owner/mobile";

export type OwnerShellConfig = {
  url: string | null;
  origin: string | null;
  allowNavigation: string[];
  cleartext: boolean;
};

function tryParseUrl(rawValue: string) {
  try {
    return new URL(rawValue);
  } catch {
    return null;
  }
}

export function buildOwnerShellConfig(rawValue: string | undefined | null): OwnerShellConfig {
  const trimmed = rawValue?.trim() ?? "";

  if (!trimmed) {
    return {
      url: null,
      origin: null,
      allowNavigation: [],
      cleartext: false,
    };
  }

  const parsed = tryParseUrl(trimmed);
  if (!parsed || PLACEHOLDER_HOSTS.has(parsed.hostname)) {
    return {
      url: null,
      origin: null,
      allowNavigation: [],
      cleartext: false,
    };
  }

  if (parsed.hostname === PUBLIC_SITE_HOST) {
    throw new Error(
      `OWNER_MOBILE_WEB_URL must point directly to ${CANONICAL_OWNER_MOBILE_WEB_URL}; ` +
        `do not use https://${PUBLIC_SITE_HOST}.`,
    );
  }

  if (parsed.hostname === "app.petmanager.co.kr" && parsed.pathname === "/") {
    throw new Error(
      `OWNER_MOBILE_WEB_URL must include the owner route: ${CANONICAL_OWNER_MOBILE_WEB_URL}.`,
    );
  }

  return {
    url: parsed.toString(),
    origin: parsed.origin,
    allowNavigation: [parsed.hostname],
    cleartext: parsed.protocol === "http:",
  };
}
