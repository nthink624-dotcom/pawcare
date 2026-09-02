const INTERNAL_ADMIN_ERROR_PATTERN =
  /(?:typeerror:\s*)?fetch failed|\bpgrst\d*\b|postgres|schema cache|relation .+ does not exist|supabase|\beconn\w*\b|\benotfound\b|permission denied/i;

export function getAdminErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";

  if (!message || INTERNAL_ADMIN_ERROR_PATTERN.test(message)) {
    return fallback;
  }

  return message;
}
