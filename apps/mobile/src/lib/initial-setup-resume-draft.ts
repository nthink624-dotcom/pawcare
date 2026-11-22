import type { BootstrapStaffMember } from "@/types/domain";
import type { SetupReadiness, SetupStep } from "@/lib/owner-initial-setup-flow";

type ResumeStep = Exclude<SetupStep, "complete">;
const steps: ResumeStep[] = ["hours", "staff", "pricing"];
const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const fields = ["id", "name", "profileImageUrl", "profileImageUrls", "profileImageAssetIds", "profileImageFallbackKey", "defaultDays", "startTime", "endTime"] as const;
type DraftStaff = Pick<BootstrapStaffMember, typeof fields[number]>;
const ttl = 24 * 60 * 60 * 1000;
const storageKey = (key: string) => `${key}:resume:v1`;

function pickStaff(member: DraftStaff): DraftStaff {
  return Object.fromEntries(fields.filter((field) => member[field] !== undefined).map((field) => [field, member[field]])) as DraftStaff;
}

function isStaff(value: unknown): value is DraftStaff {
  if (!value || typeof value !== "object") return false;
  const member = value as Record<string, unknown>;
  const optionalString = (field: string) => member[field] === undefined || member[field] === null || typeof member[field] === "string";
  const stringArray = (field: string) => member[field] === undefined || (Array.isArray(member[field]) && member[field].length <= 100 && member[field].every((v: unknown) => typeof v === "string"));
  return typeof member.id === "string" && member.id.length > 0 && member.id.length <= 200
    && typeof member.name === "string" && member.name.length <= 500
    && ["profileImageUrl", "profileImageFallbackKey"].every(optionalString)
    && ["startTime", "endTime"].every((field) => member[field] === undefined || typeof member[field] === "string")
    && ["profileImageUrls", "profileImageAssetIds", "defaultDays"].every(stringArray)
    && (member.defaultDays === undefined || (member.defaultDays as string[]).every((day) => days.includes(day)))
    && (member.profileImageFallbackKey == null || ["korean-groomer-profile-01", "korean-groomer-profile-02"].includes(member.profileImageFallbackKey as string));
}

export function clearSetupResumeDraft(key: string) {
  try { window.sessionStorage.removeItem(storageKey(key)); } catch { /* Optional browser draft. */ }
}

export function readSetupResumeDraft(key: string, readiness: SetupReadiness, canonicalStaff: BootstrapStaffMember[]): { step: ResumeStep; staff: BootstrapStaffMember[] } | null {
  try {
    if (readiness.completed) { clearSetupResumeDraft(key); return null; }
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const firstIncomplete = steps.findIndex((step) => !readiness.steps[step]);
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || Date.now() - value.savedAt > ttl
      || !steps.includes(value.step) || firstIncomplete < 0 || steps.indexOf(value.step) > firstIncomplete
      || !Array.isArray(value.staff) || value.staff.length > 100 || !value.staff.every(isStaff)
      || new Set(value.staff.map((member: DraftStaff) => member.id)).size !== value.staff.length) {
      clearSetupResumeDraft(key); return null;
    }
    return { step: value.step, staff: value.staff.map((member: DraftStaff) => ({ ...canonicalStaff.find((saved) => saved.id === member.id), ...pickStaff(member) })) };
  } catch { clearSetupResumeDraft(key); return null; }
}

export function saveSetupResumeDraft(key: string, step: ResumeStep, staff: BootstrapStaffMember[]) {
  // Only editable setup fields are kept for this browser session; credentials,
  // phone numbers, customer records and the full bootstrap never enter it.
  if (!steps.includes(step) || staff.length > 100 || !staff.every(isStaff) || new Set(staff.map((member) => member.id)).size !== staff.length) throw new Error("Invalid setup draft");
  const value = JSON.stringify({ version: 1, savedAt: Date.now(), step, staff: staff.map(pickStaff) });
  window.sessionStorage.setItem(storageKey(key), value);
  if (window.sessionStorage.getItem(storageKey(key)) !== value) throw new Error("Setup draft readback failed");
}
