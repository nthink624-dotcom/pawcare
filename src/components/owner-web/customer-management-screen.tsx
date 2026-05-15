"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarPlus, Check, ChevronRight, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";

import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const staffCommentStorageKey = "petmanager.ownerWeb.staffComments";

type CustomerSort = "recentDesc" | "nameAsc";

type CustomerViewRow = {
  id: string;
  name: string;
  phone: string;
  pets: string[];
  tags: string[];
  recentVisit: string;
  recentVisitDate: string | null;
  nextBooking: string;
  nextBookingDate: string | null;
  memo: string;
  alerts: string;
  alertEnabled: boolean;
  appointmentCount: number;
  groomingCount: number;
  noshowCount: number;
  deleted: boolean;
  searchText: string;
};

const customerListGridClass =
  "grid-cols-[28px_minmax(138px,0.85fr)_minmax(136px,0.8fr)_minmax(150px,0.85fr)_minmax(132px,0.75fr)_minmax(170px,1fr)_40px]";

const initialStaffComments: Record<string, string> = {
  "우유|정유진": "첫 방문 때 긴장했음. 목 주변은 잡아주면 안정됨.",
  "몽이|김민지": "물 온도 낮으면 싫어함. 시작 전에 충분히 적셔주기.",
};

const showLocalMockCustomers = process.env.NODE_ENV !== "production";

function formatMonthDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function normalizeSearch(value: string) {
  return value.replaceAll("-", "").replace(/\s+/g, "").toLowerCase();
}

function buildSearchText(parts: string[]) {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

function compareDateDesc(first: string | null, second: string | null) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return second.localeCompare(first);
}

function isActiveAppointmentStatus(status: string) {
  return !["cancelled", "rejected", "noshow"].includes(status);
}

function buildCustomerRowsFromBootstrap(data: BootstrapPayload): CustomerViewRow[] {
  const today = currentDateInTimeZone();
  const petsByGuardian = new Map<string, typeof data.pets>();

  for (const pet of data.pets) {
    petsByGuardian.set(pet.guardian_id, [...(petsByGuardian.get(pet.guardian_id) ?? []), pet]);
  }

  return data.guardians.map((guardian) => {
    const pets = petsByGuardian.get(guardian.id) ?? [];
    const petIds = new Set(pets.map((pet) => pet.id));
    const guardianAppointments = data.appointments
      .filter((appointment) => appointment.guardian_id === guardian.id || petIds.has(appointment.pet_id))
      .sort((first, second) => `${first.appointment_date} ${first.appointment_time}`.localeCompare(`${second.appointment_date} ${second.appointment_time}`));
    const upcomingAppointment = guardianAppointments.find(
      (appointment) => appointment.appointment_date >= today && isActiveAppointmentStatus(appointment.status),
    );
    const groomingRecords = data.groomingRecords
      .filter((record) => record.guardian_id === guardian.id || petIds.has(record.pet_id))
      .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at));
    const recentRecord = groomingRecords[0];
    const recentCompletedAppointment = [...guardianAppointments]
      .reverse()
      .find((appointment) => appointment.appointment_date < today || appointment.status === "completed");
    const recentVisitDate = recentRecord?.groomed_at.slice(0, 10) ?? recentCompletedAppointment?.appointment_date ?? null;
    const petNames = pets.length > 0 ? pets.map((pet) => pet.name) : ["반려동물 없음"];
    const alertEnabled = guardian.notification_settings?.enabled !== false;
    const noshowCount = guardianAppointments.filter((appointment) => appointment.status === "noshow").length;
    const tags = [
      noshowCount >= 2 ? `노쇼 ${noshowCount}회` : "",
      upcomingAppointment ? "예약 있음" : "",
      groomingRecords.length > 0 ? "미용 기록" : "",
      guardian.memo?.trim() ? "상담 필요" : "",
      alertEnabled ? "알림 수신" : "알림 중지",
    ].filter(Boolean);

    return {
      id: guardian.id,
      name: guardian.name,
      phone: guardian.phone,
      pets: petNames,
      tags: tags.length > 0 ? tags : ["일반"],
      recentVisit: recentVisitDate ? formatMonthDay(recentVisitDate) : "방문 전",
      recentVisitDate,
      nextBooking: upcomingAppointment ? `${formatMonthDay(upcomingAppointment.appointment_date)} ${upcomingAppointment.appointment_time}` : "예약 없음",
      nextBookingDate: upcomingAppointment?.appointment_date ?? null,
      memo: guardian.memo?.trim() || pets.map((pet) => pet.notes).filter(Boolean).join(" / ") || "고객 메모가 없습니다.",
      alerts: alertEnabled ? "알림 수신 중" : "알림 중지",
      alertEnabled,
      appointmentCount: guardianAppointments.length,
      groomingCount: groomingRecords.length,
      noshowCount,
      deleted: Boolean(guardian.deleted_at),
      searchText: buildSearchText([guardian.name, guardian.phone, ...petNames, ...tags]),
    };
  });
}

function buildLocalMockCustomerRows(): CustomerViewRow[] {
  const rows = [
    { id: "MOCK-001", name: "한서윤", phone: "010-2184-9301", pets: ["마루"], tags: ["정기 고객"], recentVisit: "5/12", recentVisitDate: "2026-05-12", nextBooking: "5/16 10:30", nextBookingDate: "2026-05-16", memo: "발바닥 털을 짧게 정리 선호.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 8, groomingCount: 6, noshowCount: 0 },
    { id: "MOCK-002", name: "이도윤", phone: "010-7641-2209", pets: ["콩이", "바이"], tags: ["다견"], recentVisit: "5/9", recentVisitDate: "2026-05-09", nextBooking: "예약 없음", nextBookingDate: null, memo: "두 마리 동시 방문 시 콩이 먼저 진행.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 5, groomingCount: 4, noshowCount: 0 },
    { id: "MOCK-003", name: "박나은", phone: "010-4120-8831", pets: ["라떼"], tags: ["노쇼 2회", "재확인 필요"], recentVisit: "4/30", recentVisitDate: "2026-04-30", nextBooking: "5/18 14:00", nextBookingDate: "2026-05-18", memo: "예약 전날 확인 연락 필요.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 9, groomingCount: 5, noshowCount: 2 },
    { id: "MOCK-004", name: "최민규", phone: "010-3391-5570", pets: ["누리"], tags: ["상담 필요"], recentVisit: "방문 전", recentVisitDate: null, nextBooking: "5/20 11:30", nextBookingDate: "2026-05-20", memo: "첫 방문. 피부 상태 상담 요청.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 1, groomingCount: 0, noshowCount: 0 },
    { id: "MOCK-005", name: "오하진", phone: "010-9023-1184", pets: ["보리"], tags: ["알림 중지"], recentVisit: "5/1", recentVisitDate: "2026-05-01", nextBooking: "예약 없음", nextBookingDate: null, memo: "알림 대신 전화 선호.", alerts: "알림 중지", alertEnabled: false, appointmentCount: 4, groomingCount: 3, noshowCount: 0 },
    { id: "MOCK-006", name: "정다온", phone: "010-6755-4318", pets: ["루루"], tags: ["재방문 임박"], recentVisit: "4/18", recentVisitDate: "2026-04-18", nextBooking: "예약 없음", nextBookingDate: null, memo: "3주 주기로 재방문 안내하면 좋음.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 7, groomingCount: 7, noshowCount: 0 },
    { id: "MOCK-007", name: "강시우", phone: "010-1182-7430", pets: ["초코"], tags: ["노쇼 3회", "주의"], recentVisit: "4/11", recentVisitDate: "2026-04-11", nextBooking: "예약 없음", nextBookingDate: null, memo: "당일 취소/노쇼 이력 많음. 예약금 안내 권장.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 12, groomingCount: 8, noshowCount: 3 },
    { id: "MOCK-008", name: "서민지", phone: "010-4811-2904", pets: ["구름"], tags: ["피부 민감"], recentVisit: "5/6", recentVisitDate: "2026-05-06", nextBooking: "5/22 16:00", nextBookingDate: "2026-05-22", memo: "저자극 샴푸 사용.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 6, groomingCount: 6, noshowCount: 0 },
    { id: "MOCK-009", name: "오지후", phone: "010-5560-7721", pets: ["하루"], tags: ["대형견"], recentVisit: "5/3", recentVisitDate: "2026-05-03", nextBooking: "5/17 13:00", nextBookingDate: "2026-05-17", memo: "목욕 시간 넉넉한 확보 필요.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 3, groomingCount: 3, noshowCount: 0 },
    { id: "MOCK-010", name: "김유라", phone: "010-7002-1908", pets: ["미미"], tags: ["첫 방문"], recentVisit: "방문 전", recentVisitDate: null, nextBooking: "5/15 12:30", nextBookingDate: "2026-05-15", memo: "예약 때 요청사항 없음.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 1, groomingCount: 0, noshowCount: 0 },
  ] satisfies Array<Omit<CustomerViewRow, "searchText" | "deleted">>;

  return rows.map((row) => ({
    ...row,
    deleted: false,
    searchText: buildSearchText([row.name, row.phone, ...row.pets, ...row.tags]),
  }));
}

function sortCustomers(customers: CustomerViewRow[], sort: CustomerSort) {
  return [...customers].sort((first, second) => {
    if (sort === "nameAsc") return first.name.localeCompare(second.name, "ko");
    return compareDateDesc(first.recentVisitDate, second.recentVisitDate) || first.name.localeCompare(second.name, "ko");
  });
}

function getCustomerTagClass(tag: string) {
  if (tag.startsWith("노쇼")) return "bg-[#fff1f2] text-[#b42318] ring-1 ring-[#f4c7cc]";
  return "bg-[#f4f0eb] text-[#6d655c]";
}

export default function CustomerManagementScreen({ initialData }: { initialData: BootstrapPayload }) {
  const initialCustomers = useMemo(() => {
    const rows = buildCustomerRowsFromBootstrap(initialData);
    const baseRows = rows.length > 0 ? rows : [];
    return showLocalMockCustomers ? [...baseRows, ...buildLocalMockCustomerRows()] : baseRows;
  }, [initialData]);
  const [customers, setCustomers] = useState<CustomerViewRow[]>(() => initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => initialStaffComments);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>("recentDesc");

  useEffect(() => {
    setCustomers(initialCustomers);
    setSelectedCustomerId((current) => (initialCustomers.some((customer) => customer.id === current) ? current : ""));
  }, [initialCustomers]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(staffCommentStorageKey);
      if (stored) setStaffComments((current) => ({ ...current, ...JSON.parse(stored) }));
    } catch {
      // Ignore malformed local storage data.
    }
  }, []);

  const displayedCustomers = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = customers.filter((row) => {
      if (row.deleted) return false;
      if (!normalizedQuery) return true;
      return row.searchText.includes(normalizedQuery);
    });
    return sortCustomers(filtered, sort);
  }, [customers, query, sort]);

  const selectedCustomer = customers.find((row) => row.id === selectedCustomerId);
  const selectedPetName = selectedCustomer?.pets[0] ?? "";
  const selectedCommentKey = selectedCustomer ? `${selectedPetName}|${selectedCustomer.name}` : "";
  const selectedStaffComment = staffComments[selectedCommentKey] ?? "";
  const displayedCustomerIds = useMemo(() => displayedCustomers.map((row) => row.id), [displayedCustomers]);
  const allDisplayedCustomersSelected =
    displayedCustomerIds.length > 0 && displayedCustomerIds.every((id) => selectedDeleteIds.includes(id));

  function updateStaffComment(value: string) {
    if (!selectedCommentKey) return;
    setStaffComments((current) => {
      const next = { ...current, [selectedCommentKey]: value };
      window.localStorage.setItem(staffCommentStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function addCustomer() {
    const nextCustomer: CustomerViewRow = {
      id: `G-${Date.now()}`,
      name: "신규 보호자",
      phone: "010-0000-0000",
      pets: ["반려동물"],
      tags: ["상담 필요", "알림 수신"],
      recentVisit: "방문 전",
      recentVisitDate: null,
      nextBooking: "예약 없음",
      nextBookingDate: null,
      memo: "고객 메모를 입력해 주세요.",
      alerts: "알림 수신 중",
      alertEnabled: true,
      appointmentCount: 0,
      groomingCount: 0,
      noshowCount: 0,
      deleted: false,
      searchText: buildSearchText(["신규 보호자", "010-0000-0000", "반려동물", "상담 필요", "알림 수신"]),
    };

    setCustomers((current) => [nextCustomer, ...current]);
    setSelectedCustomerId(nextCustomer.id);
    setDetailSheetOpen(true);
  }

  function toggleDelete(id: string) {
    setSelectedDeleteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleDeleteMode() {
    setDeleteMode((current) => !current);
    setSelectedDeleteIds([]);
  }

  function toggleDisplayedCustomerSelection() {
    setSelectedDeleteIds((current) => {
      const displayedIdSet = new Set(displayedCustomerIds);
      const allDisplayedSelected = displayedCustomerIds.length > 0 && displayedCustomerIds.every((id) => current.includes(id));

      if (allDisplayedSelected) return current.filter((id) => !displayedIdSet.has(id));
      return Array.from(new Set([...current, ...displayedCustomerIds]));
    });
  }

  function moveSelectedCustomersToDeleted() {
    const selectedIds = new Set(selectedDeleteIds);
    setCustomers((current) => current.map((row) => (selectedIds.has(row.id) ? { ...row, deleted: true } : row)));
    setSelectedCustomerId((current) => (selectedIds.has(current) ? "" : current));
    setSelectedDeleteIds([]);
    setDeleteMode(false);
    setDetailSheetOpen(false);
  }

  function openCustomer(row: CustomerViewRow) {
    if (deleteMode) {
      toggleDelete(row.id);
      return;
    }
    setSelectedCustomerId(row.id);
    setDetailSheetOpen(true);
  }

  function addQuickReservation() {
    if (!selectedCustomer) return;
    setCustomers((current) =>
      current.map((row) =>
        row.id === selectedCustomer.id
          ? {
              ...row,
              nextBooking: "오늘 빠른 예약",
              nextBookingDate: currentDateInTimeZone(),
              appointmentCount: row.appointmentCount + 1,
              tags: Array.from(new Set([...row.tags, "예약 있음"])),
              searchText: buildSearchText([row.name, row.phone, ...row.pets, ...row.tags, "예약 있음"]),
            }
          : row,
      ),
    );
  }

  function toggleAlertStatus() {
    if (!selectedCustomer) return;
    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== selectedCustomer.id) return row;
        const nextAlertEnabled = !row.alertEnabled;
        const tags = row.tags
          .filter((tag) => tag !== "알림 수신" && tag !== "알림 중지")
          .concat(nextAlertEnabled ? "알림 수신" : "알림 중지");
        return {
          ...row,
          alertEnabled: nextAlertEnabled,
          alerts: nextAlertEnabled ? "알림 수신 중" : "알림 중지",
          tags,
          searchText: buildSearchText([row.name, row.phone, ...row.pets, ...tags]),
        };
      }),
    );
  }

  return (
    <div>
      <section className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#dbe2ea] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-[320px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[#64748b] focus-within:border-[#2f7866] focus-within:bg-white">
              <Search className="h-4 w-4 text-[#94a3b8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="보호자명, 연락처, 반려동물 이름 검색"
              />
            </label>
            <button
              type="button"
              onClick={addCustomer}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#2f7866] px-4 text-[14px] font-semibold text-white transition hover:bg-[#286a5a]"
            >
              <Plus className="h-4 w-4" />
              고객 추가
            </button>
            <button
              type="button"
              aria-label={deleteMode ? "고객 삭제 모드 닫기" : "고객 삭제 모드"}
              onClick={toggleDeleteMode}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-[8px] border transition",
                deleteMode
                  ? "border-[#ead9cf] bg-[#fff7ed] text-[#9a4f1f]"
                  : "border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]",
              )}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {deleteMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9cf] bg-[#fffaf6] px-4 py-3">
            <p className="text-[14px] font-medium text-[#5e5248]">
              {selectedDeleteIds.length}명 선택됨
              <span className="ml-2 text-[13px] font-normal text-[#94624f]">선택한 고객은 목록에서 숨김 처리됩니다.</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleDisplayedCustomerSelection} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155]">
                {allDisplayedCustomersSelected ? "선택 해제" : "전체 선택"}
              </button>
              <button type="button" onClick={moveSelectedCustomersToDeleted} className="h-9 rounded-[8px] bg-[#9a4f1f] px-3 text-[13px] font-medium text-white disabled:bg-[#cbd5e1]" disabled={selectedDeleteIds.length === 0}>
                선택 삭제
              </button>
            </div>
          </div>
        ) : null}

        <div className={cn("grid border-b border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 text-center text-[15px] font-semibold text-[#64748b]", customerListGridClass)}>
          <span />
          <button type="button" onClick={() => setSort((current) => (current === "nameAsc" ? "recentDesc" : "nameAsc"))} className="text-center transition hover:text-[#1f6b5b]">
            보호자명
          </button>
          <span className="text-center">반려동물</span>
          <span className="text-center">연락처</span>
          <span className="text-center">다음 예약</span>
          <span className="text-center">알림 수신</span>
          <span />
        </div>
        <div className="max-h-[calc(100vh-240px)] min-h-[620px] overflow-y-auto">
          {displayedCustomers.length > 0 ? (
            displayedCustomers.map((row) => (
              <CustomerListRow
                key={row.id}
                row={row}
                selected={row.id === selectedCustomerId}
                deleteMode={deleteMode}
                checked={selectedDeleteIds.includes(row.id)}
                onToggleDelete={toggleDelete}
                onOpen={openCustomer}
              />
            ))
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <p className="text-[15px] font-medium text-[#111827]">조건에 맞는 고객이 없습니다.</p>
              <p className="mt-1 text-[13px] text-[#64748b]">검색어를 줄이거나 고객을 추가해 주세요.</p>
            </div>
          )}
        </div>
      </section>

      {selectedCustomer && detailSheetOpen ? (
        <CustomerDetailSheet
          customer={selectedCustomer}
          staffComment={selectedStaffComment}
          onClose={() => setDetailSheetOpen(false)}
          onChangeStaffComment={updateStaffComment}
          onAddQuickReservation={addQuickReservation}
          onToggleAlertStatus={toggleAlertStatus}
          onToggleDeleteMode={() => {
            setDeleteMode(true);
            setSelectedDeleteIds([selectedCustomer.id]);
            setDetailSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerListRow({
  row,
  selected,
  deleteMode,
  checked,
  onToggleDelete,
  onOpen,
}: {
  row: CustomerViewRow;
  selected: boolean;
  deleteMode: boolean;
  checked: boolean;
  onToggleDelete: (id: string) => void;
  onOpen: (row: CustomerViewRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={cn(
        "relative grid min-h-[68px] w-full items-center border-b border-[#edf2f7] px-4 text-left transition last:border-b-0",
        customerListGridClass,
        selected ? "bg-white shadow-[inset_0_0_0_1px_rgba(47,120,102,0.28)]" : "bg-white hover:bg-[#f8fafc]",
      )}
    >
      {selected ? <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#2f7866]" /> : null}
      <span className="flex items-center">
        {deleteMode ? (
          <span
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDelete(row.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggleDelete(row.id);
              }
            }}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-[5px] border",
              checked ? "border-[#2f7866] bg-[#2f7866] text-white" : "border-[#cbd5e1] bg-white",
            )}
          >
            {checked ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
        ) : (
          <span className={cn("h-2.5 w-2.5 rounded-full", row.noshowCount >= 2 ? "bg-[#b42318]" : row.alertEnabled ? "bg-[#4f9b88]" : "bg-[#d5dde6]")} />
        )}
      </span>
      <span className="min-w-0 text-center">
        <span className="block truncate text-[15px] font-semibold text-[#111827]">{row.name}</span>
        <span className="mt-0.5 block truncate text-[12px] text-[#64748b]">{row.appointmentCount}건 예약 · {row.groomingCount}건 기록</span>
      </span>
      <span className="truncate text-center text-[15px] text-[#111827]">{row.pets.join(", ")}</span>
      <span className="truncate text-center text-[15px] tabular-nums text-[#111827]">{formatPhoneNumber(row.phone)}</span>
      <span className={cn("truncate text-center text-[15px]", row.nextBookingDate ? "text-[#1f6b5b]" : "text-[#94a3b8]")}>{row.nextBooking}</span>
      <span className="flex min-w-0 justify-center">
        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium", row.alertEnabled ? "bg-[#e8f4ef] text-[#1f6b5b]" : "bg-[#f1f5f9] text-[#64748b]")}>
          {row.alertEnabled ? "수신" : "중지"}
        </span>
      </span>
      <span className="flex justify-end">
        <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
      </span>
    </button>
  );
}

function CustomerDetailSheet({
  customer,
  staffComment,
  onClose,
  onChangeStaffComment,
  onAddQuickReservation,
  onToggleAlertStatus,
  onToggleDeleteMode,
}: {
  customer: CustomerViewRow;
  staffComment: string;
  onClose: () => void;
  onChangeStaffComment: (value: string) => void;
  onAddQuickReservation: () => void;
  onToggleAlertStatus: () => void;
  onToggleDeleteMode: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[460px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">고객 상세</p>
            <h3 className="mt-2 truncate text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">{customer.name}</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">{formatPhoneNumber(customer.phone)}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            <CustomerInfoTile label="반려동물" value={customer.pets.join(", ")} />
            <CustomerInfoTile label="최근 방문" value={customer.recentVisit} />
            <CustomerInfoTile label="다음 예약" value={customer.nextBooking} />
            <CustomerInfoTile label="알림" value={customer.alerts} />
          </div>

          {customer.noshowCount >= 2 ? (
            <section className="mt-3 rounded-[8px] border border-[#f4c7cc] bg-[#fff7f8] px-4 py-3">
              <p className="text-[12px] font-semibold text-[#b42318]">노쇼 주의 고객</p>
              <p className="mt-1 text-[14px] leading-5 text-[#7f1d1d]">노쇼가 {customer.noshowCount}회 기록되었습니다. 예약 확정 전에 재확인이 필요합니다.</p>
            </section>
          ) : null}

          <section className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[#64748b]" />
              <p className="text-[13px] font-semibold text-[#334155]">고객 메모</p>
            </div>
            <p className="mt-2 text-[15px] leading-6 text-[#111827]">{customer.memo}</p>
          </section>

          <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[#1f6b5b]">스태프 코멘트</p>
              <span className="text-[11px] font-medium text-[#94a3b8]">다음 방문 공유</span>
            </div>
            <textarea
              value={staffComment}
              onChange={(event) => onChangeStaffComment(event.target.value)}
              placeholder="다음 방문 때 참고할 작업 특징이나 주의사항을 적어주세요."
              className="mt-2 h-[112px] w-full resize-none bg-transparent text-[15px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8]"
            />
          </section>

          <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
            <p className="text-[13px] font-semibold text-[#334155]">태그</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span key={tag} className={cn("rounded-full px-3 py-1.5 text-[13px]", getCustomerTagClass(tag))}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-[#edf2f7] bg-white px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onAddQuickReservation} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#2f7866] text-[14px] font-semibold text-white">
              <CalendarPlus className="h-4 w-4" />
              예약 추가
            </button>
            <button type="button" onClick={onToggleAlertStatus} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
              <Bell className="h-4 w-4" />
              알림 변경
            </button>
            <button type="button" onClick={onToggleDeleteMode} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ead9cf] bg-white text-[13px] font-medium text-[#94624f]">
              <Trash2 className="h-4 w-4" />
              고객 삭제 모드로 이동
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CustomerInfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3">
      <p className="text-[12px] font-medium text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
