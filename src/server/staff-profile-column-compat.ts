type StaffColumnError = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

export const staffProfileOptionalColumns = [
  "display_name",
  "profile_image_url",
  "profile_image_urls",
  "profile_image_asset_ids",
  "title_prefix",
  "position",
] as const;

export const staffProfileRequiredPreferenceColumns = ["profile_message", "chip_color_index", "profile_image_fallback_key"] as const;

const knownStaffProfileColumns = [
  ...staffProfileOptionalColumns,
  ...staffProfileRequiredPreferenceColumns,
] as const;

export type StaffProfileOptionalColumn = (typeof staffProfileOptionalColumns)[number];

function isStaffProfileColumnError(error: StaffColumnError) {
  const message = error?.message?.toLowerCase() ?? "";
  return (error?.code === "PGRST204" || error?.code === "42703") && message.includes("staff_members");
}

export function getMissingStaffProfileColumn(error: StaffColumnError) {
  if (!isStaffProfileColumnError(error)) return null;
  const message = error?.message?.toLowerCase() ?? "";
  return knownStaffProfileColumns.find((column) => message.includes(column)) ?? null;
}

export function getNextStaffProfileOptionalColumn(
  error: StaffColumnError,
  omittedColumns: ReadonlySet<string>,
) {
  const column = getMissingStaffProfileColumn(error);
  if (!column || !staffProfileOptionalColumns.includes(column as StaffProfileOptionalColumn)) return null;
  return omittedColumns.has(column) ? null : column;
}

export function isMissingRequiredStaffPreferenceColumn(error: StaffColumnError) {
  const column = getMissingStaffProfileColumn(error);
  return column !== null && staffProfileRequiredPreferenceColumns.includes(column as (typeof staffProfileRequiredPreferenceColumns)[number]);
}

export function omitStaffProfileColumns<T extends Record<string, unknown>>(
  row: T,
  omittedColumns: ReadonlySet<string>,
) {
  const compatibleRow = { ...row } as Record<string, unknown>;
  for (const column of omittedColumns) delete compatibleRow[column];
  return compatibleRow as Omit<T, StaffProfileOptionalColumn>;
}

export function buildCompatibleStaffProfileSelect(
  fields: readonly string[],
  omittedColumns: ReadonlySet<string>,
) {
  return fields.filter((field) => !omittedColumns.has(field)).join(",");
}
