export type ShellNavigationIntent = "internal" | "external" | "telephone" | "unsupported";

function tryParseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function resolveNavigationIntent(rawUrl: string, ownerOrigin: string | null) {
  const parsed = tryParseUrl(rawUrl);

  if (!parsed) {
    return "unsupported" as const;
  }

  if (parsed.protocol === "tel:") {
    return "telephone" as const;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "unsupported" as const;
  }

  if (ownerOrigin && parsed.origin === ownerOrigin) {
    return "internal" as const;
  }

  return "external" as const;
}
