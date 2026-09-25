"use client";

import { useCallback, useState, type FormEvent } from "react";

import { OwnerInitialSetupSaveNextActions, type OwnerInitialSetupStepKey } from "@/components/owner-web/owner-initial-setup-guide";
import InitialSetupStaffManagementPanel, {
  type InitialSetupStaffSaveState,
} from "@/components/owner-web/initial-setup-staff-management-panel";
import PriceGuidePhotoOnboarding from "@/components/owner-web/price-guide-photo-onboarding";
import type { InitialSetupStaffPhotoDraft } from "@/components/owner-web/staff-profile-photo-field";
import {
  emptyStaffDraft,
  formatWeekdayKeys,
  type StaffDraft,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";
import { cn } from "@/lib/utils";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export type InitialSetupFixtureScreen = "operatingHours" | "staff" | "services";
const FIXTURE_STAFF_STORAGE_KEY = "petmanager.fixture.initial-setup.staff";

const INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-normal text-[#172033] outline-none transition focus:border-[#94a3b8] focus:ring-[3px] focus:ring-[#64748b]/10";
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-medium text-[#475569]">{children}</span>;
}

function FormHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="border-b border-[#e8edf3] px-4 py-4 sm:px-5">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#172033]">{title}</h2>
      <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">{description}</p>
    </header>
  );
}

function SaveFeedback({ message, error }: { message: string; error?: boolean }) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-[8px] border px-3 py-2.5 text-[13px] font-normal leading-5",
        error ? "border-[#f3c7c7] bg-[#fffafa] text-[#a04455]" : "border-[#cce7db] bg-[#f3fbf7] text-[#177856]",
      )}
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function HoursFixtureForm({ onSaved, onNext }: { onSaved: (step: OwnerInitialSetupStepKey) => void; onNext: () => void }) {
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [closedDay, setClosedDay] = useState("sun");
  const [temporaryClosedDate, setTemporaryClosedDate] = useState("2026-09-15");
  const [feedback, setFeedback] = useState("");

  function save() {
    if (!openTime || !closeTime || openTime >= closeTime) {
      setFeedback("영업 시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    setFeedback("영업시간·휴무일 저장 성공 · DB 저장 없음");
    onSaved("hours");
  }

  return (
    <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); save(); }} className="overflow-hidden rounded-[14px] border border-[#d9e2ee] bg-white" data-testid="initial-setup-hours-form">
      <OwnerInitialSetupSaveNextActions onSave={save} onNext={onNext} />
      <FormHeader title="영업시간·휴무일" description="실제 매장에서 예약받을 시간과 쉬는 날을 확인해 주세요." />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <FieldLabel>영업 시작</FieldLabel>
            <input type="time" value={openTime} onChange={(event) => setOpenTime(event.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="min-w-0">
            <FieldLabel>영업 종료</FieldLabel>
            <input type="time" value={closeTime} onChange={(event) => setCloseTime(event.target.value)} className={INPUT_CLASS} />
          </label>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <FieldLabel>정기 휴무일</FieldLabel>
            <select value={closedDay} onChange={(event) => setClosedDay(event.target.value)} className={INPUT_CLASS}>
              <option value="sun">매주 일요일</option>
              <option value="mon">매주 월요일</option>
              <option value="none">정기 휴무 없음</option>
            </select>
          </label>
          <label className="min-w-0">
            <FieldLabel>임시 휴무일</FieldLabel>
            <input type="date" value={temporaryClosedDate} onChange={(event) => setTemporaryClosedDate(event.target.value)} className={INPUT_CLASS} />
          </label>
        </div>
        <SaveFeedback message={feedback} error={Boolean(feedback && !feedback.includes("성공"))} />
      </div>
    </form>
  );
}

const PRICE_GUIDE_FIXTURE_DOCUMENT: PriceGuideV2 = {
  schemaVersion: 2,
  source: "manual",
  overallNote: "모량과 털 상태에 따라 최종 금액이 달라질 수 있습니다.",
  rows: [{
    serviceName: "전체 미용",
    species: "dog",
    breedNames: ["말티즈"],
    breedGroup: "소형 장모종",
    sizeClass: "small",
    minKg: 0,
    maxKg: 5,
    priceKind: "fixed",
    priceMinKrw: 55_000,
    priceMaxKrw: null,
    durationMinutes: 90,
    note: "발톱·귀 청소 포함",
  }],
  surcharges: [{ condition: "털 엉킴", amountKrw: 10_000, percent: null, note: "상태에 따라 추가" }],
  aiReview: [],
};

function PricingFixtureForm({ onSaved, onNext }: { onSaved: (step: OwnerInitialSetupStepKey) => void; onNext: () => void }) {
  const [savedDocument, setSavedDocument] = useState<PriceGuideV2>(PRICE_GUIDE_FIXTURE_DOCUMENT);
  const [saveAction, setSaveAction] = useState<(() => Promise<void | boolean>) | null>(null);
  const registerSaveAction = useCallback((action: (() => Promise<void | boolean>) | null) => setSaveAction(() => action), []);

  return (
    <div className="min-w-0" data-testid="initial-setup-price-guide-fixture">
      <OwnerInitialSetupSaveNextActions onSave={() => saveAction?.()} onNext={onNext} saveDisabled={!saveAction} />
      <PriceGuidePhotoOnboarding
        shopId="initial-setup-guide-preview-shop"
        fixtureMode
        initialDocument={savedDocument}
        onSaveActionReady={registerSaveAction}
        onApply={async (document) => {
          if (!("schemaVersion" in document)) return false;
          setSavedDocument(document);
          onSaved("pricing");
          return true;
        }}
      />
    </div>
  );
}

export default function InitialSetupFixtureForm({
  activeScreen,
  onStepSaved,
  onHoursNext,
  onStaffNext,
  onPricingNext,
}: {
  activeScreen: InitialSetupFixtureScreen;
  onStepSaved: (step: OwnerInitialSetupStepKey) => void;
  onHoursNext?: () => void;
  onStaffNext?: () => void;
  onPricingNext?: () => void;
}) {
  const defaultFixtureStaff: StaffMember = {
    id: "preview-owner",
    name: "대표자",
    displayName: "대표자",
    profileImageUrl: "",
    profileImageUrls: [],
    profileImageAssetIds: [],
    phone: "",
    role: "대표",
    position: "대표",
    defaultDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  };
  const [fixtureStaff, setFixtureStaff] = useState<StaffMember[]>(() => {
    if (typeof window === "undefined") return [defaultFixtureStaff];
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(FIXTURE_STAFF_STORAGE_KEY) ?? "null") as StaffMember | null;
      return stored?.id === "preview-owner" ? [stored] : [defaultFixtureStaff];
    } catch {
      return [defaultFixtureStaff];
    }
  });
  const fixtureOwner = fixtureStaff[0] ?? defaultFixtureStaff;
  const [staffDraft, setStaffDraft] = useState<StaffDraft>({
    ...emptyStaffDraft,
    name: fixtureOwner.name || "대표자",
    displayName: fixtureOwner.displayName || fixtureOwner.name || "대표자",
    profileImageUrl: fixtureOwner.profileImageUrl ?? "",
    phone: fixtureOwner.phone ?? "",
    role: "대표",
    position: "대표",
    defaultDaysText: formatWeekdayKeys((["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as WeekdayKey[]).filter((key) => !fixtureOwner.defaultDays.includes(key))),
    startTime: fixtureOwner.startTime,
    endTime: fixtureOwner.endTime,
    regularOff: fixtureOwner.regularOff,
  });
  const [staffPhoto, setStaffPhoto] = useState<InitialSetupStaffPhotoDraft>({ file: null, mode: "keep" });
  const [staffSaveState, setStaffSaveState] = useState<InitialSetupStaffSaveState>("idle");
  const [staffFeedback, setStaffFeedback] = useState("");
  const [staffWorkDays, setStaffWorkDays] = useState<WeekdayKey[]>(fixtureOwner.defaultDays);

  function updateStaffDraft(patch: Partial<StaffDraft>) {
    setStaffDraft((current) => ({ ...current, ...patch }));
    setStaffSaveState("dirty");
    setStaffFeedback("");
  }

  function toggleFixtureWorkday(dayKey: WeekdayKey) {
    setStaffWorkDays((current) => {
      const nextWorkDays = current.includes(dayKey) ? current.filter((key) => key !== dayKey) : [...current, dayKey];
      const offDays = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as WeekdayKey[]).filter((key) => !nextWorkDays.includes(key));
      setStaffDraft((currentDraft) => ({ ...currentDraft, defaultDaysText: formatWeekdayKeys(offDays), regularOff: formatWeekdayKeys(offDays) }));
      return nextWorkDays;
    });
    setStaffSaveState("dirty");
    setStaffFeedback("");
  }

  function saveFixtureStaff() {
    if (!staffDraft.name.trim() || staffWorkDays.length === 0 || staffDraft.startTime >= staffDraft.endTime) {
      setStaffSaveState("error");
      setStaffFeedback("직원 이름, 근무 요일, 올바른 시작·종료 시간을 확인해 주세요.");
      return;
    }
    const current = fixtureStaff[0];
    let profileImageUrl = current.profileImageUrl ?? "";
    let profileImageUrls = current.profileImageUrls ?? [];
    let profileImageAssetIds = current.profileImageAssetIds ?? [];
    if (staffPhoto.mode === "replace" && staffPhoto.file) {
      profileImageUrl = URL.createObjectURL(staffPhoto.file);
      profileImageUrls = [profileImageUrl];
      profileImageAssetIds = [`fixture-staff-profile-${staffPhoto.file.lastModified}`];
    } else if (staffPhoto.mode === "remove") {
      profileImageUrl = "";
      profileImageUrls = [];
      profileImageAssetIds = [];
    }
    const savedStaff: StaffMember = {
      ...current,
      name: "대표자",
      displayName: "대표자",
      role: "대표",
      position: "대표",
      phone: staffDraft.phone,
      profileImageUrl,
      profileImageUrls,
      profileImageAssetIds,
      defaultDays: staffWorkDays,
      startTime: staffDraft.startTime,
      endTime: staffDraft.endTime,
      regularOff: staffDraft.regularOff,
    };
    setFixtureStaff([savedStaff]);
    try {
      window.sessionStorage.setItem(FIXTURE_STAFF_STORAGE_KEY, JSON.stringify(savedStaff));
    } catch {
      // DB-free fixture remains saved in this mounted preview when browser storage is unavailable.
    }
    setStaffDraft((currentDraft) => ({ ...currentDraft, profileImageUrl, phone: savedStaff.phone }));
    setStaffPhoto({ file: null, mode: "keep" });
    setStaffSaveState("saved");
    setStaffFeedback("직원 관리 저장 성공 · DB·Storage 호출 없음");
    onStepSaved("staff");
  }

  if (activeScreen === "staff") {
    return (
      <InitialSetupStaffManagementPanel
        staff={fixtureStaff}
        ownerStaffId="preview-owner"
        ownerStaffName="대표자"
        selectedStaffId="preview-owner"
        draft={staffDraft}
        photo={staffPhoto}
        workDayKeys={staffWorkDays}
        ownerLocked
        saveState={staffSaveState}
        feedback={staffFeedback}
        onSelectStaff={(staffMember) => setStaffDraft((current) => ({ ...current, name: staffMember.name, phone: staffMember.phone }))}
        onDraftChange={updateStaffDraft}
        onToggleWorkday={toggleFixtureWorkday}
        onPhotoFileChange={(file) => {
          setStaffPhoto({ file, mode: "replace" });
          setStaffSaveState("dirty");
          setStaffFeedback("");
        }}
        onPhotoRemove={() => {
          setStaffPhoto({ file: null, mode: "remove" });
          setStaffSaveState("dirty");
          setStaffFeedback("");
        }}
        onPhotoReset={() => {
          setStaffPhoto({ file: null, mode: "keep" });
          setStaffSaveState("dirty");
          setStaffFeedback("");
        }}
        onPhotoError={(message) => {
          setStaffFeedback(message);
          setStaffSaveState(message ? "error" : "dirty");
        }}
        onSave={saveFixtureStaff}
        onNext={() => onStaffNext?.()}
      />
    );
  }
  if (activeScreen === "services") return <PricingFixtureForm onSaved={onStepSaved} onNext={() => onPricingNext?.()} />;
  return <HoursFixtureForm onSaved={onStepSaved} onNext={() => onHoursNext?.()} />;
}
