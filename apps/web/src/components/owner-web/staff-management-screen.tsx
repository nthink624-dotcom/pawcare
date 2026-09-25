"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ScheduleTable,
  StaffBoardTabs,
  StaffDetailActions,
  StaffDetailPanel,
  StaffList,
  StaffModal,
  StaffScheduleEditModal,
} from "@/components/owner-web/staff-management-ui";
import { StaffAddModal, StaffAnnualLeaveGrantModal, StaffLeaveModal } from "@/components/owner-web/staff-management-modals";
import { hasStaffProfileChoice, prepareStaffProfilePhoto } from "@/components/owner-web/staff-photo-draft";
import { StaffProfileImagePicker } from "@/components/owner-web/staff-photo-choice";
import { StaffMonthlySchedule } from "@/components/owner-web/staff-monthly-schedule";
import { CustomerPagePreviewLayout } from "@/components/owner-web/customer-page-phone-preview";
import InitialSetupStaffManagementPanel, {
  type InitialSetupStaffSaveState,
  type InitialSetupStaffSessionDraft,
} from "@/components/owner-web/initial-setup-staff-management-panel";
import {
  type InitialSetupStaffPhotoDraft,
  type StaffProfilePhotoUploader,
} from "@/components/owner-web/staff-profile-photo-field";
import { OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { AssetIcon, WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerStaffProfileImageFromFile } from "@/lib/media/owner-media-client";
import { findAvailableStaffChipColorIndex, getStaffChipColorIndex, normalizeStaffChipColorIndex } from "@/lib/staff-chip-colors";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { OwnerProfile, Service, Shop, StaffScheduleOverride as BootstrapStaffScheduleOverride } from "@/types/domain";
import {
  applyScheduleToCell,
  buildDraft,
  emptyStaffDraft,
  formatWeekLabel,
  formatFixedOffDays,
  formatMonthLabel,
  formatMonthShift,
  formatWeekdayKeys,
  getMonthStart,
  getWeekDates,
  getWeekStart,
  initialRequests,
  parseDefaultDaysFromFixedOffText,
  persistInitialSetupStaffDraft,
  scheduleOverrideFromBootstrap,
  weekdayColumns,
  type LeaveRequest,
  type LeaveType,
  type ScheduleEditDraft,
  type ScheduleOverride,
  type ScheduleOverrideStatus,
  type StaffBoardTab,
  type StaffDraft,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";

type Props = {
  shopId?: string;
  shop?: Shop;
  services?: Service[];
  ownerProfile?: OwnerProfile | null;
  staffMembers?: StaffMember[];
  staffScheduleOverrides?: BootstrapStaffScheduleOverride[];
  onStaffMembersChange?: (
    staff: StaffMember[],
    options?: StaffMembersChangeOptions,
  ) => void | StaffMembersChangeResult | Promise<void | StaffMembersChangeResult>;
  onStaffScheduleOverridesChange?: (overrides: BootstrapStaffScheduleOverride[]) => void;
  onSaveSuccess?: () => void;
  initialSetupMode?: boolean;
  initialSetupSessionDraft?: InitialSetupStaffSessionDraft | null;
  onInitialSetupSessionDraftChange?: (sessionDraft: InitialSetupStaffSessionDraft) => void;
  onInitialSetupNext?: () => void;
  uploadInitialSetupStaffPhoto?: StaffProfilePhotoUploader;
};

type OverrideResponse = {
  override: BootstrapStaffScheduleOverride;
};

type StaffMembersChangeOptions = {
  deferEssentialRefresh?: boolean;
};
type StaffMembersChangeResult = {
  backgroundRefresh: Promise<void>;
};

export default function StaffManagementScreen({
  shopId,
  shop,
  services = [],
  ownerProfile,
  staffMembers,
  staffScheduleOverrides = [],
  onStaffMembersChange,
  onStaffScheduleOverridesChange,
  onSaveSuccess,
  initialSetupMode = false,
  initialSetupSessionDraft = null,
  onInitialSetupSessionDraftChange,
  onInitialSetupNext,
  uploadInitialSetupStaffPhoto,
}: Props) {
  const isDemoShop = shopId === "demo-shop" || shopId === "owner-demo";
  const initialStaff = staffMembers?.[0] ?? null;
  const ownerStaffName = ownerProfile?.name.trim()
    || (isDemoShop ? "대표자" : initialStaff?.name.trim() && initialStaff.name !== "원장" ? initialStaff.name.trim() : "대표자");
  const ownerStaffId = initialStaff?.id ?? `${shopId ?? "local"}-staff-owner`;
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(staffMembers ?? []);
  const staff = staffMembers ?? localStaff;
  const [requests, setRequests] = useState<LeaveRequest[]>(() => (isDemoShop ? initialRequests : []));
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>(() => staffScheduleOverrides.map(scheduleOverrideFromBootstrap));
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [monthStart, setMonthStart] = useState(getMonthStart());
  const [selectedStaffId, setSelectedStaffId] = useState(initialSetupSessionDraft?.staffId ?? initialStaff?.id ?? "");
  const [boardTab, setBoardTab] = useState<StaffBoardTab>("monthly");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [staffDetailDialogOpen, setStaffDetailDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [annualGrantDialogOpen, setAnnualGrantDialogOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(() => initialSetupSessionDraft?.draft ?? (initialStaff
    ? {
        ...buildDraft(initialStaff),
        ...(initialSetupMode ? { name: ownerStaffName, displayName: ownerStaffName, role: "대표", position: "대표" } : {}),
      }
    : emptyStaffDraft));
  const [newStaffDraft, setNewStaffDraft] = useState<StaffDraft>(initialSetupSessionDraft?.draft ?? {
    ...emptyStaffDraft,
    name: ownerStaffName,
    displayName: ownerStaffName,
    role: "대표",
    position: "대표",
    defaultDaysText: formatWeekdayKeys(["sat", "sun"]),
    regularOff: formatWeekdayKeys(["sat", "sun"]),
  });
  const [leaveDraft, setLeaveDraft] = useState({ staffId: initialStaff?.id ?? "", date: currentDateInTimeZone(), type: "휴무" as LeaveType, period: "오전" as "오전" | "오후", reason: "" });
  const [annualGrantDraft, setAnnualGrantDraft] = useState({ days: "15" });
  const [scheduleEditDraft, setScheduleEditDraft] = useState<ScheduleEditDraft | null>(null);
  const [defaultScheduleOpen, setDefaultScheduleOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [staffSaveFeedback, setStaffSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffId, setNewStaffId] = useState(createStaffId);
  const [imageChoiceTarget, setImageChoiceTarget] = useState<"add" | "edit" | null>(null);
  const [isCompletingInitialSetup, setIsCompletingInitialSetup] = useState(false);
  const occupiedChipColorIndices = useMemo(
    () => new Set(
      staff
        .map((staffMember) => getStaffChipColorIndex(staffMember.id, staffMember.chipColorIndex)),
    ),
    [staff],
  );

  useEffect(() => {
    if (staffSaveFeedback?.type !== "success") return;
    const closeSavedNoticeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setStaffSaveFeedback(null);
    };
    window.addEventListener("keydown", closeSavedNoticeOnEscape);
    return () => window.removeEventListener("keydown", closeSavedNoticeOnEscape);
  }, [staffSaveFeedback?.type]);
  const [initialSetupPhoto, setInitialSetupPhoto] = useState<InitialSetupStaffPhotoDraft>(() => initialSetupSessionDraft?.photo ?? { file: null, mode: "keep", pendingUpload: null });
  const [initialSetupSaveState, setInitialSetupSaveState] = useState<InitialSetupStaffSaveState>(() => initialSetupSessionDraft?.saveState ?? "idle");

  useEffect(() => {
    setScheduleOverrides(staffScheduleOverrides.map(scheduleOverrideFromBootstrap));
  }, [staffScheduleOverrides]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const selectedStaff = staff.find((item) => item.id === selectedStaffId) ?? staff[0];
  const selectedStaffIsOwner = Boolean(selectedStaff && (selectedStaff.id === ownerStaffId || selectedStaff.id.endsWith("-staff-owner")));
  const pendingCount = requests.filter((request) => request.status === "승인대기").length;

  useEffect(() => {
    if (!selectedStaff) return;
    if (selectedStaff.id !== selectedStaffId) {
      setSelectedStaffId(selectedStaff.id);
      setDraft(buildDraft(selectedStaff));
    }
  }, [selectedStaff, selectedStaffId]);

  useEffect(() => {
    if (!initialSetupMode) return;
    if (staff.length === 0) {
      setNewStaffDraft((current) => ({ ...current, name: ownerStaffName, displayName: ownerStaffName, role: "대표", position: "대표" }));
      return;
    }
    if (selectedStaffIsOwner) {
      setDraft((current) => ({ ...current, name: ownerStaffName, displayName: ownerStaffName, role: "대표", position: "대표" }));
    }
  }, [initialSetupMode, ownerStaffName, selectedStaffIsOwner, staff.length]);

  async function updateStaffMembers(
    updater: (current: StaffMember[]) => StaffMember[],
    options?: StaffMembersChangeOptions,
  ) {
    const nextStaff = updater(staff);
    if (onStaffMembersChange) {
      try {
        const result = await onStaffMembersChange(nextStaff, options);
        if (result?.backgroundRefresh) {
          void result.backgroundRefresh.catch(() => {
            setNotice((current) => current || "직원 정보는 저장됐지만 최신 정보를 다시 확인하지 못했습니다.");
          });
        }
        onSaveSuccess?.();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.";
        setNotice(message);
        if (staffDetailDialogOpen) setStaffSaveFeedback({ type: "error", message });
        return false;
      }
    }

    setLocalStaff(nextStaff);
    onSaveSuccess?.();
    return true;
  }

  function createStaffId() {
    const prefix = shopId ?? "local";
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-staff-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isValidTimeRange(startTime: string, endTime: string) {
    return startTime < endTime;
  }

  async function prepareProfilePhoto(current: StaffDraft, staffId: string, target: "add" | "edit", existing?: StaffMember) {
    return prepareStaffProfilePhoto({
      draft: current,
      existing,
      upload: async (file) => {
        if (!shopId || isDemoShop) throw new Error("사진 업로드는 매장 연결 후 사용할 수 있습니다. 기본 이미지를 선택해 주세요.");
        const result = await createOwnerStaffProfileImageFromFile({ shopId, staffId }, file);
        return { mediaAssetId: result.mediaAsset.id, signedUrl: result.signedUrl };
      },
      onUploaded: (photo) => {
        const setCurrentDraft = target === "add" ? setNewStaffDraft : setDraft;
        setCurrentDraft((previous) => ({ ...previous, profileImagePendingUpload: photo }));
      },
    });
  }

  async function saveStaff() {
    if (!selectedStaff || isSavingStaff) return;
    if (!hasStaffProfileChoice(draft, selectedStaff)) {
      setImageChoiceTarget("edit");
      return;
    }
    if (!isValidTimeRange(draft.startTime, draft.endTime)) {
      setStaffSaveFeedback({ type: "error", message: "고정 출근 시간은 고정 퇴근 시간보다 빨라야 합니다." });
      return;
    }
    setIsSavingStaff(true);
    try {
      const profilePhoto = await prepareProfilePhoto(draft, selectedStaff.id, "edit", selectedStaff);
      const nextDays = parseDefaultDays(draft.defaultDaysText);
      const saved = await updateStaffMembers(
        (current) => current.map((item) =>
          item.id === selectedStaff.id
            ? {
                ...item,
                name: selectedStaffIsOwner ? ownerStaffName : draft.name.trim() || item.name,
                displayName: selectedStaffIsOwner ? ownerStaffName : draft.displayName.trim(),
                ...profilePhoto,
                profileMessage: draft.profileMessage.trim(),
                chipColorIndex: draft.chipColorIndex,
                phone: draft.phone.trim(),
                role: selectedStaffIsOwner ? "대표" : draft.role.trim() || item.role || "직원",
                titlePrefix: draft.titlePrefix.trim(),
                position: selectedStaffIsOwner ? "대표" : draft.position.trim() || item.position || "직원",
                defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
                startTime: draft.startTime,
                endTime: draft.endTime,
                regularOff: draft.regularOff.trim() || item.regularOff,
                annualRemain: Number(draft.annualRemain) || 0,
              }
            : item,
        ),
        { deferEssentialRefresh: true },
      );
      if (saved) {
        setStaffDetailDialogOpen(false);
        setNotice("직원 정보를 저장했습니다.");
        setStaffSaveFeedback({ type: "success", message: "저장되었습니다." });
      }
    } catch (error) {
      setStaffSaveFeedback({ type: "error", message: error instanceof Error ? error.message : "프로필 사진을 저장하지 못했습니다." });
    } finally {
      setIsSavingStaff(false);
    }
  }

  async function addStaff() {
    if (isAddingStaff) return;
    if (!newStaffDraft.name.trim()) {
      setNotice("직원 이름을 입력해 주세요.");
      return;
    }

    if (!isValidTimeRange(newStaffDraft.startTime, newStaffDraft.endTime)) {
      setNotice("고정 출근 시간은 고정 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    if (!hasStaffProfileChoice(newStaffDraft)) {
      setNotice("");
      setImageChoiceTarget("add");
      return;
    }
    const nextDays = parseDefaultDays(newStaffDraft.defaultDaysText);
    const nextStaffId = newStaffId;
    const requestedChipColorIndex = normalizeStaffChipColorIndex(newStaffDraft.chipColorIndex);
    const chipColorIndex = requestedChipColorIndex !== null
      ? occupiedChipColorIndices.has(requestedChipColorIndex) ? null : requestedChipColorIndex
      : findAvailableStaffChipColorIndex(nextStaffId, occupiedChipColorIndices);
    if (chipColorIndex === null) {
      setNotice("사용할 수 있는 개인 칩 색이 없습니다. 다른 직원의 색을 변경한 뒤 다시 시도해 주세요.");
      return;
    }
    setIsAddingStaff(true);
    setNotice("");
    try {
      const profilePhoto = await prepareProfilePhoto(newStaffDraft, nextStaffId, "add");
      const nextStaff: StaffMember = {
        id: nextStaffId,
        name: newStaffDraft.name.trim() || "신규 직원",
        displayName: newStaffDraft.displayName.trim(),
        ...profilePhoto,
        profileMessage: newStaffDraft.profileMessage.trim(),
        chipColorIndex,
        phone: newStaffDraft.phone.trim(),
        role: newStaffDraft.role.trim() || newStaffDraft.position.trim() || "직원",
        titlePrefix: newStaffDraft.titlePrefix.trim(),
        position: newStaffDraft.position.trim() || "직원",
        defaultDays: nextDays.length > 0 ? nextDays : ["mon", "tue", "wed", "thu", "fri"],
        startTime: newStaffDraft.startTime,
        endTime: newStaffDraft.endTime,
        regularOff: newStaffDraft.regularOff || "토, 일",
        annualRemain: Number(newStaffDraft.annualRemain) || 0,
        todayBookings: 0,
        weekBookings: 0,
      };
      const saved = await updateStaffMembers(
        (current) => [...current.filter((member) => member.id !== nextStaff.id), nextStaff],
        { deferEssentialRefresh: true },
      );
      if (!saved) {
        return;
      }
      selectStaff(nextStaff, false);
      setNewStaffDraft({ ...emptyStaffDraft, defaultDaysText: formatWeekdayKeys(["sat", "sun"]), regularOff: formatWeekdayKeys(["sat", "sun"]) });
      setStaffDialogOpen(false);
      setNewStaffId(createStaffId());
      setNotice("직원을 추가했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.");
    } finally {
      setIsAddingStaff(false);
    }
  }

  function selectStaff(staffMember: StaffMember, openDialog = true) {
    setSelectedStaffId(staffMember.id);
    const nextDraft = buildDraft(staffMember);
    setDraft(nextDraft);
    if (initialSetupMode) {
      const nextPhoto = { file: null, mode: "keep", pendingUpload: null } as const;
      setInitialSetupPhoto(nextPhoto);
      setInitialSetupSaveState("idle");
      onInitialSetupSessionDraftChange?.({ staffId: staffMember.id, draft: nextDraft, photo: nextPhoto, saveState: "idle" });
    }
    if (openDialog) {
      setStaffDetailDialogOpen(true);
    }
  }

  function parseDefaultDays(text: string) {
    return parseDefaultDaysFromFixedOffText(text);
  }

  function emitScheduleOverrides(overrides: ScheduleOverride[]) {
    if (!onStaffScheduleOverridesChange) return;
    onStaffScheduleOverridesChange(overrides.map((override) => toBootstrapOverride(override, shopId)));
  }

  function replaceLocalOverride(current: ScheduleOverride[], override: ScheduleOverride) {
    const next = current.filter((item) => !(item.staffId === override.staffId && item.date === override.date));
    return [...next, override];
  }

  async function addLeaveRequest() {
    if (!leaveDraft.staffId || !leaveDraft.date) return;
    const nextRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      staffId: leaveDraft.staffId,
      date: leaveDraft.date,
      type: leaveDraft.type,
      reason: "",
      status: "승인대기",
      period: leaveDraft.type === "반차" ? leaveDraft.period : undefined,
    };
    const nextOverride: ScheduleOverride = {
      id: `${shopId ?? "local"}-${nextRequest.staffId}-${nextRequest.date}`,
      staffId: nextRequest.staffId,
      date: nextRequest.date,
      status: nextRequest.type === "연차" ? "annual" : nextRequest.type === "반차" ? "half" : "off",
      startTime: "10:00",
      endTime: "19:00",
      period: nextRequest.type === "반차" ? nextRequest.period ?? "오전" : undefined,
      reason: "",
    };
    const previousOverrides = scheduleOverrides;
    const optimisticOverrides = replaceLocalOverride(previousOverrides, nextOverride);
    setScheduleOverrides(optimisticOverrides);
    emitScheduleOverrides(optimisticOverrides);

    try {
      if (shopId && !isDemoShop) {
        const response = await fetchApiJsonWithAuth<OverrideResponse>("/api/staff-schedule-overrides", {
          method: "PATCH",
          body: JSON.stringify({
            shopId,
            staffId: nextOverride.staffId,
            date: nextOverride.date,
            status: nextOverride.status,
            startTime: null,
            endTime: null,
            period: nextOverride.status === "half" ? nextOverride.period : null,
            reason: "",
          }),
        });
        const persistedOverride = scheduleOverrideFromBootstrap(response.override);
        const persistedOverrides = replaceLocalOverride(previousOverrides, persistedOverride);
        setScheduleOverrides(persistedOverrides);
        onStaffScheduleOverridesChange?.(replaceBootstrapOverride(staffScheduleOverrides, response.override));
      } else {
        setRequests((current) => [nextRequest, ...current]);
      }
      setLeaveDialogOpen(false);
      setNotice("휴무/연차 일정을 저장했습니다.");
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "휴무/연차 일정을 저장하지 못했습니다.");
    }
  }

  async function grantAnnualLeaveToAllStaff() {
    const days = Number(annualGrantDraft.days);
    if (!Number.isFinite(days) || days < 0) {
      setNotice("부여할 연차 일수를 확인해 주세요.");
      return;
    }

    const saved = await updateStaffMembers((current) =>
      current.map((item) => ({
        ...item,
        annualRemain: Math.floor(days),
      })),
    );
    if (saved) {
      setAnnualGrantDialogOpen(false);
      if (selectedStaff) setDraft(buildDraft({ ...selectedStaff, annualRemain: Math.floor(days) }));
      setNotice(`직원 ${staff.length}명에게 연차 ${Math.floor(days)}일을 일괄 부여했습니다.`);
    }
  }

  function openScheduleEditor(staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) {
    const override = scheduleOverrides.find((item) => item.staffId === staffMember.id && item.date === day.date);
    const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, scheduleOverrides);
    const status: ScheduleOverrideStatus =
      override?.status ?? (["work", "off", "annual", "half"].includes(cell.status) ? (cell.status as ScheduleOverrideStatus) : "off");

    setScheduleEditDraft({
      staffId: staffMember.id,
      staffName: staffMember.name,
      date: day.date,
      dayLabel: day.label,
      status,
      startTime: override?.startTime ?? staffMember.startTime,
      endTime: override?.endTime ?? staffMember.endTime,
      period: override?.period ?? "오전",
      reason: override?.reason ?? "",
      defaultDaysText: formatFixedOffDays(staffMember.defaultDays),
      defaultStartTime: staffMember.startTime,
      defaultEndTime: staffMember.endTime,
    });
    setDefaultScheduleOpen(false);
  }

  async function saveStaffDefaultScheduleFromDraft() {
    if (!scheduleEditDraft) return;
    if (!isValidTimeRange(scheduleEditDraft.defaultStartTime, scheduleEditDraft.defaultEndTime)) {
      setNotice("고정 출근 시간은 고정 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    const nextDays = parseDefaultDays(scheduleEditDraft.defaultDaysText);
    const saved = await updateStaffMembers((current) =>
      current.map((item) =>
        item.id === scheduleEditDraft.staffId
          ? {
              ...item,
              defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
              startTime: scheduleEditDraft.defaultStartTime,
              endTime: scheduleEditDraft.defaultEndTime,
              regularOff: formatFixedOffDays(nextDays),
            }
          : item,
      ),
    );
    if (saved) {
      setNotice("고정 휴무 설정을 저장했습니다.");
    }
  }

  async function persistScheduleOverride() {
    if (!scheduleEditDraft) return;
    if (scheduleEditDraft.status === "work" && !isValidTimeRange(scheduleEditDraft.startTime, scheduleEditDraft.endTime)) {
      setNotice("근무 시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    const previousOverrides = scheduleOverrides;
    const nextOverride: ScheduleOverride = {
      id: `${shopId ?? "local"}-${scheduleEditDraft.staffId}-${scheduleEditDraft.date}`,
      staffId: scheduleEditDraft.staffId,
      date: scheduleEditDraft.date,
      status: scheduleEditDraft.status,
      startTime: scheduleEditDraft.status === "work" ? scheduleEditDraft.startTime : "10:00",
      endTime: scheduleEditDraft.status === "work" ? scheduleEditDraft.endTime : "19:00",
      period: scheduleEditDraft.status === "half" ? scheduleEditDraft.period : undefined,
      reason: scheduleEditDraft.reason.trim(),
    };
    const optimisticOverrides = replaceLocalOverride(previousOverrides, nextOverride);
    setScheduleOverrides(optimisticOverrides);
    emitScheduleOverrides(optimisticOverrides);

    try {
      if (shopId && !isDemoShop) {
        const response = await fetchApiJsonWithAuth<OverrideResponse>("/api/staff-schedule-overrides", {
          method: "PATCH",
          body: JSON.stringify({
            shopId,
            staffId: nextOverride.staffId,
            date: nextOverride.date,
            status: nextOverride.status,
            startTime: nextOverride.status === "work" ? nextOverride.startTime : null,
            endTime: nextOverride.status === "work" ? nextOverride.endTime : null,
            period: nextOverride.status === "half" ? nextOverride.period : null,
            reason: nextOverride.reason,
          }),
        });
        const persistedOverride = scheduleOverrideFromBootstrap(response.override);
        const persistedOverrides = replaceLocalOverride(previousOverrides, persistedOverride);
        setScheduleOverrides(persistedOverrides);
        onStaffScheduleOverridesChange?.(replaceBootstrapOverride(staffScheduleOverrides, response.override));
      }
      setNotice("선택한 날짜의 근무 일정을 저장했습니다.");
      setScheduleEditDraft(null);
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "선택한 날짜의 근무 일정을 저장하지 못했습니다.");
    }
  }

  async function persistResetScheduleOverride() {
    if (!scheduleEditDraft) return;
    const previousOverrides = scheduleOverrides;
    const nextOverrides = previousOverrides.filter((item) => !(item.staffId === scheduleEditDraft.staffId && item.date === scheduleEditDraft.date));
    setScheduleOverrides(nextOverrides);
    emitScheduleOverrides(nextOverrides);

    try {
      if (shopId && !isDemoShop) {
        await fetchApiJsonWithAuth<{ ok: boolean }>("/api/staff-schedule-overrides", {
          method: "DELETE",
          body: JSON.stringify({ shopId, staffId: scheduleEditDraft.staffId, date: scheduleEditDraft.date }),
        });
        onStaffScheduleOverridesChange?.(
          staffScheduleOverrides.filter((item) => !(item.staff_id === scheduleEditDraft.staffId && item.work_date === scheduleEditDraft.date)),
        );
      }
      setNotice("선택한 날짜를 고정 근무 설정으로 되돌렸습니다.");
      setScheduleEditDraft(null);
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "선택한 날짜의 근무 일정을 초기화하지 못했습니다.");
    }
  }

  function syncInitialSetupSession(nextDraft: StaffDraft, nextPhoto: InitialSetupStaffPhotoDraft, saveState: InitialSetupStaffSaveState) {
    onInitialSetupSessionDraftChange?.({
      staffId: selectedStaff?.id ?? initialSetupSessionDraft?.staffId ?? null,
      draft: nextDraft,
      photo: nextPhoto,
      saveState,
    });
  }

  async function saveInitialSetupStaff() {
    if (isCompletingInitialSetup) return;
    const currentDraft = staff.length === 0 ? newStaffDraft : draft;
    if (!currentDraft.name.trim()) {
      setInitialSetupSaveState("error");
      setNotice("직원 이름을 입력해 주세요.");
      return;
    }
    if (!isValidTimeRange(currentDraft.startTime, currentDraft.endTime)) {
      setInitialSetupSaveState("error");
      setNotice("출근 시간은 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    const nextDays = parseDefaultDays(currentDraft.defaultDaysText);
    if (nextDays.length === 0) {
      setInitialSetupSaveState("error");
      setNotice("근무 요일을 하나 이상 선택해 주세요.");
      return;
    }

    setIsCompletingInitialSetup(true);
    setInitialSetupSaveState("saving");
    setNotice("");
    let photoForRetry: InitialSetupStaffPhotoDraft = initialSetupPhoto;
    try {
      const uploadPhoto: StaffProfilePhotoUploader = uploadInitialSetupStaffPhoto ?? (async (context, file) => {
        const uploaded = await createOwnerStaffProfileImageFromFile(context, file);
        return { mediaAssetId: uploaded.mediaAsset.id, signedUrl: uploaded.signedUrl };
      });
      const { targetId, savedDraft } = await persistInitialSetupStaffDraft({
        shopId,
        staff,
        selectedStaff,
        selectedStaffIsOwner,
        ownerStaffName,
        sessionStaffId: initialSetupSessionDraft?.staffId,
        draft: currentDraft,
        photo: initialSetupPhoto,
        nextDays,
        uploadPhoto,
        onPhotoUploadPending: (pendingUpload) => {
          photoForRetry = { file: null, mode: "replace", pendingUpload };
          setInitialSetupPhoto(photoForRetry);
          syncInitialSetupSession(currentDraft, photoForRetry, "saving");
        },
        createStaffId,
        persistStaff: (nextStaff) => updateStaffMembers(() => nextStaff),
      });
      setSelectedStaffId(targetId);
      setDraft(savedDraft);
      setNewStaffDraft(savedDraft);
      const savedPhoto = { file: null, mode: "keep", pendingUpload: null } as const;
      setInitialSetupPhoto(savedPhoto);
      setInitialSetupSaveState("saved");
      setNotice("직원 정보를 저장했습니다.");
      onInitialSetupSessionDraftChange?.({ staffId: targetId, draft: savedDraft, photo: savedPhoto, saveState: "saved" });
      return true;
    } catch (error) {
      setInitialSetupSaveState("error");
      const errorMessage = error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.";
      const recoveryMessage = photoForRetry.pendingUpload
        ? "업로드한 사진은 유지했습니다. 다시 저장하거나 사진 변경을 초기화한 뒤 사진 없이 저장해 주세요."
        : "입력 내용은 유지했습니다. 다시 저장하거나 사진 없이 저장해 주세요.";
      setNotice(`${errorMessage} ${recoveryMessage}`);
      syncInitialSetupSession(currentDraft, photoForRetry, "error");
    } finally {
      setIsCompletingInitialSetup(false);
    }
  }

  const initialSetupDraft = staff.length === 0 ? newStaffDraft : draft;
  const initialSetupWorkDays = new Set(parseDefaultDays(initialSetupDraft.defaultDaysText));

  function updateInitialSetupDraft(patch: Partial<StaffDraft>) {
    if (staff.length === 0) {
      const nextDraft = { ...newStaffDraft, ...patch };
      setNewStaffDraft(nextDraft);
      setInitialSetupSaveState("dirty");
      syncInitialSetupSession(nextDraft, initialSetupPhoto, "dirty");
      return;
    }
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    setInitialSetupSaveState("dirty");
    syncInitialSetupSession(nextDraft, initialSetupPhoto, "dirty");
  }

  function toggleInitialSetupWorkday(dayKey: WeekdayKey) {
    const nextWorkDays = new Set(initialSetupWorkDays);
    if (nextWorkDays.has(dayKey)) nextWorkDays.delete(dayKey);
    else nextWorkDays.add(dayKey);
    const offDays = weekdayColumns.filter((day) => !nextWorkDays.has(day.key)).map((day) => day.key);
    const offDaysText = formatWeekdayKeys(offDays);
    updateInitialSetupDraft({ defaultDaysText: offDaysText, regularOff: offDaysText });
  }

  if (initialSetupMode) {
    return (
      <InitialSetupStaffManagementPanel
        staff={staff}
        ownerStaffId={ownerStaffId}
        ownerStaffName={ownerStaffName}
        selectedStaffId={selectedStaff?.id ?? null}
        draft={initialSetupDraft}
        photo={initialSetupPhoto}
        workDayKeys={[...initialSetupWorkDays]}
        ownerLocked={!selectedStaff || selectedStaffIsOwner}
        saveState={initialSetupSaveState}
        feedback={notice}
        onSelectStaff={(staffMember) => selectStaff(staffMember, false)}
        onDraftChange={updateInitialSetupDraft}
        onToggleWorkday={toggleInitialSetupWorkday}
        onPhotoFileChange={(file) => {
          const nextPhoto = { file, mode: "replace", pendingUpload: null } as const;
          setInitialSetupPhoto(nextPhoto);
          setInitialSetupSaveState("dirty");
          setNotice("");
          syncInitialSetupSession(initialSetupDraft, nextPhoto, "dirty");
        }}
        onPhotoRemove={() => {
          const nextPhoto = { file: null, mode: "remove", pendingUpload: null } as const;
          setInitialSetupPhoto(nextPhoto);
          setInitialSetupSaveState("dirty");
          setNotice("");
          syncInitialSetupSession(initialSetupDraft, nextPhoto, "dirty");
        }}
        onPhotoReset={() => {
          const nextPhoto = { file: null, mode: "keep", pendingUpload: null } as const;
          setInitialSetupPhoto(nextPhoto);
          setInitialSetupSaveState("dirty");
          setNotice("");
          syncInitialSetupSession(initialSetupDraft, nextPhoto, "dirty");
        }}
        onPhotoError={(message) => {
          setNotice(message);
          setInitialSetupSaveState(message ? "error" : "dirty");
        }}
        onSave={saveInitialSetupStaff}
        onNext={() => onInitialSetupNext?.()}
      />
    );
  }

  return (
    <CustomerPagePreviewLayout
      shop={shop ?? null}
      services={services}
      ownerProfile={ownerProfile}
      staffMembers={staff}
      previewMode="staffSelection"
      hidePreview={initialSetupMode || boardTab !== "list"}
    >
      <div className="flex h-full min-h-0 flex-col space-y-3">
        <StaffBoardTabs
          activeTab={boardTab}
          onChange={setBoardTab}
          trailing={
            boardTab === "monthly" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonthStart((current) => formatMonthShift(current, -1))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMonthStart(getMonthStart())}
                  className="h-11 min-w-[72px] rounded-[8px] px-3 !text-[16px] !font-medium !leading-6 text-[#111827] hover:bg-[#f8fafc]"
                >
                  {formatMonthLabel(monthStart).replace(/^\d{4}년\s*/, "")}
                </button>
                <button
                  type="button"
                  onClick={() => setMonthStart((current) => formatMonthShift(current, 1))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null
          }
        />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-1">
        <div className="min-h-0 min-w-0">
          <WebSurface className={cn("overflow-hidden", boardTab === "monthly" && "flex h-full min-h-0 flex-col")}>
            {boardTab !== "monthly" ? (
            <div className="flex items-center justify-between border-b border-[#edf2f7] px-5 py-2.5">
              {boardTab === "schedule" ? (
                <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeekStart((current) => formatDateShift(current, -7))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="이전 주"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setWeekStart(getWeekStart())} className="h-11 px-3 !text-[16px] !font-medium !leading-6 text-[#111827]">
                      {formatWeekLabel(weekStart)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStart((current) => formatDateShift(current, 7))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="다음 주"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">직원 목록</h2>
                    <span className="inline-flex min-h-[18px] items-center rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[12px] font-medium leading-[18px] text-[#334155]">
                      {staff.length}명
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNotice(""); setStaffDialogOpen(true); }}
                    className={cn(OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS, "!text-[16px] !font-medium !leading-6")}
                  >
                    <AssetIcon src="/icons/phosphor/UserPlus.svg" className="h-4 w-4" />
                    직원 추가
                  </button>
                </>
              )}
            </div>
            ) : null}

            {notice ? <div className="border-b border-[#edf2f7] bg-[#f8fafc] px-5 py-2 text-[16px] font-normal leading-6 text-[#475569]">{notice}</div> : null}

            {boardTab === "schedule" ? (
              <ScheduleTable staff={staff} weekDates={weekDates} requests={requests} overrides={scheduleOverrides} onOpenScheduleEditor={openScheduleEditor} />
            ) : boardTab === "monthly" ? (
              <StaffMonthlySchedule
                staff={staff}
                monthStart={monthStart}
                requests={requests}
                overrides={scheduleOverrides}
                onOpenScheduleEditor={openScheduleEditor}
              />
            ) : (
              <StaffList
                staff={staff}
                selectedStaffId={selectedStaff?.id ?? ""}
                requests={requests}
                overrides={scheduleOverrides}
                weekStart={weekStart}
                onSelect={selectStaff}
              />
            )}
          </WebSurface>
        </div>

      </div>

      {staffDialogOpen ? <StaffAddModal draft={newStaffDraft} unavailableChipColorIndices={occupiedChipColorIndices} onDraftChange={setNewStaffDraft} onClose={() => { if (!isAddingStaff) setStaffDialogOpen(false); }} onAdd={addStaff} isSaving={isAddingStaff} notice={notice} /> : null}

      {imageChoiceTarget ? <StaffProfileImagePicker
        value={(imageChoiceTarget === "add" ? newStaffDraft : draft).profileImageFallbackKey}
        onChange={(photo) => {
          const updateDraft = imageChoiceTarget === "add" ? setNewStaffDraft : setDraft;
          updateDraft((current) => ({ ...current, ...photo }));
          setNotice("");
        }}
        onClose={() => setImageChoiceTarget(null)}
      /> : null}

      {leaveDialogOpen ? (
        <StaffLeaveModal staff={staff} draft={leaveDraft} onDraftChange={setLeaveDraft} onClose={() => setLeaveDialogOpen(false)} onSave={addLeaveRequest} />
      ) : null}

      {annualGrantDialogOpen ? (
        <StaffAnnualLeaveGrantModal
          staffCount={staff.length}
          draft={annualGrantDraft}
          onDraftChange={setAnnualGrantDraft}
          onClose={() => setAnnualGrantDialogOpen(false)}
          onSave={grantAnnualLeaveToAllStaff}
        />
      ) : null}

      {staffDetailDialogOpen && selectedStaff ? (
        <StaffModal
          title="직원 상세"
          onClose={() => { if (!isSavingStaff) setStaffDetailDialogOpen(false); }}
          footer={
            <StaffDetailActions
              onReset={() => { if (!isSavingStaff) setDraft(buildDraft(selectedStaff)); }}
              onSave={() => void saveStaff()}
              isSaving={isSavingStaff}
              onOpenLeaveDialog={() => {
                setStaffDetailDialogOpen(false);
                setLeaveDialogOpen(true);
              }}
              onOpenAnnualGrantDialog={() => {
                setStaffDetailDialogOpen(false);
                setAnnualGrantDialogOpen(true);
              }}
            />
          }
        >
          <StaffDetailPanel
            staff={staff}
            selectedStaff={selectedStaff}
            draft={draft}
            requests={requests}
            overrides={scheduleOverrides}
            onDraftChange={setDraft}
            onSave={saveStaff}
            showActions={false}
            isSaving={isSavingStaff}
            onOpenLeaveDialog={() => {
              setStaffDetailDialogOpen(false);
              setLeaveDialogOpen(true);
            }}
            onOpenAnnualGrantDialog={() => {
              setStaffDetailDialogOpen(false);
              setAnnualGrantDialogOpen(true);
            }}
          />
        </StaffModal>
      ) : null}

      {staffSaveFeedback ? (
        <StaffModal title={staffSaveFeedback.type === "success" ? "저장 완료" : "저장 실패"} onClose={() => setStaffSaveFeedback(null)}>
          <div className="space-y-5">
            <p className={cn("text-[16px] font-normal leading-6", staffSaveFeedback.type === "success" ? "text-[#111827]" : "text-[#a04455]")}>{staffSaveFeedback.message}</p>
            <button
              type="button"
              onClick={() => setStaffSaveFeedback(null)}
              autoFocus={staffSaveFeedback.type === "success"}
              className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-[8px] bg-[#111827] px-4 !text-[16px] !font-medium !leading-6 text-white hover:bg-[#1f2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              확인
            </button>
          </div>
        </StaffModal>
      ) : null}

      {scheduleEditDraft ? (
        <StaffScheduleEditModal
          draft={scheduleEditDraft}
          defaultScheduleOpen={defaultScheduleOpen}
          onClose={() => setScheduleEditDraft(null)}
          onToggleDefaultSchedule={() => setDefaultScheduleOpen((current) => !current)}
          onDraftChange={setScheduleEditDraft}
          onSaveDefaultSchedule={saveStaffDefaultScheduleFromDraft}
          onReset={persistResetScheduleOverride}
          onSave={persistScheduleOverride}
        />
      ) : null}
      </div>
    </CustomerPagePreviewLayout>
  );
}

function formatDateShift(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toBootstrapOverride(override: ScheduleOverride, shopId?: string): BootstrapStaffScheduleOverride {
  return {
    id: override.id,
    shop_id: shopId ?? "local",
    staff_id: override.staffId,
    work_date: override.date,
    status: override.status,
    start_time: override.status === "work" ? override.startTime : null,
    end_time: override.status === "work" ? override.endTime : null,
    period: override.status === "half" ? override.period ?? "오전" : null,
    reason: override.reason || null,
    created_at: "",
    updated_at: "",
  };
}

function replaceBootstrapOverride(current: BootstrapStaffScheduleOverride[], nextOverride: BootstrapStaffScheduleOverride) {
  return [...current.filter((item) => !(item.staff_id === nextOverride.staff_id && item.work_date === nextOverride.work_date)), nextOverride];
}
