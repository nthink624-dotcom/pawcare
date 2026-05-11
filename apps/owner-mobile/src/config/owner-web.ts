const PLACEHOLDER_HOSTS = new Set(["example.com", "www.example.com"]);

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

  return {
    url: parsed.toString(),
    origin: parsed.origin,
    allowNavigation: [parsed.hostname],
    cleartext: parsed.protocol === "http:",
  };
}
