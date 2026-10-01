export const PETMANAGER_SUPABASE_PROJECT_REFS = {
  development: "qefxdtmdtvnzgupmjlom",
  production: "ysxykikqnneuhypybjry",
} as const;

export function isAllowedPetManagerDevelopmentSupabaseProject(
  supabaseUrl: string | undefined,
  allowedDevelopmentRefs: string | undefined,
) {
  if (!supabaseUrl) return false;

  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return false;
  }

  const ref = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? "";
  const allowedRefs = new Set((allowedDevelopmentRefs ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  return Boolean(ref && ref !== PETMANAGER_SUPABASE_PROJECT_REFS.production && allowedRefs.has(ref));
}

export function isPetManagerProductionSupabaseProject(
  environmentName: string | undefined,
  supabaseUrl: string | undefined,
) {
  if (environmentName !== "production" || !supabaseUrl) return false;

  try {
    const url = new URL(supabaseUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === `${PETMANAGER_SUPABASE_PROJECT_REFS.production}.supabase.co` &&
      !url.port &&
      !url.username &&
      !url.password &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
