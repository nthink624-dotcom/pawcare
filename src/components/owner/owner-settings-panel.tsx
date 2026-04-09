"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { addDate, currentDateInTimeZone, decodeUnicodeEscapes, formatServicePrice } from "@/lib/utils";
import type { BootstrapPayload, Service } from "@/types/domain";

type SettingsPanelProps = {
  data: BootstrapPayload;
  onSave: (payload: unknown) => Promise<unknown> | void;
  onSaveService: (payload: unknown) => Promise<unknown> | void;
  onSaveCustomerPageSettings: (payload: unknown) => Promise<unknown> | void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
};

type SaveFeedback = {
  type: "idle" | "success" | "error";
  message: string;
};

type PriceType = "fixed" | "starting";

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const addressSuggestions = [
  "서울시 강남구 테헤란로 123",
  "서울시 송파구 올림픽로 300",
  "서울시 마포구 양화로 45",
  "경기도 성남시 분당구 판교역로 166",
  "인천시 연수구 센트럴로 123",
  "대전시 유성구 대학로 99",
  "광주시 서구 상무대로 777",
  "대구시 수성구 달구벌대로 2500",
  "부산시 해운대구 센텀중앙로 79",
  "충청남도 천안시 서북구 미라9길 14",
];

function monthCursorFromDate(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(cursor: string, amount: number) {
  const [year, month] = cursor.split("-").map(Number);
  const next = new Date(year, month - 1 + amount, 1);
  const nextYear = next.getFullYear();
  const nextMonth = String(next.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export default function OwnerSettingsPanel({
  data,
  onSave,
  onSaveService,
  onSaveCustomerPageSettings,
  onLogout,
  loggingOut = false,
  userEmail,
  subscriptionSummary,
}: SettingsPanelProps) {
  const [name, setName] = useState(decodeUnicodeEscapes(data.shop.name));
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(decodeUnicodeEscapes(data.shop.address));
  const [detailAddress, setDetailAddress] = useState("");
  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [description, setDescription] = useState(decodeUnicodeEscapes(data.shop.description));
  const [regularClosedDays, setRegularClosedDays] = useState<number[]>(data.shop.regular_closed_days);
  const [temporaryClosedDates, setTemporaryClosedDates] = useState<string[]>(data.shop.temporary_closed_dates);
  const [pendingClosedDate, setPendingClosedDate] = useState("");
  const [isClosedDatePickerOpen, setIsClosedDatePickerOpen] = useState(false);
  const [closedDateMonthCursor, setClosedDateMonthCursor] = useState(monthCursorFromDate(data.shop.temporary_closed_dates[0] ?? currentDateInTimeZone()));
  const [operatingHoursNote, setOperatingHoursNote] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.operating_hours_note ?? ""));
  const [holidayNotice, setHolidayNotice] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.holiday_notice ?? ""));
  const [parkingNotice, setParkingNotice] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.parking_notice ?? ""));
  const [notices, setNotices] = useState<string[]>([
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[0] ?? ""),
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[1] ?? ""),
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[2] ?? ""),
  ]);
  const [showNotices, setShowNotices] = useState(data.shop.customer_page_settings?.show_notices ?? true);
  const [showParkingNotice, setShowParkingNotice] = useState(data.shop.customer_page_settings?.show_parking_notice ?? true);
  const [newService, setNewService] = useState({
    name: "",
    price: "",
    duration: "60",
    priceType: "starting" as PriceType,
    isActive: true,
  });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServicePrice, setEditingServicePrice] = useState("");
  const [editingServiceDuration, setEditingServiceDuration] = useState("");
  const [editingServicePriceType, setEditingServicePriceType] = useState<PriceType>("starting");
  const [editingServiceIsActive, setEditingServiceIsActive] = useState(true);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoFeedback, setBasicInfoFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const [openSection, setOpenSection] = useState<"shop" | "closures" | "services" | null>(null);

  const notificationSettings = useMemo(
    () => ({
      enabled: data.shop.notification_settings.enabled,
      revisit_enabled: data.shop.notification_settings.revisit_enabled,
      booking_confirmed_enabled: data.shop.notification_settings.booking_confirmed_enabled,
      booking_rejected_enabled: data.shop.notification_settings.booking_rejected_enabled,
      booking_cancelled_enabled: data.shop.notification_settings.booking_cancelled_enabled,
      booking_rescheduled_enabled: data.shop.notification_settings.booking_rescheduled_enabled,
      grooming_almost_done_enabled: data.shop.notification_settings.grooming_almost_done_enabled,
      grooming_completed_enabled: data.shop.notification_settings.grooming_completed_enabled,
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
  const filteredAddressSuggestions = useMemo(() => {
    const query = addressSearchQuery.trim().toLowerCase();
    const candidates = Array.from(new Set([address, ...addressSuggestions].filter(Boolean)));
    if (!query) return candidates.slice(0, 8);
    return candidates.filter((item) => item.toLowerCase().includes(query)).slice(0, 8);
  }, [address, addressSearchQuery]);

  const closedDateMonthCells = useMemo(() => {
    const monthStart = `${closedDateMonthCursor}-01`;
    const startDate = new Date(`${monthStart}T00:00:00`);
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
    setEditingServiceDuration(String(service.duration_minutes));
    setEditingServicePriceType(service.price_type ?? "starting");
    setEditingServiceIsActive(service.is_active);
  }

  function stopEditingService() {
    setEditingServiceId(null);
    setEditingServiceName("");
    setEditingServicePrice("");
    setEditingServiceDuration("");
    setEditingServicePriceType("starting");
    setEditingServiceIsActive(true);
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

      const combinedAddress = detailAddress.trim() ? `${address} ${detailAddress.trim()}`.trim() : address;

      await Promise.all([
        Promise.resolve(
          onSave({
            shopId: data.shop.id,
            name,
            phone,
            address: combinedAddress,
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
      setBasicInfoFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "매장 기본 정보를 저장하지 못했어요.",
      });
    } finally {
      setSavingBasicInfo(false);
    }
  }

  async function handleServiceSave(service: Service) {
    await Promise.resolve(
      onSaveService({
        shopId: data.shop.id,
        serviceId: service.id,
        name: editingServiceName,
        price: Number(editingServicePrice),
        priceType: editingServicePriceType,
        durationMinutes: Number(editingServiceDuration),
        isActive: editingServiceIsActive,
      }),
    );
    stopEditingService();
  }

  async function handleServiceCreate() {
    await Promise.resolve(
      onSaveService({
        shopId: data.shop.id,
        name: newService.name,
        price: Number(newService.price),
        priceType: newService.priceType,
        durationMinutes: Number(newService.duration),
        isActive: newService.isActive,
      }),
    );
    setNewService({ name: "", price: "", duration: "60", priceType: "starting", isActive: true });
  }

  return (
    <section className="space-y-3.5 p-4">
      <SettingsCard title="매장 기본 정보" open={openSection === "shop"} onToggle={() => setOpenSection((prev) => (prev === "shop" ? null : "shop"))}>
        <div className="space-y-2">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="매장명">
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="업체 연락처">
              <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </div>
          <Field label="한줄 소개">
            <textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="고객에게 보여줄 매장 소개를 간단히 적어보세요." />
          </Field>
          <Field label="주소">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAddressSearchQuery(address);
                  setIsAddressSearchOpen(true);
                }}
                className="field flex min-h-[52px] w-full items-center justify-between text-left"
              >
                <span className={address ? "text-[var(--text)]" : "text-[var(--muted)]"}>
                  {address || "주소를 검색해서 선택해 주세요"}
                </span>
                <span className="text-sm font-semibold text-[var(--accent)]">주소 검색</span>
              </button>
              <input
                className="field"
                value={detailAddress}
                onChange={(event) => setDetailAddress(event.target.value)}
                placeholder="상세 주소를 입력해 주세요"
              />
            </div>
          </Field>
          <Field label="주차 안내">
            <div className="space-y-2">
              <ToggleRow label="주차 안내 노출" checked={showParkingNotice} onChange={setShowParkingNotice} />
              <textarea className="field min-h-20" value={parkingNotice} onChange={(event) => setParkingNotice(event.target.value)} placeholder="예: 건물 뒤편 공용 주차장을 이용해 주세요." />
            </div>
          </Field>
          <Field label="예약 전 안내">
            <div className="space-y-2">
              <p className="text-sm text-[var(--muted)]">예약 전 고객에게 전할 내용을 편하게 적어둘 수 있어요.</p>
              <ToggleRow label="고객에게 미리 보여주기" checked={showNotices} onChange={setShowNotices} />
              <div className="space-y-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <input className="field" value={notices[0] || ""} onChange={(event) => updateNotice(0, event.target.value)} placeholder="예: 첫 방문은 상담 포함으로 여유 있게 예약해 주세요." />
                <input className="field" value={notices[1] || ""} onChange={(event) => updateNotice(1, event.target.value)} placeholder="예: 휴무, 준비사항, 참고 안내를 편하게 남겨보세요." />
                <input className="field" value={notices[2] || ""} onChange={(event) => updateNotice(2, event.target.value)} placeholder="예: 고객에게 미리 보여줄 안내를 간단히 적어주세요." />
              </div>
            </div>
          </Field>
          {basicInfoFeedback.type !== "idle" ? (
            <div
              className={`rounded-[16px] px-4 py-2.5 text-sm ${
                basicInfoFeedback.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {basicInfoFeedback.message}
            </div>
          ) : null}
          <SolidButton onClick={saveBasicInfo} disabled={savingBasicInfo}>
            {savingBasicInfo ? "저장 중..." : "매장정보 저장"}
          </SolidButton>
        </div>
      </SettingsCard>

      <SettingsCard title="운영시간 안내" open={openSection === "closures"} onToggle={() => setOpenSection((prev) => (prev === "closures" ? null : "closures"))}>
        <Field label="정기 휴무" labelClassName="mb-2 block text-sm font-semibold text-[var(--text)]">
          <div className="grid grid-cols-4 gap-2">
            {weekdayLabels.map((label, index) => {
              const active = regularClosedDays.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setRegularClosedDays((prev) =>
                      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index].sort((a, b) => a - b),
                    )
                  }
                  className={`rounded-[14px] border px-3 py-3 text-sm font-semibold ${
                    active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="휴무 안내 멘트" labelClassName="mb-2 block text-sm font-semibold text-[var(--text)]">
          <textarea className="field min-h-20" value={holidayNotice} onChange={(event) => setHolidayNotice(event.target.value)} placeholder="매주 일요일은 쉽니다. 더 꼼꼼한 관리로 다시 뵐게요." />
        </Field>
        <Field label="특정 휴무일" labelClassName="mb-2 block text-sm font-semibold text-[var(--text)]">
          <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded-[14px] border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--text)]"
                onClick={() => setIsClosedDatePickerOpen(true)}
              >
                <span>{pendingClosedDate || "날짜 선택"}</span>
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
                    {date} 삭제
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">등록된 휴무일이 없어요.</p>
            )}
          </div>
        </Field>
      </SettingsCard>

      <SettingsCard title="서비스 관리" open={openSection === "services"} onToggle={() => setOpenSection((prev) => (prev === "services" ? null : "services"))}>
        <div className="space-y-2.5">
          {data.services.map((service) => {
            const isEditing = editingServiceId === service.id;
            return (
              <div key={service.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[var(--muted)]">서비스 이름</p>
                      <input className="field" value={editingServiceName} onChange={(event) => setEditingServiceName(event.target.value)} placeholder="서비스 이름 입력" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[var(--muted)]">가격</p>
                      <div className="flex items-center gap-2">
                        <input className="field flex-1" value={editingServicePrice} onChange={(event) => setEditingServicePrice(event.target.value)} placeholder="최소 가격 입력" />
                        <span className="text-sm font-semibold text-[var(--muted)]">원</span>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <input type="checkbox" checked={editingServicePriceType === "starting"} onChange={(event) => setEditingServicePriceType(event.target.checked ? "starting" : "fixed")} />
                        <span>시작가로 표시하기</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input type="checkbox" checked={editingServiceIsActive} onChange={(event) => setEditingServiceIsActive(event.target.checked)} />
                      <span>소비자 화면에 노출</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <OutlineButton onClick={stopEditingService}>취소</OutlineButton>
                      <SolidButton onClick={() => handleServiceSave(service)} disabled={!editingServiceName || !editingServicePrice}>
                        저장
                      </SolidButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-[var(--text)]">{service.name}</p>
                          {!service.is_active ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">비노출</span> : null}
                        </div>
                      </div>
                      <button className="shrink-0 text-sm font-semibold text-[var(--accent)]" onClick={() => startEditingService(service)}>
                        수정
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">가격 {formatServicePrice(service.price, service.price_type ?? "starting")}</p>
                  </>
                )}
              </div>
            );
          })}

          <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[#fcfaf7] p-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--muted)]">서비스 이름</p>
                <input className="field" placeholder="서비스 이름 입력" value={newService.name} onChange={(event) => setNewService((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--muted)]">가격</p>
                <div className="flex items-center gap-2">
                  <input className="field flex-1" placeholder="최소 가격 입력" value={newService.price} onChange={(event) => setNewService((prev) => ({ ...prev, price: event.target.value }))} />
                  <span className="text-sm font-semibold text-[var(--muted)]">원</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input type="checkbox" checked={newService.priceType === "starting"} onChange={(event) => setNewService((prev) => ({ ...prev, priceType: event.target.checked ? "starting" : "fixed" }))} />
                  <span>시작가로 표시하기</span>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input type="checkbox" checked={newService.isActive} onChange={(event) => setNewService((prev) => ({ ...prev, isActive: event.target.checked }))} />
                <span>소비자 화면에 노출</span>
              </label>
              <button className="w-full rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-3 py-[11px] text-sm font-semibold text-white" onClick={() => void handleServiceCreate()}>
                서비스 추가
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>

      {subscriptionSummary ? (
        <SettingsCard title="구독 관리">
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-[var(--text)]">현재 이용 또는 선택 플랜: {subscriptionSummary.currentPlan.name} {formatServicePrice(subscriptionSummary.currentPlan.price, "fixed")}</p>
            <p className="text-sm text-[var(--muted)]">무료체험 종료일 {subscriptionSummary.trialEndsAt.slice(0, 10).replace(/-/g, ".")}. 무료체험 종료 후에는 자동결제되지 않으며, 결제 전까지 사용이 제한됩니다. 유료 플랜은 선결제 상품이며, 중도 해지 시 환불금이 재산정될 수 있습니다.</p>
            <a href="/owner/billing" className="inline-flex w-full items-center justify-center rounded-[14px] border border-[var(--accent)] bg-white px-4 py-3 text-sm font-semibold text-[var(--accent)]">구독 관리 열기</a>
          </div>
        </SettingsCard>
      ) : null}

      {onLogout ? (
        <SettingsCard title="계정">
          <div className="space-y-2">
            {userEmail ? <p className="text-sm text-[var(--muted)]">{userEmail}</p> : null}
            <OutlineButton onClick={onLogout} disabled={loggingOut}>
              {loggingOut ? "로그아웃 중..." : "로그아웃"}
            </OutlineButton>
          </div>
        </SettingsCard>
      ) : null}

      {isClosedDatePickerOpen ? (
        <ClosedDatePickerSheet
          monthLabel={closedDateMonthLabel}
          monthCursor={closedDateMonthCursor}
          selectedDate={pendingClosedDate}
          cells={closedDateMonthCells}
          onClose={() => setIsClosedDatePickerOpen(false)}
          onPrevMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, -1))}
          onNextMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, 1))}
          onSelectDate={setPendingClosedDate}
        />
      ) : null}

      {isAddressSearchOpen ? (
        <AddressSearchSheet
          query={addressSearchQuery}
          suggestions={filteredAddressSuggestions}
          onClose={() => setIsAddressSearchOpen(false)}
          onChangeQuery={setAddressSearchQuery}
          onSelectAddress={(nextAddress) => {
            setAddress(nextAddress);
            setIsAddressSearchOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function AddressSearchSheet({
  query,
  suggestions,
  onClose,
  onChangeQuery,
  onSelectAddress,
}: {
  query: string;
  suggestions: string[];
  onClose: () => void;
  onChangeQuery: (value: string) => void;
  onSelectAddress: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">주소 검색</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">기본 주소를 찾고, 상세 주소만 아래에서 입력해 주세요.</p>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="space-y-3">
          <input
            className="field"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder="도로명, 건물명, 지역명으로 검색"
          />
          <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3">
            {suggestions.length ? (
              suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSelectAddress(item)}
                  className="w-full rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-left text-sm font-medium text-[var(--text)]"
                >
                  {item}
                </button>
              ))
            ) : (
              <div className="rounded-[14px] border border-dashed border-[var(--border)] bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">
                검색 결과가 없어요. 지역명이나 도로명으로 다시 찾아보세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
            <h3 className="text-base font-semibold text-[var(--text)]">특정 휴무일 추가</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">휴무로 둘 날짜를 선택해 주세요.</p>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--text)]">{monthLabel}</p>
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-[var(--muted)]">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((date, index) => {
              if (!date) return <div key={`${monthCursor}-${index}`} className="h-11" />;
              const active = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={`h-11 rounded-[16px] text-sm font-semibold transition ${
                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--text)]"
                  }`}
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

function SettingsCard({ title, children, open = true, onToggle }: { title: string; children: ReactNode; open?: boolean; onToggle?: () => void }) {
  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      {onToggle ? (
        <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h2>
          <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition ${open ? "rotate-180" : "rotate-0"}`} />
        </button>
      ) : (
        <div className="mb-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h2>
        </div>
      )}
      {open ? <div className="space-y-2 pt-2">{children}</div> : null}
    </section>
  );
}

function Field({ label, children, labelClassName }: { label: string; children: ReactNode; labelClassName?: string }) {
  return (
    <label className="block text-sm font-semibold text-[var(--text)]">
      <span className={labelClassName ?? "mb-1 block text-xs text-[var(--muted)]"}>{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

function SolidButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void | Promise<void> }) {
  return (
    <button disabled={disabled} onClick={() => void onClick()} className="flex h-[43px] w-full items-center justify-center rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] disabled:opacity-50">
      {children}
    </button>
  );
}

function OutlineButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex h-[43px] w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:opacity-50">
      {children}
    </button>
  );
}



