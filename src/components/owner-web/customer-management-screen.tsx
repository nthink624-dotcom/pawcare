"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Trash2, X } from "lucide-react";

import { customerRows } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  PrimaryButton,
  SearchField,
  SelectLike,
  TableRow,
  TableShell,
  ToolbarRow,
} from "@/components/owner-web/owner-web-ui";
import { currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const staffCommentStorageKey = "petmanager.ownerWeb.staffComments";
type CustomerRow = (typeof customerRows)[number];
type CustomerFilter = "전체" | "알림 수신" | "알림 중지";
const customerFilterOptions: CustomerFilter[] = ["전체", "알림 수신", "알림 중지"];
const initialStaffComments: Record<string, string> = {
  "우유|정유진": "첫 방문 때 긴장했음. 목 주변은 잡아주면 안정됨.",
  "몽이|김민지": "물 온도 낮으면 싫어함. 시작 전에 충분히 적셔주기.",
};

function formatMonthDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function buildCustomerRowsFromBootstrap(data: BootstrapPayload): CustomerRow[] {
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
      (appointment) =>
        appointment.appointment_date >= today &&
        !["cancelled", "rejected", "noshow"].includes(appointment.status),
    );
    const recentRecord = data.groomingRecords
      .filter((record) => record.guardian_id === guardian.id || petIds.has(record.pet_id))
      .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at))[0];
    const recentCompletedAppointment = [...guardianAppointments]
      .reverse()
      .find((appointment) => appointment.appointment_date < today || appointment.status === "completed");
    const tags = [
      guardian.memo?.trim() ? "상담 필요" : "",
      upcomingAppointment ? "예약 있음" : "",
      recentRecord ? "미용 기록" : "",
    ].filter(Boolean);

    return {
      id: guardian.id,
      name: guardian.name,
      phone: guardian.phone,
      tags: tags.length > 0 ? tags : ["일반"],
      pets: pets.length > 0 ? pets.map((pet) => pet.name) : ["반려동물 없음"],
      recentVisit: recentRecord
        ? formatMonthDay(recentRecord.groomed_at.slice(0, 10))
        : recentCompletedAppointment
          ? formatMonthDay(recentCompletedAppointment.appointment_date)
          : "방문 전",
      nextBooking: upcomingAppointment
        ? `${formatMonthDay(upcomingAppointment.appointment_date)} ${upcomingAppointment.appointment_time}`
        : "예약 없음",
      memo: guardian.memo?.trim() || pets.map((pet) => pet.notes).filter(Boolean).join(" / ") || "고객 메모가 없습니다.",
      alerts: guardian.notification_settings?.enabled === false ? "알림 일시 중지" : "알림 수신 중",
    };
  });
}

function matchesCustomerFilter(row: CustomerRow, filter: CustomerFilter) {
  if (filter === "전체") return true;
  if (filter === "알림 수신") return row.alerts.includes("수신");
  if (filter === "알림 중지") return row.alerts.includes("중지");
  return true;
}

export default function CustomerManagementScreen({ initialData }: { initialData: BootstrapPayload }) {
  const initialCustomers = useMemo(() => buildCustomerRowsFromBootstrap(initialData), [initialData]);
  const [customers, setCustomers] = useState<CustomerRow[]>(() => initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => initialStaffComments);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [recentFirst, setRecentFirst] = useState(true);
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>("전체");

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.id === selectedCustomerId) ?? customers[0],
    [customers, selectedCustomerId],
  );
  const displayedCustomers = useMemo(() => {
    const filtered = customers.filter((row) => matchesCustomerFilter(row, customerFilter));
    return [...filtered].sort((first, second) => (recentFirst ? first.recentVisit.localeCompare(second.recentVisit) : first.name.localeCompare(second.name)));
  }, [customerFilter, customers, recentFirst]);
  const selectedPetName = selectedCustomer?.pets[0] ?? "";
  const selectedCommentKey = selectedCustomer ? `${selectedPetName}|${selectedCustomer.name}` : "";
  const selectedStaffComment = staffComments[selectedCommentKey] ?? "";

  useEffect(() => {
    setCustomers(initialCustomers);
    setSelectedCustomerId((current) =>
      initialCustomers.some((customer) => customer.id === current) ? current : initialCustomers[0]?.id ?? "",
    );
  }, [initialCustomers]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(staffCommentStorageKey);
      if (stored) {
        setStaffComments({ ...initialStaffComments, ...(JSON.parse(stored) as Record<string, string>) });
      }
    } catch {
      window.localStorage.removeItem(staffCommentStorageKey);
    }
  }, []);

  function updateStaffComment(value: string) {
    if (!selectedCommentKey) return;

    setStaffComments((current) => {
      const next = { ...current, [selectedCommentKey]: value };
      window.localStorage.setItem(staffCommentStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function toggleDelete(id: string) {
    setSelectedDeleteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function addCustomer() {
    const nextCustomer = {
      id: `G-${Date.now()}`,
      name: "신규 보호자",
      phone: "010-0000-0000",
      tags: ["상담 필요"],
      pets: ["반려동물"],
      recentVisit: "신규",
      nextBooking: "예약 없음",
      memo: "고객 메모를 입력해 주세요.",
      alerts: "알림 수신 중",
    };

    setCustomers((current) => [nextCustomer, ...current]);
    setSelectedCustomerId(nextCustomer.id);
    setDetailSheetOpen(true);
  }

  function selectAllDisplayedCustomers() {
    setSelectedDeleteIds(displayedCustomers.map((row) => row.id));
  }

  function deleteSelectedCustomers() {
    if (selectedDeleteIds.length === 0) {
      return;
    }

    setCustomers((current) => {
      const next = current.filter((row) => !selectedDeleteIds.includes(row.id));
      if (!next.some((row) => row.id === selectedCustomerId)) {
        setSelectedCustomerId(next[0]?.id ?? "");
      }
      return next;
    });
    setSelectedDeleteIds([]);
  }

  function addQuickReservation() {
    if (!selectedCustomer) return;

    setCustomers((current) =>
      current.map((row) => (row.id === selectedCustomer.id ? { ...row, nextBooking: "오늘 빠른 예약" } : row)),
    );
  }

  function toggleAlertStatus() {
    if (!selectedCustomer) return;

    const nextAlert = selectedCustomer.alerts.includes("수신") ? "알림 일시 중지" : "알림 수신 중";
    setCustomers((current) =>
      current.map((row) => (row.id === selectedCustomer.id ? { ...row, alerts: nextAlert } : row)),
    );
  }

  return (
    <div className="space-y-4">
      <ToolbarRow className="gap-3">
        <div className="min-w-[320px] flex-1">
          <SearchField placeholder="보호자명, 연락처, 반려동물 이름 검색" />
        </div>
        <PrimaryButton label="고객 추가" onClick={addCustomer} />
      </ToolbarRow>

      <ToolbarRow className="justify-between">
        <div className="flex flex-wrap items-center gap-2 [&>div>button]:h-10 [&>div>button]:w-[104px] [&>div>button]:shrink-0">
          <CustomerFilterDropdown value={customerFilter} onChange={setCustomerFilter} />
        </div>
        <div className="flex flex-wrap items-center gap-2 [&>button]:h-10 [&>button]:w-[104px] [&>button]:shrink-0">
          <SelectLike
            label={recentFirst ? "최신 방문순" : "이름순"}
            onClick={() => {
              setRecentFirst((current) => !current);
            }}
          />
          <GhostButton label={deleteMode ? "삭제 모드 닫기" : "고객 삭제"} onClick={() => setDeleteMode((current) => !current)} />
        </div>
      </ToolbarRow>

      {deleteMode ? (
        <ToolbarRow className="justify-between rounded-[18px] border border-[#ead9cf] bg-[#fffaf6] px-4 py-3">
          <span className="text-[14px] font-medium text-[#5e5248]">{selectedDeleteIds.length}명 선택됨</span>
          <div className="flex items-center gap-2">
            <GhostButton label="전체 선택" onClick={selectAllDisplayedCustomers} />
            <GhostButton label="선택 삭제" onClick={deleteSelectedCustomers} />
          </div>
        </ToolbarRow>
      ) : null}

      <div>
        <TableShell columns={["고객", "연락처", "반려동물", "태그", "최근 방문"]}>
          {displayedCustomers.map((row) => (
            <TableRow
              key={row.id}
              active={row.id === selectedCustomerId}
              onClick={() => {
                setSelectedCustomerId(row.id);
                setDetailSheetOpen(true);
              }}
              columns={[
                <div key="name" className="flex items-start gap-3">
                  {deleteMode ? (
                    <button
                      type="button"
                      className={`mt-0.5 h-4 w-4 rounded border ${selectedDeleteIds.includes(row.id) ? "border-[#2f7866] bg-[#2f7866]" : "border-[#d5cec7] bg-white"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDelete(row.id);
                      }}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.name}</p>
                    <p className="mt-1 text-[12px] text-[#8b8279]">{row.alerts}</p>
                  </div>
                </div>,
                <p key="phone" className="text-[14px] text-[#17211f]">{row.phone}</p>,
                <p key="pets" className="text-[14px] text-[#17211f]">{row.pets.join(", ")}</p>,
                <div key="tags" className="flex flex-wrap gap-1.5">
                  {row.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f4f0eb] px-2.5 py-1 text-[12px] text-[#6d655c]">
                      {tag}
                    </span>
                  ))}
                </div>,
                <div key="recent" className="flex items-center justify-between gap-2">
                  <span className="text-[14px] text-[#17211f]">{row.recentVisit}</span>
                  {!deleteMode ? <ChevronRight className="h-4 w-4 text-[#b1a69c]" /> : null}
                </div>,
              ]}
            />
          ))}
        </TableShell>
      </div>

      {selectedCustomer && detailSheetOpen ? (
        <CustomerDetailSheet
          customer={selectedCustomer}
          staffComment={selectedStaffComment}
          onClose={() => setDetailSheetOpen(false)}
          onChangeStaffComment={updateStaffComment}
          onAddQuickReservation={addQuickReservation}
          onToggleAlertStatus={toggleAlertStatus}
          onToggleDeleteMode={() => setDeleteMode((current) => !current)}
        />
      ) : null}
    </div>
  );
}

function CustomerFilterDropdown({
  value,
  onChange,
}: {
  value: CustomerFilter;
  onChange: (value: CustomerFilter) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-[8px] border px-3.5 text-[13px] font-medium transition ${
          value === "전체"
            ? "border-[#dbe2ea] bg-white text-[#475569]"
            : "border-[#cfded8] bg-[#f6fbf9] text-[#1f6b5b]"
        }`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-[180px] overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-white p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
        >
          {customerFilterOptions.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center justify-between gap-2 rounded-[8px] px-3 text-left text-[13px] transition ${
                  selected ? "bg-[#edf7f3] font-semibold text-[#1f6b5b]" : "text-[#334155] hover:bg-[#f8fafc]"
                }`}
              >
                <span>{option}</span>
                {selected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
  customer: CustomerRow;
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
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">고객 상세</p>
            <h3 className="mt-2 truncate text-[24px] font-semibold text-[#111827]">{customer.name}</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">{customer.phone}</p>
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

          <section className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">고객 메모</p>
            <p className="mt-2 text-[15px] leading-6 text-[#111827]">{customer.memo}</p>
          </section>

          <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-[#1f6b5b]">스태프 코멘트</p>
              <span className="text-[11px] font-medium text-[#94a3b8]">스케줄 공유</span>
            </div>
            <textarea
              value={staffComment}
              onChange={(event) => onChangeStaffComment(event.target.value)}
              placeholder="스케줄에서 남긴 작업 특징이 여기에 함께 보입니다."
              className="mt-2 h-[110px] w-full resize-none bg-transparent text-[15px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8]"
            />
          </section>

          <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">태그</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#f4f0eb] px-3 py-1.5 text-[13px] text-[#6d655c]">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-2">
            <PrimaryButton label="빠른 예약 추가" onClick={onAddQuickReservation} />
            <GhostButton label="알림 상태 수정" onClick={onToggleAlertStatus} />
            <button
              type="button"
              onClick={onToggleDeleteMode}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ead9cf] bg-white text-[13px] font-medium text-[#94624f] hover:bg-[#fffaf6]"
            >
              <Trash2 className="h-4 w-4" />
              고객 선택 삭제 모드
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
      <p className="text-[12px] text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
