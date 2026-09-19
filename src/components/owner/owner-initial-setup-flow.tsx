"use client";

import { useRef, useState } from "react";
import SetupModal from "@/components/ui/setup-modal";
import MobileAiPriceGuideFixture, { type PriceGuideSessionState } from "@/components/auth/mobile-ai-price-guide-fixture";
import { readBootstrapPriceGuideState } from "@/lib/price-photo/bootstrap-price-guide-state";
import { readSetupCheckpoint, reloadSetup, saveSetupStep, validateSetupHours, writeSetupCheckpoint, type SetupReadiness, type SetupStep } from "@/lib/owner-initial-setup-flow";
import type { BootstrapPayload } from "@/types/domain";
import type { OwnerMobileRoleContext } from "@/lib/owner-customer-pet-integrity";
import { SetupHoursFields, setupButton } from "./initial-setup-fields";
import SetupStaffFields from "./setup-staff-fields";
import SetupClosedDays from "./setup-closed-days";
import { bookingBoundsFromHours, validateClosedPolicy, restoreTemporaryClosedDates, unifiedHoursPolicy, type SetupClosureCycle } from "@/lib/initial-setup-hours-policy";
import { readHoursDraft, saveHoursDraft, clearHoursDraft } from "@/lib/initial-setup-hours-draft";

type OwnerInitialSetupState = { readiness: SetupReadiness; roleContext: OwnerMobileRoleContext; bootstrap?: BootstrapPayload };
export default function OwnerInitialSetupFlow({ setup, onRefresh, onDefer, onFinish }: {
  setup: OwnerInitialSetupState; onRefresh: () => void; onFinish: () => void;
  onDefer: () => void;
}) {
  if (setup.roleContext.appRole !== "owner" || !setup.bootstrap) return <SetupModal label="초기 설정 안내" onCancel={() => undefined}><section className="space-y-4 p-5">
    <h1 className="text-[20px] font-semibold">초기 설정</h1>
    <p>대표가 매장 초기 설정을 완료하면 이용할 수 있습니다.</p>
    <button className={`${setupButton} w-full`} onClick={onRefresh}>설정 상태 다시 확인</button>
  </section></SetupModal>;
  return <InitialSetupWizard bootstrap={setup.bootstrap} readiness={setup.readiness} onDefer={onDefer} onFinish={onFinish} />;
}

function InitialSetupWizard({ bootstrap, readiness, onDefer, onFinish }: { bootstrap: BootstrapPayload; readiness: SetupReadiness; onDefer: () => void; onFinish: () => void }) {
  const key = `petmanager:initial-setup:${bootstrap.shop.owner_user_id ?? "owner"}:${bootstrap.shop.id}`;
  const [hoursDraft] = useState(() => readHoursDraft(key));
  const [draftNotice, setDraftNotice] = useState("");
  const [step, setStep] = useState<SetupStep>(() => readSetupCheckpoint(key, readiness));
  const initialCycle = hoursDraft?.cycle ?? bootstrap.shop.regular_closed_cycle ?? "weekly";
  const initialClosedDays = hoursDraft?.regularClosedDays ?? bootstrap.shop.regular_closed_days;
  const [hours, setHours] = useState(() => Object.fromEntries(Object.entries(hoursDraft?.hours ?? bootstrap.shop.business_hours).map(([day, value]) => [day,
    value && initialClosedDays.includes(Number(day)) ? { ...value, enabled: false } : value,
  ])));
  const [temporaryClosedDates, setTemporaryClosedDates] = useState(() => restoreTemporaryClosedDates(bootstrap.shop.temporary_closed_dates, hoursDraft?.temporaryClosedDates, hoursDraft?.temporaryClosedDatesBaseline));
  const [staff, setStaff] = useState(bootstrap.staffMembers);
  const [savedStaffIds, setSavedStaffIds] = useState(() => bootstrap.staffMembers.map((member) => member.id));
  const [cycle, setCycle] = useState<SetupClosureCycle>(initialCycle === "biweekly" ? "weekly" : initialCycle);
  const { businessHours: canonicalHours, regularClosedDays } = unifiedHoursPolicy(hours, cycle);
  const { bookingStart, bookingEnd } = bookingBoundsFromHours(canonicalHours);
  const [draft, setDraft] = useState<PriceGuideSessionState | null>(() => readBootstrapPriceGuideState(bootstrap.services));
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const verifiedStaffDraft = useRef<string | null>(null);
  const advance = (next: SetupStep) => { writeSetupCheckpoint(key, next); setStep(next); setError(""); };
  const pause = () => { if (!lock.current && !uploadLock.current && step !== "complete") { writeSetupCheckpoint(key, step); onDefer(); } };

  function saveTemporaryHours() {
    if (lock.current) return;
    setError(""); setDraftNotice("");
    try {
      saveHoursDraft(key, { hours, bookingStart, bookingEnd, regularClosedDays, cycle, temporaryClosedDates, temporaryClosedDatesBaseline: bootstrap.shop.temporary_closed_dates });
      setDraftNotice("이 브라우저에 24시간 임시 저장했어요.");
    } catch { setError("임시 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
  }

  async function save() {
    if (lock.current || uploadLock.current || (step !== "hours" && step !== "staff")) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (step === "hours") {
        validateSetupHours(canonicalHours, bookingStart, bookingEnd);
        validateClosedPolicy(cycle, "", regularClosedDays, canonicalHours);
        const normalizedHours = Object.fromEntries(Object.entries(canonicalHours).map(([day, value]) => [day, value?.enabled ? value : { enabled: false, open: value?.open || bookingStart, close: value?.close || bookingEnd }]));
        await saveSetupStep("hours", {
          shopId: bootstrap.shop.id, businessHours: normalizedHours,
          bookingAvailableStartTime: bookingStart, bookingAvailableEndTime: bookingEnd,
          regularClosedDays,
          regularClosedCycle: cycle,
          regularClosedAnchorDate: null,
          temporaryClosedDates,
          temporaryClosedDateChanges: {
            add: temporaryClosedDates.filter((date) => !bootstrap.shop.temporary_closed_dates.includes(date)),
            remove: bootstrap.shop.temporary_closed_dates.filter((date) => !temporaryClosedDates.includes(date)),
          },
        });
      } else {
        if (!staff.length || staff.some((member) => !member.name.trim() || !member.defaultDays?.length || !member.startTime || !member.endTime || member.startTime >= member.endTime)) throw new Error("담당자 이름과 근무 요일·시간을 확인해 주세요.");
        if (staff.some((member) => !member.profileImageUrl && !member.profileImageUrls?.length && !member.profileImageAssetIds?.length && !member.profileImageFallbackKey)) throw new Error("담당자 프로필을 선택해 주세요.");
        if (verifiedStaffDraft.current !== JSON.stringify(staff)) await saveSetupStep("staff", { shopId: bootstrap.shop.id, staffMembers: staff.map((member) => ({
          ...member, displayName: member.displayName ?? "", profileImageUrl: member.profileImageUrl ?? "",
          profileMessage: member.profileMessage ?? "", phone: member.phone ?? "", titlePrefix: member.titlePrefix ?? "",
          role: member.role ?? "직원", position: member.position ?? "직원",
        })) });
      }
      const fresh = await reloadSetup(bootstrap.shop.id);
      setSavedStaffIds(fresh.staffMembers.map((member) => member.id));
      if (!fresh.initialSetupReadiness.steps[step]) throw new Error("저장된 설정을 확인하지 못했어요. 다시 시도해 주세요.");
      if (step === "staff" && !fresh.initialSetupReadiness.steps.hours) { advance("hours"); throw new Error("영업시간 설정을 다시 확인해 주세요."); }
      if (step === "hours") { clearHoursDraft(key); setDraftNotice(""); advance("staff"); }
      else { verifiedStaffDraft.current = JSON.stringify(staff); setDraft((current) => current ?? readBootstrapPriceGuideState(fresh.services)); advance("pricing"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "설정을 저장하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function verifyComplete() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const fresh = await reloadSetup(bootstrap.shop.id);
      if (!fresh.initialSetupReadiness.completed) throw new Error("설정이 모두 저장되지 않았어요. 이전 단계의 저장 상태를 확인해 주세요.");
      advance("complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장 상태를 확인하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }

  if (step === "pricing") return <SetupModal label="초기 설정 · 서비스와 가격" onCancel={() => { if (!lock.current) window.dispatchEvent(new Event("owner-mobile-back-request", { cancelable: true })); }}>
    {error && <p role="alert" className="px-5 pt-4 text-[14px] text-red-600">{error}</p>}
    {busy ? <p role="status" className="p-5">저장 상태를 확인하고 있어요.</p> : <MobileAiPriceGuideFixture
      presentation="modal" setupFlow shopId={bootstrap.shop.id} ownerBottomNavigation={false}
      initialRows={draft?.rows ?? null} initialDocument={draft?.document ?? null} initialServiceId={draft?.serviceId ?? null}
      onComplete={(_rows, state) => { if (state) setDraft(state); void verifyComplete(); }}
      onExit={(_rows, state) => { setDraft(state ?? null); advance("staff"); }}
    />}
  </SetupModal>;

  const titles = { hours: "영업시간 설정", staff: "담당자 설정", pricing: "서비스와 가격", complete: "초기 설정을 완료했어요" };
  return <SetupModal hideScrollbar label={titles[step]} onCancel={pause}>
    <section className={`space-y-5 py-5 text-[16px] leading-6 ${step === "staff" ? "px-4" : "px-5"}`}>
      <header className="flex items-center justify-between gap-3"><h1 className="text-[20px] font-semibold leading-7">{titles[step]}</h1>
        {(step === "hours" || step === "staff") && <button disabled={busy || uploading} className="min-h-11 text-[14px] text-[#64748b]" onClick={pause}>나중에 하기</button>}
      </header>
      {step === "complete" ? <>
        <p className="text-[#64748b]">매장 운영을 시작할 준비가 됐어요.</p>
        <button className={`${setupButton} w-full`} onClick={() => { try { window.sessionStorage.removeItem(key); } catch { /* Optional navigation hint. */ } onFinish(); }}>매장 시작하기</button>
      </> : <>
        <fieldset disabled={busy || uploading}>
          {step === "hours" ? <>
            <SetupHoursFields hours={hours} onChange={setHours} monthlyClosure={cycle !== "weekly"} />
            <SetupClosedDays cycle={cycle} onCycleChange={setCycle} dates={temporaryClosedDates} onDatesChange={setTemporaryClosedDates} />
          </> : <SetupStaffFields staff={staff} onChange={setStaff} savedIds={savedStaffIds} shopId={bootstrap.shop.id} onUploadingChange={(value) => { uploadLock.current = value; setUploading(value); }} />}
        </fieldset>
        {error && <p role="alert" className="text-[14px] text-red-600">{error}</p>}
        {step === "hours" && draftNotice && <p role="status" className="text-[13px] leading-5 text-[#64748b]" style={{ marginTop: 12 }}>{draftNotice}</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: step === "staff" ? "minmax(0,35fr) minmax(0,65fr)" : "auto minmax(0,1fr)" }}>
          {step === "hours" && <button type="button" disabled={busy || uploading} className="min-h-12 rounded-[10px] border border-[#d9e1ec] px-3 text-[14px] text-[#475569] disabled:opacity-50" onClick={saveTemporaryHours}>임시 저장</button>}
          {step === "staff" && <button disabled={busy || uploading} className="min-h-12 rounded-[10px] border border-[#d9e1ec]" onClick={() => advance("hours")}>이전</button>}
          <button disabled={busy || uploading} className={setupButton} onClick={() => void save()}>{busy ? "저장 중…" : "저장하고 다음"}</button>
        </div>
      </>}
    </section>
  </SetupModal>;
}
