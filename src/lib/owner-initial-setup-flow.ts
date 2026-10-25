import { fetchApiJsonWithAuth, getAccessTokenWithRecovery } from "@/lib/api";
import { assertOwnerBootstrapPayload, resolveOwnerMobileRoleContext } from "@/lib/owner-customer-pet-integrity";
import type { BootstrapPayload, BusinessHours } from "@/types/domain";

export type SetupStep = "hours" | "staff" | "pricing" | "complete";
export type SetupReadiness = { shopId: string; steps: Record<"hours" | "staff" | "pricing", boolean>; completed: boolean; nextStep: "hours" | "staff" | "pricing" | null };
export type SetupBootstrap = BootstrapPayload & { initialSetupReadiness: SetupReadiness };

export function setupCheckpointKey(bootstrap: BootstrapPayload) {
  return `petmanager:initial-setup:${bootstrap.shop.owner_user_id ?? "owner"}:${bootstrap.shop.id}`;
}

export function hasSetupCheckpoint(bootstrap: BootstrapPayload) {
  try { return ["hours", "staff", "pricing", "complete"].includes(window.sessionStorage.getItem(setupCheckpointKey(bootstrap)) ?? ""); }
  catch { return false; }
}

export function readSetupCheckpoint(key: string, readiness: SetupReadiness): SetupStep {
  try {
    const step = window.sessionStorage.getItem(key);
    if (step === "complete") return readiness.completed ? "complete" : "hours";
    if (step === "hours") return "hours";
    if (step === "staff") return readiness.steps.hours ? "staff" : "hours";
    if (step === "pricing") return !readiness.steps.hours ? "hours" : !readiness.steps.staff ? "staff" : "pricing";
  } catch { /* Navigation hints are optional, never entitlement state. */ }
  return "hours";
}

export function writeSetupCheckpoint(key: string, step: SetupStep) {
  try { window.sessionStorage.setItem(key, step); } catch { /* Server data remains canonical. */ }
}

export async function reloadSetup(shopId: string): Promise<SetupBootstrap> {
  const result = await fetchApiJsonWithAuth<SetupBootstrap>(`/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=essential`, { cache: "no-store" });
  const data = assertOwnerBootstrapPayload(result, shopId, { allowMock: false });
  const readiness = result.initialSetupReadiness;
  if (resolveOwnerMobileRoleContext(data).appRole !== "owner" || !readiness || readiness.shopId !== shopId ||
      !readiness.steps || ["hours", "staff", "pricing"].some((key) => typeof readiness.steps[key as keyof typeof readiness.steps] !== "boolean") ||
      (readiness.nextStep !== null && !["hours", "staff", "pricing"].includes(readiness.nextStep)) ||
      typeof readiness.completed !== "boolean" || readiness.completed !== Object.values(readiness.steps).every(Boolean)) {
    throw new Error("초기 설정 상태를 확인하지 못했어요. 다시 시도해 주세요.");
  }
  return { ...data, initialSetupReadiness: readiness };
}

export async function saveSetupStep(step: "hours" | "staff", payload: unknown) {
  const token = await getAccessTokenWithRecovery();
  if (!token) throw new Error("로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.");
  const response = await fetch("/api/owner/initial-setup", {
    method: "PATCH", credentials: "omit", redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ step, payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result?.message === "string" ? result.message : "설정을 저장하지 못했어요.");
}

export function validateSetupHours(hours: BusinessHours, bookingStart: string, bookingEnd: string) {
  const enabled = Object.values(hours).filter((value) => value?.enabled);
  const valid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!enabled.length) throw new Error("영업일을 한 개 이상 선택해 주세요.");
  if (enabled.some((value) => !value || !valid(value.open) || !valid(value.close) || value.open >= value.close)) throw new Error("영업 시작·종료 시간을 확인해 주세요.");
  if (!valid(bookingStart) || !valid(bookingEnd) || bookingStart >= bookingEnd) throw new Error("예약 가능한 시작·마지막 시간을 확인해 주세요.");
}
