export type OwnerCareReportLocalDraft = {
  sourceText: string;
  revisionText: string;
  report: Record<string, unknown> | null;
  photoConsent: boolean;
  weight: string;
  nextDate: string | null;
  selectedIds: Partial<Record<"grooming_before" | "grooming_after", string>>;
};

const STORAGE_PREFIX = "petmanager.owner.care-report-draft.v1:";

function storageKey(shopId: string, appointmentId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(shopId)}:${encodeURIComponent(appointmentId)}`;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function readOwnerCareReportLocalDraft(shopId: string, appointmentId: string): OwnerCareReportLocalDraft | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(shopId, appointmentId)) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    const draft = parsed as Partial<OwnerCareReportLocalDraft>;
    if (
      typeof draft.sourceText !== "string" ||
      typeof draft.revisionText !== "string" ||
      typeof draft.photoConsent !== "boolean" ||
      typeof draft.weight !== "string" ||
      !isStringOrNull(draft.nextDate) ||
      (draft.report !== null && (typeof draft.report !== "object" || Array.isArray(draft.report))) ||
      !draft.selectedIds ||
      typeof draft.selectedIds !== "object"
    ) return null;
    return {
      sourceText: draft.sourceText.slice(0, 4000),
      revisionText: draft.revisionText.slice(0, 1000),
      report: draft.report as Record<string, unknown> | null,
      photoConsent: draft.photoConsent,
      weight: draft.weight.slice(0, 24),
      nextDate: draft.nextDate,
      selectedIds: {
        grooming_before: typeof draft.selectedIds.grooming_before === "string" ? draft.selectedIds.grooming_before : undefined,
        grooming_after: typeof draft.selectedIds.grooming_after === "string" ? draft.selectedIds.grooming_after : undefined,
      },
    };
  } catch {
    return null;
  }
}

export function writeOwnerCareReportLocalDraft(shopId: string, appointmentId: string, draft: OwnerCareReportLocalDraft) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(shopId, appointmentId), JSON.stringify(draft));
  } catch {
    // Local recovery is best-effort only; the visible draft remains editable.
  }
}

export function clearOwnerCareReportLocalDraft(shopId: string, appointmentId: string) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(shopId, appointmentId));
  } catch {
    // A storage failure must not block closing or publishing the report.
  }
}

export function clearOwnerCareReportLocalDrafts() {
  const storage = getStorage();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Logout remains available even if local storage is unavailable.
  }
}
