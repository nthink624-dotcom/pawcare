"use client";

import { useRef, useState } from "react";
import SetupModal from "@/components/ui/setup-modal";
import { WelcomeScreen } from "@/components/ui/onboarding-welcome-screen";
import { PETMANAGER_PRODUCT_NAME } from "@/lib/brand";
import OwnerApp from "./owner-app";
import OwnerInitialSetupFrame, { SetupStepNavigation } from "./owner-initial-setup-frame";
import type { MobilePricePhotoAdapter } from "@/lib/price-photo/mobile-price-photo-adapter";
import MobileAiPriceGuideFixture, { type PriceGuideSessionState } from "@/components/auth/mobile-ai-price-guide-fixture";
import { readBootstrapPriceGuideState } from "@/lib/price-photo/bootstrap-price-guide-state";
import { ownerPriceGuideSessionKey, readOwnerPriceGuideSessionDraft, writeOwnerPriceGuideSessionDraft } from "@/lib/price-photo/owner-price-guide-session-draft";
import { readSetupCheckpoint, reloadSetup, saveSetupStep, validateSetupHours, writeSetupCheckpoint, type SetupReadiness, type SetupStep } from "@/lib/owner-initial-setup-flow";
import type { BootstrapPayload } from "@/types/domain";
import type { OwnerMobileRoleContext } from "@/lib/owner-customer-pet-integrity";
import { SetupHoursFields, setupButton } from "./initial-setup-fields";
import SetupStaffFields from "./setup-staff-fields";
import { bookingBoundsFromHours, validateClosedPolicy, restoreTemporaryClosedDates, unifiedHoursPolicy, type SetupClosureCycle } from "@/lib/initial-setup-hours-policy";
import { readHoursDraft, saveHoursDraft, clearHoursDraft } from "@/lib/initial-setup-hours-draft";
import { readSetupResumeDraft, saveSetupResumeDraft, clearSetupResumeDraft } from "@/lib/initial-setup-resume-draft";

type OwnerInitialSetupState = { readiness: SetupReadiness; roleContext: OwnerMobileRoleContext; bootstrap?: BootstrapPayload; welcome?: boolean };
export type InitialSetupOperations = {
  saveStep: typeof saveSetupStep;
  reload: typeof reloadSetup;
  pricePhotoAdapter?: MobilePricePhotoAdapter;
};
const liveSetupOperations: InitialSetupOperations = { saveStep: saveSetupStep, reload: reloadSetup };
export default function OwnerInitialSetupFlow({ setup, onRefresh, onDefer, onFinish }: {
  setup: OwnerInitialSetupState; onRefresh: () => void; onFinish: () => void;
  onDefer: () => void;
}) {
  if (setup.roleContext.appRole !== "owner" || !setup.bootstrap) return <SetupModal label="초기 설정 안내" onCancel={() => undefined}><section className="space-y-4 p-5">
    <h1 className="text-[20px] font-semibold">초기 설정</h1>
    <p>대표가 매장 초기 설정을 완료하면 이용할 수 있습니다.</p>
    <button className={`${setupButton} w-full`} onClick={onRefresh}>설정 상태 다시 확인</button>
  </section></SetupModal>;
  return <InitialSetupWizard bootstrap={setup.bootstrap} readiness={setup.readiness} welcome={setup.welcome} onDefer={onDefer} onFinish={onFinish} />;
}

export function InitialSetupWizard({ bootstrap, readiness, welcome = false, onDefer, onFinish, operations = liveSetupOperations }: { bootstrap: BootstrapPayload; readiness: SetupReadiness; welcome?: boolean; onDefer: () => void; onFinish: () => void; operations?: InitialSetupOperations }) {
  const { saveStep: saveSetupStep, reload: reloadSetup } = operations;
  const key = `petmanager:initial-setup:${bootstrap.shop.owner_user_id ?? "owner"}:${bootstrap.shop.id}`;
  const priceGuideKey = ownerPriceGuideSessionKey(bootstrap);
  const [hoursDraft] = useState(() => readHoursDraft(key));
  const [resumeDraft] = useState(() => readSetupResumeDraft(key, readiness, bootstrap.staffMembers));
  const [step, setStep] = useState<SetupStep>(() => resumeDraft?.step ?? readSetupCheckpoint(key, readiness));
  const initialCycle = hoursDraft?.cycle ?? bootstrap.shop.regular_closed_cycle ?? "weekly";
  const initialClosedDays = hoursDraft?.regularClosedDays ?? bootstrap.shop.regular_closed_days;
  const [hours, setHours] = useState(() => Object.fromEntries(Object.entries(hoursDraft?.hours ?? bootstrap.shop.business_hours).map(([day, value]) => [day,
    value && initialClosedDays.includes(Number(day)) ? { ...value, enabled: false } : value,
  ])));
  const [temporaryClosedDates] = useState(() => restoreTemporaryClosedDates(bootstrap.shop.temporary_closed_dates, hoursDraft?.temporaryClosedDates, hoursDraft?.temporaryClosedDatesBaseline));
  const [staff, setStaff] = useState(resumeDraft?.staff ?? bootstrap.staffMembers);
  const [savedStaffIds, setSavedStaffIds] = useState(() => bootstrap.staffMembers.map((member) => member.id));
  const [cycle] = useState<SetupClosureCycle>(initialCycle === "biweekly" ? "weekly" : initialCycle);
  const { businessHours: canonicalHours, regularClosedDays } = unifiedHoursPolicy(hours, cycle);
  const { bookingStart, bookingEnd } = bookingBoundsFromHours(canonicalHours);
  const [draft, setDraft] = useState<PriceGuideSessionState | null>(() => readOwnerPriceGuideSessionDraft(priceGuideKey) ?? readBootstrapPriceGuideState(bootstrap.services));
  const [uploading, setUploading] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const uploadLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceFooterTarget, setPriceFooterTarget] = useState<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const verifiedStaffDraft = useRef<string | null>(null);
  // Straight after signup, a short welcome comes first; setup opens when the owner taps to start.
  // An owner who has already saved a step resumes the wizard directly.
  const [showWelcome, setShowWelcome] = useState(() => welcome && !Object.values(readiness.steps).some(Boolean));
  const advance = (next: SetupStep) => { clearSetupResumeDraft(key); writeSetupCheckpoint(key, next); setStep(next); setError(""); };

  function persistAndDefer(priceDraft = draft) {
    if (step === "complete") return false;
    setError("");
    try {
      saveHoursDraft(key, { hours, bookingStart, bookingEnd, regularClosedDays, cycle, temporaryClosedDates, temporaryClosedDatesBaseline: bootstrap.shop.temporary_closed_dates });
      saveSetupResumeDraft(key, step, staff);
      writeOwnerPriceGuideSessionDraft(priceGuideKey, priceDraft);
      if (JSON.stringify(readOwnerPriceGuideSessionDraft(priceGuideKey)) !== JSON.stringify(priceDraft)) throw new Error("Price draft readback failed");
      writeSetupCheckpoint(key, step);
      onDefer();
      return true;
    } catch {
      setError("작성 내용을 보관하지 못했어요. 입력 내용과 브라우저 저장 공간을 확인해 주세요.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-owner-setup-frame] [role='alert']")?.scrollIntoView({ block: "nearest" }));
      return false;
    }
  }

  const pause = () => {
    if (lock.current || uploadLock.current || priceBusy || step === "complete") return;
    if (step !== "pricing") { persistAndDefer(); return; }
    const request = new Event("owner-mobile-setup-pause-request", { cancelable: true });
    window.dispatchEvent(request);
  };

  async function save() {
    if (lock.current || uploadLock.current || editingHours || (step !== "hours" && step !== "staff")) return;
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
      if (step === "hours") { clearHoursDraft(key); advance("staff"); }
      else { verifiedStaffDraft.current = JSON.stringify(staff); setSavedStaffIds(staff.map((member) => member.id)); advance("pricing"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "설정을 저장하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function verifyComplete() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const fresh = await reloadSetup(bootstrap.shop.id);
      if (!fresh.initialSetupReadiness.completed) throw new Error("설정이 모두 저장되지 않았어요. 이전 단계의 저장 상태를 확인해 주세요.");
      clearHoursDraft(key);
      advance("complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장 상태를 확인하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }

  const onPrevious = step === "staff" ? () => { if (!lock.current && !uploadLock.current) advance("hours"); }
    : step === "pricing" ? () => { if (!lock.current) window.dispatchEvent(new Event("owner-mobile-back-request", { cancelable: true })); } : undefined;
  const actions = step === "hours" || step === "staff" ? <SetupStepNavigation onPrevious={onPrevious} onNext={() => void save()} busy={busy || uploading} nextDisabled={editingHours} nextLabel={busy ? "저장 중…" : "다음"} /> : step === "complete" ? <div className="border-t border-[#e5eaf1] p-4">
    <button type="button" className={`${setupButton} w-full`} onClick={() => { try { window.sessionStorage.removeItem(key); } catch { /* Optional navigation hint. */ } onFinish(); }}>매장 시작하기</button>
  </div> : undefined;

  if (showWelcome) return <WelcomeScreen
    imageUrl="/images/demo/grooming-salon-hero.png"
    title={<><span className="text-[#2f6fd6]">{PETMANAGER_PRODUCT_NAME}</span>에<br />오신 걸 환영해요</>}
    description="영업시간, 담당자, 요금표만 정하면 바로 매장 운영을 시작할 수 있어요. 정한 내용은 나중에 언제든 바꿀 수 있어요."
    buttonText="기본항목 설정하기"
    onButtonClick={() => setShowWelcome(false)}
    secondaryActionText="나중에 할게요"
    onSecondaryActionClick={onDefer}
  />;

  return <>
    {/* The real Today screen stays behind the dialog. Only the wizard can write
        while setup is open; the backdrop uses the same bootstrap for display. */}
    <div inert aria-hidden="true" data-owner-setup-background>
      <OwnerApp initialData={bootstrap} ownedShops={[{ id: bootstrap.shop.id, name: bootstrap.shop.name, address: bootstrap.shop.address, heroImageUrl: bootstrap.shop.customer_page_settings.hero_image_url }]} selectedShopId={bootstrap.shop.id} appRole="owner" isPreviewDemo startupReadOnly />
    </div>
    <OwnerInitialSetupFrame step={step} footer={actions} footerRef={setPriceFooterTarget} navigationDisabled={busy || uploading || priceBusy} onClose={step === "complete" ? onFinish : pause}>
    {step === "pricing" ? <>
      {error && <p role="alert" className="px-4 pt-4 text-[14px] text-red-600">{error}</p>}
      {busy ? <p role="status" className="p-5">저장 상태를 확인하고 있어요.</p> : <MobileAiPriceGuideFixture
        presentation="embedded" setupFlow shopId={bootstrap.shop.id} ownerBottomNavigation={false}
        onNavigationBusyChange={setPriceBusy}
        pricePhotoAdapter={operations.pricePhotoAdapter} setupFooterTarget={priceFooterTarget}
        initialRows={draft?.rows ?? null} initialDocument={draft?.document ?? null} initialServiceId={draft?.serviceId ?? null} initialResumeMode={draft?.resumeMode}
        initialNeedsSave={draft?.needsSave ?? false}
        onAutoSave={(_rows, state) => { setDraft(state); writeOwnerPriceGuideSessionDraft(priceGuideKey, state); }}
        onComplete={(_rows, state) => { if (state) setDraft(state); writeOwnerPriceGuideSessionDraft(priceGuideKey, null); void verifyComplete(); }}
        onPause={(state) => { setDraft(state); return persistAndDefer(state); }}
        onExit={(_rows, state) => { setDraft(state ?? null); writeOwnerPriceGuideSessionDraft(priceGuideKey, state ?? null); advance("staff"); }}
      />}
    </> : step === "complete" ? <div className="space-y-3">
      <h2 className="text-[20px] font-semibold leading-7 text-[#15213b]">매장 운영을 시작할 준비가 됐어요.</h2>
      <p className="text-[16px] leading-6 text-slate-600">영업시간, 담당자, 서비스·가격을 모두 등록했어요.</p>
    </div> : <section data-setup-section className="flex flex-col gap-3 text-[15px] leading-6">
      <fieldset disabled={busy || uploading}>
        {step === "hours" ? <>
          <SetupHoursFields hours={hours} onChange={setHours} monthlyClosure={cycle !== "weekly"} onBulkEditingChange={setEditingHours} />
        </> : <SetupStaffFields staff={staff} onChange={setStaff} savedIds={savedStaffIds} shopId={bootstrap.shop.id} onUploadingChange={(value) => { uploadLock.current = value; setUploading(value); }} />}
      </fieldset>
      {error && <p role="alert" className="text-[14px] text-red-600">{error}</p>}
    </section>}
    </OwnerInitialSetupFrame>
  </>;
}
