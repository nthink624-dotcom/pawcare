export type CareReport = {
  reportText: string;
};

export function normalizeCareReport(value: unknown): CareReport | null {
  if (typeof value === "string") return value.trim() ? { reportText: value.trim() } : null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.reportText === "string" && row.reportText.trim()) return { reportText: row.reportText.trim().slice(0, 4000) };
  const legacyParts = [
    row.oneLineSummary,
    row.treatmentSummary,
    row.conditionSummary,
    row.groomingResponse,
    ...(Array.isArray(row.homeCareTips) ? row.homeCareTips : []),
    row.nextVisitGuide,
  ].filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  const reportText = legacyParts.filter((part, index) => legacyParts.indexOf(part) === index).join(" ").slice(0, 4000);
  return reportText ? { reportText } : null;
}
