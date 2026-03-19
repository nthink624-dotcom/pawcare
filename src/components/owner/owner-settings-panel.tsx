"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { addDate, currentDateInTimeZone, formatServicePrice } from "@/lib/utils";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import type { BootstrapPayload, Service } from "@/types/domain";

type SettingsPanelProps = {
  data: BootstrapPayload;
  onSave: (payload: unknown) => Promise<unknown> | void;
  onSaveService: (payload: unknown) => Promise<unknown> | void;
  onSaveCustomerPageSettings: (payload: unknown) => Promise<unknown> | void;
};

type SaveFeedback = {
  type: "idle" | "success" | "error";
  message: string;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export default function OwnerSettingsPanel({ data, onSave, onSaveService, onSaveCustomerPageSettings }: SettingsPanelProps) {
  const [name, setName] = useState(data.shop.name);
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(data.shop.address);
  const [description, setDescription] = useState(data.shop.description);
  const [regularClosedDays, setRegularClosedDays] = useState<number[]>(data.shop.regular_closed_days);
  const [temporaryClosedDates, setTemporaryClosedDates] = useState<string[]>(data.shop.temporary_closed_dates);
  const [pendingClosedDate, setPendingClosedDate] = useState("");
  const [isClosedDatePickerOpen, setIsClosedDatePickerOpen] = useState(false);
  const [closedDateMonthCursor, setClosedDateMonthCursor] = useState((data.shop.temporary_closed_dates[0] ?? currentDateInTimeZone()).slice(0, 7));
  const [operatingHoursNote, setOperatingHoursNote] = useState(data.shop.customer_page_settings?.operating_hours_note ?? "");
  const [holidayNotice, setHolidayNotice] = useState(data.shop.customer_page_settings?.holiday_notice ?? "");
  const [parkingNotice, setParkingNotice] = useState(data.shop.customer_page_settings?.parking_notice ?? "");
  const [notices, setNotices] = useState<string[]>([
    data.shop.customer_page_settings?.notices?.[0] ?? "",
    data.shop.customer_page_settings?.notices?.[1] ?? "",
    data.shop.customer_page_settings?.notices?.[2] ?? "",
  ]);
  const [showNotices, setShowNotices] = useState(data.shop.customer_page_settings?.show_notices ?? true);
  const [showParkingNotice, setShowParkingNotice] = useState(data.shop.customer_page_settings?.show_parking_notice ?? true);
  const [newService, setNewService] = useState({ name: "", price: "", priceType: "fixed" as "fixed" | "starting", duration: "60" });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServicePrice, setEditingServicePrice] = useState("");
  const [editingServicePriceType, setEditingServicePriceType] = useState<"fixed" | "starting">("fixed");
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoFeedback, setBasicInfoFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });

  const notificationSettings = useMemo(
    () => ({
      enabled: data.shop.notification_settings.enabled,
      revisitEnabled: data.shop.notification_settings.revisit_enabled,
      bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
      bookingRejectedEnabled: data.shop.notification_settings.booking_rejected_enabled,
      bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
      bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
      groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
      groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
    }),
    [data.shop.notification_settings],
  );

  const businessHours = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data.shop.business_hours).map(([key, value]) => [key, value || { open: "10:00", close: "19:00", enabled: false }]),
      ),
    [data.shop.business_hours],
  );

  const closedDateMonthLabel = `${Number(closedDateMonthCursor.slice(0, 4))}년 ${Number(closedDateMonthCursor.slice(5, 7))}월`;
  const closedDateMonthCells = useMemo(() => {
    const monthStart = closedDateMonthCursor + "-01";
    const startDate = new Date(monthStart + "T00:00:00");
    const startWeekday = startDate.getDay();
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayOffset = index - startWeekday;
      if (dayOffset < 0 || dayOffset >= daysInMonth) return null;
      return addDate(monthStart, dayOffset);
    });
  }, [closedDateMonthCursor]);

  function updateNotice(index: number, value: string) {
    setNotices((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function startEditingService(service: Service) {
    setEditingServiceId(service.id);
    setEditingServiceName(service.name);
    setEditingServicePrice(String(service.price));
    setEditingServicePriceType(service.price_type ?? "fixed");
  }

  function stopEditingService() {
    setEditingServiceId(null);
    setEditingServiceName("");
    setEditingServicePrice("");
    setEditingServicePriceType("fixed");
  }

  async function saveBasicInfo() {
    setSavingBasicInfo(true);
    setBasicInfoFeedback({ type: "idle", message: "" });

    try {
      const nextCustomerPageSettings = normalizeCustomerPageSettings(
        {
          ...data.shop.customer_page_settings,
          shop_name: name,
          tagline: description,
          operating_hours_note: operatingHoursNote,
          holiday_notice: holidayNotice,
          parking_notice: parkingNotice,
          notices,
          show_notices: showNotices,
          show_parking_notice: showParkingNotice,
        },
        name,
        description,
      );

      await Promise.all([
        Promise.resolve(
          onSave({
            shopId: data.shop.id,
            name,
            phone,
            address,
            description,
            concurrentCapacity: data.shop.concurrent_capacity,
            approvalMode: data.shop.approval_mode,
            regularClosedDays,
            temporaryClosedDates,
            businessHours,
            notificationSettings,
          }),
        ),
        Promise.resolve(
          onSaveCustomerPageSettings({
            shopId: data.shop.id,
            customerPageSettings: nextCustomerPageSettings,
          }),
        ),
      ]);
      setBasicInfoFeedback({ type: "success", message: "매장 기본 정보가 저장되었어요." });
    } catch (error) {
      setBasicInfoFeedback({ type: "error", message: error instanceof Error ? error.message : "매장 기본 정보를 저장하지 못했습니다." });
    } finally {
      setSavingBasicInfo(false);
    }
  }

  return (
    <section className="space-y-3.5 p-4">
      <SettingsCard title="매장 기본 정보">
        <div className="space-y-2">
          <Field label="매장명"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="한줄 소개"><textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="연락처"><input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
            <Field label="주소"><input className="field" value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
          </div>
          <Field label="운영시간">
            <textarea className="field min-h-20" value={operatingHoursNote} onChange={(event) => setOperatingHoursNote(event.target.value)} placeholder="예: 월-토 10:00 - 19:00, 일요일 휴무" />
          </Field>
          <Field label="휴무 안내">
            <textarea className="field min-h-20" value={holidayNotice} onChange={(event) => setHolidayNotice(event.target.value)} placeholder="예: 매주 일요일 휴무, 임시 휴무는 공지사항으로 안내드려요." />
          </Field>
          <Field label="주차 안내">
            <div className="space-y-2">
              <ToggleRow label="주차 안내 노출" checked={showParkingNotice} onChange={setShowParkingNotice} />
              <textarea className="field min-h-20" value={parkingNotice} onChange={(event) => setParkingNotice(event.target.value)} placeholder="예: 건물 뒤편 공용 주차장을 이용해 주세요." />
            </div>
          </Field>
          <Field label="공지사항">
            <div className="space-y-2">
              <ToggleRow label="공지사항 노출" checked={showNotices} onChange={setShowNotices} />
              <div className="space-y-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <input className="field" value={notices[0] || ""} onChange={(event) => updateNotice(0, event.target.value)} placeholder="공지 1" />
                <input className="field" value={notices[1] || ""} onChange={(event) => updateNotice(1, event.target.value)} placeholder="공지 2" />
                <input className="field" value={notices[2] || ""} onChange={(event) => updateNotice(2, event.target.value)} placeholder="공지 3" />
              </div>
            </div>
          </Field>
          {basicInfoFeedback.type !== "idle" ? (
            <div className={`rounded-[16px] px-4 py-2.5 text-sm ${basicInfoFeedback.type === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700"}`}>
              {basicInfoFeedback.message}
            </div>
          ) : null}
          <SolidButton onClick={saveBasicInfo} disabled={savingBasicInfo}>
            {savingBasicInfo ? "저장 중..." : "매장정보 저장"}
          </SolidButton>
        </div>
      </SettingsCard>

      <SettingsCard title="휴무일 지정">
        <Field label="정기 휴무">
          <div className="grid grid-cols-4 gap-2">
            {weekdayLabels.map((label, index) => {
              const active = regularClosedDays.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setRegularClosedDays((prev) => (prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index].sort((a, b) => a - b)))}
                  className={`rounded-[14px] border px-3 py-3 text-sm font-semibold ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--muted)]"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="특정 휴무일">
          <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded-[14px] border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--text)]"
                onClick={() => setIsClosedDatePickerOpen(true)}
              >
                <span>{pendingClosedDate ? pendingClosedDate : "날짜 선택"}</span>
                <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
              </button>
              <button
                type="button"
                className="rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!pendingClosedDate}
                onClick={() => {
                  if (!pendingClosedDate || temporaryClosedDates.includes(pendingClosedDate)) return;
                  setTemporaryClosedDates((prev) => [...prev, pendingClosedDate].sort());
                  setPendingClosedDate("");
                }}
              >
                추가
              </button>
            </div>
            {temporaryClosedDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {temporaryClosedDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                    onClick={() => setTemporaryClosedDates((prev) => prev.filter((item) => item !== date))}
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">등록된 특정 휴무일이 없어요.</p>
            )}
          </div>
        </Field>
      </SettingsCard>

      <SettingsCard title="서비스 관리">
        <div className="space-y-2">
          {data.services.map((service) => {
            const isEditing = editingServiceId === service.id;
            return (
              <div key={service.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input className="field" value={editingServiceName} onChange={(event) => setEditingServiceName(event.target.value)} placeholder="서비스명" />
                        <input className="field" value={editingServicePrice} onChange={(event) => setEditingServicePrice(event.target.value)} placeholder="가격" />
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold">{service.name}</p>
                        <p className="text-xs text-[var(--muted)]">{formatServicePrice(service.price, service.price_type ?? "fixed")} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
                      </div>
                    )}
                  </div>
                  <button className="shrink-0 text-xs font-semibold text-[var(--accent)]" onClick={() => onSaveService({ shopId: data.shop.id, serviceId: service.id, name: isEditing ? editingServiceName : service.name, price: isEditing ? Number(editingServicePrice) : service.price, priceType: isEditing ? editingServicePriceType : (service.price_type ?? "fixed"), durationMinutes: service.duration_minutes, isActive: !service.is_active })}>
                    {service.is_active ? "비활성화" : "활성화"}
                  </button>
                </div>
                {isEditing ? (
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <SolidButton onClick={() => { onSaveService({ shopId: data.shop.id, serviceId: service.id, name: editingServiceName, price: Number(editingServicePrice), priceType: editingServicePriceType, durationMinutes: service.duration_minutes, isActive: service.is_active }); stopEditingService(); }} disabled={!editingServiceName || !editingServicePrice}>저장</SolidButton>
                    <OutlineButton onClick={stopEditingService}>취소</OutlineButton>
                  </div>
                ) : (
                  <button className="mt-3 rounded-[14px] border border-[var(--border)] bg-white px-3 py-[11px] text-sm font-semibold text-[var(--muted)]" onClick={() => startEditingService(service)}>서비스 수정</button>
                )}
              </div>
            );
          })}
          <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[#fcfaf7] p-4">
            <div className="grid grid-cols-3 gap-2">
              <input className="field" placeholder="서비스명" value={newService.name} onChange={(event) => setNewService((prev) => ({ ...prev, name: event.target.value }))} />
              <input className="field" placeholder="가격" value={newService.price} onChange={(event) => setNewService((prev) => ({ ...prev, price: event.target.value }))} />
              <input className="field" placeholder="분" value={newService.duration} onChange={(event) => setNewService((prev) => ({ ...prev, duration: event.target.value }))} />
            </div>
            <button className="mt-3 w-full rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-3 py-[11px] text-sm font-semibold text-white" onClick={() => onSaveService({ shopId: data.shop.id, name: newService.name, price: Number(newService.price), priceType: newService.priceType, durationMinutes: Number(newService.duration), isActive: true })}>서비스 추가</button>
          </div>
        </div>
      </SettingsCard>

      {isClosedDatePickerOpen ? (
        <ClosedDatePickerSheet
          monthCursor={closedDateMonthCursor}
          monthLabel={closedDateMonthLabel}
          selectedDate={pendingClosedDate}
          cells={closedDateMonthCells}
          onClose={() => setIsClosedDatePickerOpen(false)}
          onPrevMonth={() => setClosedDateMonthCursor(addDate(closedDateMonthCursor + "-01", -1).slice(0, 7))}
          onNextMonth={() => setClosedDateMonthCursor(addDate(closedDateMonthCursor + "-28", 4).slice(0, 7))}
          onSelectDate={setPendingClosedDate}
        />
      ) : null}
    </section>
  );
}

function ClosedDatePickerSheet({
  monthCursor,
  monthLabel,
  selectedDate,
  cells,
  onClose,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: {
  monthCursor: string;
  monthLabel: string;
  selectedDate: string;
  cells: Array<string | null>;
  onClose: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">특정 휴무일 선택</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">예약 조회 달력처럼 날짜를 골라 추가하세요.</p>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onPrevMonth}><ChevronLeft className="h-4 w-4" /></button>
            <p className="text-sm font-semibold text-[var(--text)]">{monthLabel}</p>
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onNextMonth}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-[var(--muted)]">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((date, index) => {
              if (!date) return <div key={monthCursor + index} className="h-11" />;
              const active = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={`h-11 rounded-[16px] text-sm font-semibold transition ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--text)]"}`}
                >
                  {Number(date.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-soft)]"><div className="mb-2"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h2></div><div className="space-y-2">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-[var(--text)]"><span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>{children}</label>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"><p className="text-sm font-semibold text-[var(--text)]">{label}</p><button type="button" onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button></label>;
}

function SolidButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void | Promise<void> }) {
  return <button disabled={disabled} onClick={() => void onClick()} className="flex h-[43px] w-full items-center justify-center rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] disabled:opacity-50">{children}</button>;
}

function OutlineButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className="flex h-[43px] w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:opacity-50">{children}</button>;
}
