const SAFE_NEXT_BASE_ORIGIN = "https://petmanager.invalid";
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const BACKSLASH_PATTERN = /\\/u;
const MAX_SAFE_NEXT_PATH_LENGTH = 4096;

function isStructurallyInternal(candidate: string) {
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return false;
  if (CONTROL_CHARACTER_PATTERN.test(candidate) || BACKSLASH_PATTERN.test(candidate)) return false;

  const normalizedCandidate = candidate.normalize("NFKC");
  if (!normalizedCandidate.startsWith("/") || normalizedCandidate.startsWith("//")) return false;
  if (CONTROL_CHARACTER_PATTERN.test(normalizedCandidate) || BACKSLASH_PATTERN.test(normalizedCandidate)) return false;

  try {
    for (const value of candidate === normalizedCandidate ? [candidate] : [candidate, normalizedCandidate]) {
      const parsed = new URL(value, SAFE_NEXT_BASE_ORIGIN);
      if (parsed.origin !== SAFE_NEXT_BASE_ORIGIN || parsed.pathname.startsWith("//")) return false;
    }
  } catch {
    return false;
  }

  return true;
}

function isSafeNextPath(value: string) {
  if (value.length === 0 || value.length > MAX_SAFE_NEXT_PATH_LENGTH) return false;

  let candidate = value;
  for (let depth = 0; depth <= value.length; depth += 1) {
    if (!isStructurallyInternal(candidate)) return false;

    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return false;
    }

    if (decoded === candidate) return true;
    candidate = decoded;
  }

  return false;
}

export function getSafeNextPath(
  value: string | null | undefined,
  fallbackPath: string,
) {
  return typeof value === "string" && isSafeNextPath(value) ? value : fallbackPath;
}
