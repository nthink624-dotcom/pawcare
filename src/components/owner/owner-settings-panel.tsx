"use client";

import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CreditCard, KeyRound, LogOut, Mail, MapPin, Scissors, Store, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { addDate, currentDateInTimeZone, decodeUnicodeEscapes, formatServicePrice, won } from "@/lib/utils";
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
  initialScreen?: SettingsScreen;
  onActiveScreenChange?: (screen: SettingsScreen) => void;
};

type SaveFeedback = {
  type: "idle" | "success" | "error";
  message: string;
};

type SettingsScreen = "subscription" | "shop" | "closures" | "services" | "account" | null;

type PriceType = "fixed" | "starting";
type ShopNotificationSettingsState = {
  enabled: boolean;
  revisitEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  bookingRejectedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingRescheduledEnabled: boolean;
  groomingAlmostDoneEnabled: boolean;
  groomingCompletedEnabled: boolean;
};
const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

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
  initialScreen = null,
  onActiveScreenChange,
}: SettingsPanelProps) {
  const [name, setName] = useState(decodeUnicodeEscapes(data.shop.name));
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(decodeUnicodeEscapes(data.shop.address));
  const [detailAddress, setDetailAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
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
  const [heroImageUrl, setHeroImageUrl] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.hero_image_url ?? ""));
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const [isNewServiceFormOpen, setIsNewServiceFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServicePrice, setEditingServicePrice] = useState("");
  const [editingServiceDuration, setEditingServiceDuration] = useState("");
  const [editingServicePriceType, setEditingServicePriceType] = useState<PriceType>("starting");
  const [editingServiceIsActive, setEditingServiceIsActive] = useState(true);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoFeedback, setBasicInfoFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const [activeScreen, setActiveScreen] = useState<SettingsScreen>(null);
  const [notificationSettings, setNotificationSettings] = useState<ShopNotificationSettingsState>({
    enabled: data.shop.notification_settings.enabled,
    revisitEnabled: data.shop.notification_settings.revisit_enabled,
    bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
    bookingRejectedEnabled: data.shop.notification_settings.booking_rejected_enabled,
    bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
    bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
    groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
    groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
  });

  useEffect(() => {
    setActiveScreen(initialScreen ?? null);
  }, [initialScreen]);

  useEffect(() => {
    onActiveScreenChange?.(activeScreen);
  }, [activeScreen, onActiveScreenChange]);

  useEffect(() => {
    setNotificationSettings({
      enabled: data.shop.notification_settings.enabled,
      revisitEnabled: data.shop.notification_settings.revisit_enabled,
      bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
      bookingRejectedEnabled: data.shop.notification_settings.booking_rejected_enabled,
      bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
      bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
      groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
      groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
    });
  }, [data.shop.notification_settings]);

  const businessHours = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data.shop.business_hours).map(([key, value]) => [key, value || { open: "10:00", close: "19:00", enabled: false }]),
      ),
    [data.shop.business_hours],
  );

  const closedDateMonthLabel = `${Number(closedDateMonthCursor.slice(0, 4))}년 ${Number(closedDateMonthCursor.slice(5, 7))}월`;
  const subscriptionEndDate = useMemo(() => {
    if (!subscriptionSummary) return "-";

    const serviceEndsAt = subscriptionSummary.currentPeriodEndsAt ?? subscriptionSummary.trialEndsAt;
    return serviceEndsAt ? serviceEndsAt.slice(0, 10).replace(/-/g, ".") : "-";
  }, [subscriptionSummary]);

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

  function handleProfileImageChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHeroImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
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
          hero_image_url: heroImageUrl.trim(),
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
    setIsNewServiceFormOpen(false);
  }

  const subscriptionSection = subscriptionSummary ? (
    <section className="space-y-4">
      {(() => {
        const currentPlan = subscriptionSummary.currentPlan;
        const isTrialStatus =
          subscriptionSummary.status === "trialing" || subscriptionSummary.status === "trial_will_end";
        const showTrialCard =
          isTrialStatus &&
          !subscriptionSummary.currentPeriodEndsAt &&
          subscriptionSummary.lastPaymentStatus === "none";
        const isFreePlan = currentPlan.code === "free";
        const currentPlanTitle = isFreePlan || showTrialCard
          ? "체험 플랜"
          : currentPlan.months === 1
            ? "한 달 플랜"
            : currentPlan.months === 3
              ? "세 달 플랜"
              : currentPlan.months === 6
                ? "여섯 달 플랜"
                : "일 년 플랜";
        const currentPlanLine = isFreePlan || showTrialCard
          ? "카드 등록 없이 이용 중"
          : currentPlan.billingType === "one_time"
            ? "일반결제"
            : `${currentPlan.months}개월 동안 매월 ${won(currentPlan.monthlyPrice)} 결제`;
        const currentPlanPriceLabel = isFreePlan || showTrialCard ? "무료" : `월 ${won(currentPlan.monthlyPrice)}`;
        const currentPlanSubLabel = isFreePlan
          ? "관리자 설정"
          : showTrialCard
            ? "체험 플랜"
          : currentPlan.billingType === "one_time"
            ? "1회 결제"
            : currentPlan.totalLabel;
        const endDateLabel = "서비스 종료일";
        const isInService =
          subscriptionSummary.status === "active" ||
          subscriptionSummary.status === "trialing" ||
          subscriptionSummary.status === "trial_will_end";
        const planCtaLabel = isInService ? "플랜 보기" : "업그레이드 플랜";

        return (
      <div className="overflow-hidden rounded-[10px] border border-[#d9d4cb] bg-white shadow-[0_6px_16px_rgba(21,22,19,0.04)]">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#8a8277]">현재 플랜</p>
              <p className="mt-2 text-[25px] font-extrabold leading-none tracking-[-0.05em] text-[#171411]">
                {currentPlanTitle}
              </p>
              <p className="mt-2 text-[12px] font-medium leading-[1.45] text-[#6f675d]">{currentPlanLine}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[24px] font-extrabold leading-none tracking-[-0.04em] text-[#171411]">{currentPlanPriceLabel}</p>
              <p className="mt-2 text-[11px] font-medium text-[#8a8277]">
                {currentPlanSubLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-[#ebe5dc] pt-3.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-[#8a8277]">{endDateLabel}</p>
                <p className="mt-1 text-[18px] font-bold tracking-[-0.03em] text-[#171411]">{subscriptionEndDate}</p>
              </div>
              <a
                href={`/owner/billing?compare=1&plan=${currentPlan.code}`}
                className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] text-white transition hover:bg-[#195748]"
              >
                {planCtaLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
        );
      })()}
    </section>
  ) : null;

  const shopSection = (
    <SettingsCard>
      <div className="space-y-1">
        <SettingsFieldCard label="매장 대표 이미지">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => profileImageInputRef.current?.click()}
                className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-[#dfeae5] bg-white shadow-[0_2px_8px_rgba(31,107,91,0.05)]"
                aria-label="매장 대표 이미지 변경"
              >
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt={`${name || data.shop.name} 대표 이미지`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#f4f5f4] text-[#9ea4a1]">
                    <UserRound className="h-8 w-8" strokeWidth={1.8} />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => profileImageInputRef.current?.click()}
                className="absolute bottom-0 right-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[var(--accent)] text-white shadow-[0_6px_14px_rgba(31,107,91,0.18)]"
                aria-label="대표 이미지 선택"
              >
                <Camera className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleProfileImageChange(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{name || data.shop.name}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                저장하면 매장 전환 카드와 고객 예약 화면 대표 이미지에도 같이 반영돼요.
              </p>
            </div>
          </div>
        </SettingsFieldCard>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <SettingsFieldCard label="매장명">
            <input
              className="w-full bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="매장명을 입력해 주세요"
            />
          </SettingsFieldCard>
          <SettingsFieldCard label="업체 연락처">
            <input
              className="w-full bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="연락처를 입력해 주세요"
            />
          </SettingsFieldCard>
        </div>

        <SettingsFieldCard label="한줄 소개">
          <textarea
            className="min-h-[88px] w-full resize-none bg-transparent p-0 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="고객에게 보여줄 매장 소개를 간단히 적어보세요."
          />
        </SettingsFieldCard>

        <SettingsFieldCard label="주소">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsAddressSearchOpen(true)}
              className="flex w-full items-start gap-3 text-left"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4f5f4] text-[#7d847f]">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`break-words text-[14px] leading-5 ${address ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"}`}>
                  {address
                    ? detailAddress.trim()
                      ? `${address}, ${detailAddress.trim()}`
                      : address
                    : "주소를 검색해서 선택해 주세요"}
                </p>
              </div>
              <span className="shrink-0 pt-0.5 text-[13px] font-medium text-[var(--accent)]">주소 검색</span>
            </button>
            <div className="border-t border-[var(--border)] pt-2">
              <input
                className="w-full bg-transparent p-0 text-[14px] leading-5 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={detailAddress}
                onChange={(event) => setDetailAddress(event.target.value)}
                placeholder="건물명, 층수, 호수 등 상세 주소를 입력해 주세요"
              />
            </div>
          </div>
        </SettingsFieldCard>

        <SettingsFieldCard label="주차 안내" className="px-0 pb-0 pt-2">
          <div className="px-3.5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">주차 안내 설정</p>
                <p className="mt-1 text-[12px] leading-5 text-[#938a80]">
                  {parkingNotice.trim() || "건물 뒤편 공용 주차장을 이용해 주세요."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowParkingNotice(!showParkingNotice)}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${showParkingNotice ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${showParkingNotice ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </div>
          <div className="border-t border-[var(--border)] px-3.5 py-3">
            <textarea
              className="min-h-[58px] w-full resize-none bg-transparent p-0 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={parkingNotice}
              onChange={(event) => setParkingNotice(event.target.value)}
              placeholder="예: 건물 뒤편 공용 주차장을 이용해 주세요."
            />
          </div>
        </SettingsFieldCard>

        <SettingsFieldCard label="예약 전 안내" className="px-0 pb-0 pt-2">
          <div className="px-3.5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">예약 전 안내 설정</p>
                <p className="mt-1 text-[13px] leading-5 text-[#938a80]">고객에게 미리 보여주기</p>
                <p className="mt-1 text-[12px] leading-5 text-[#938a80]">
                  {[notices[0], notices[1], notices[2]].find((item) => item.trim()) || "첫 방문은 상담 포함으로 여유 있게 예약해 주세요."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotices(!showNotices)}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${showNotices ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${showNotices ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </div>
          <div className="border-t border-[var(--border)] px-3.5 py-2.5">
            <div className="space-y-0">
              <input
                className="w-full bg-transparent py-2 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={notices[0] || ""}
                onChange={(event) => updateNotice(0, event.target.value)}
                placeholder="예: 첫 방문은 상담 포함으로 여유 있게 예약해 주세요."
              />
              <div className="border-t border-[#eee7de]" />
              <input
                className="w-full bg-transparent py-2 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={notices[1] || ""}
                onChange={(event) => updateNotice(1, event.target.value)}
                placeholder="예: 휴무, 준비사항, 참고 안내를 편하게 남겨보세요."
              />
              <div className="border-t border-[#eee7de]" />
              <input
                className="w-full bg-transparent py-2 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                value={notices[2] || ""}
                onChange={(event) => updateNotice(2, event.target.value)}
                placeholder="예: 고객에게 미리 보여줄 안내를 간단히 적어주세요."
              />
            </div>
          </div>
        </SettingsFieldCard>

        <SettingsFieldCard label="알림톡 발송">
          <div className="space-y-2.5">
            <ToggleRow
              label="알림톡 전체 사용"
              checked={notificationSettings.enabled}
              onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, enabled: checked }))}
            />
            <p className="text-[12px] leading-5 text-[var(--muted)]">
              예약 확정, 취소, 픽업 준비 같은 자동 알림을 여기서 켜고 끌 수 있어요.
            </p>
            <div className="space-y-2">
              <ToggleRow
                label="예약 확정 안내"
                checked={notificationSettings.bookingConfirmedEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, bookingConfirmedEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="예약 거절 안내"
                checked={notificationSettings.bookingRejectedEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, bookingRejectedEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="예약 취소 안내"
                checked={notificationSettings.bookingCancelledEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, bookingCancelledEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="예약 변경 안내"
                checked={notificationSettings.bookingRescheduledEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, bookingRescheduledEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="픽업 준비 안내"
                checked={notificationSettings.groomingAlmostDoneEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, groomingAlmostDoneEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="미용 완료 안내"
                checked={notificationSettings.groomingCompletedEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, groomingCompletedEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
              <ToggleRow
                label="재방문 안내 기본값"
                checked={notificationSettings.revisitEnabled}
                onChange={(checked) => setNotificationSettings((prev) => ({ ...prev, revisitEnabled: checked }))}
                disabled={!notificationSettings.enabled}
              />
            </div>
          </div>
        </SettingsFieldCard>
      </div>
    </SettingsCard>
  );

  const closuresSection = (
    <SettingsCard>
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
                className={`rounded-[10px] border px-3 py-3 text-sm font-semibold ${
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
        <div className="space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-between rounded-[10px] border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--text)]"
              onClick={() => setIsClosedDatePickerOpen(true)}
            >
              <span>{pendingClosedDate || "날짜 선택"}</span>
              <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
            </button>
            <button
              type="button"
              className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
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
  );

  const servicesSection = (
    <SettingsCard>
      <div className="space-y-1">
        {data.services.map((service) => {
          const isEditing = editingServiceId === service.id;
          return (
            <div key={service.id}>
              {isEditing ? (
                <div className="space-y-2.5">
                  <SettingsFieldCard label="서비스 이름">
                    <input
                      className="w-full bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                      value={editingServiceName}
                      onChange={(event) => setEditingServiceName(event.target.value)}
                      placeholder="서비스 이름 입력"
                    />
                  </SettingsFieldCard>
                  <SettingsFieldCard label="가격">
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                        value={editingServicePrice}
                        onChange={(event) => setEditingServicePrice(event.target.value)}
                        placeholder="최소 가격 입력"
                      />
                      <span className="shrink-0 text-[14px] font-medium tracking-[-0.01em] text-[var(--muted)]">원</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input type="checkbox" checked={editingServicePriceType === "starting"} onChange={(event) => setEditingServicePriceType(event.target.checked ? "starting" : "fixed")} />
                      <span>시작가로 표시하기</span>
                    </label>
                  </SettingsFieldCard>
                  <SettingsFieldCard label="노출 설정" className="pb-3 pt-2.5">
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium tracking-[-0.01em] text-[var(--text)]">소비자 화면에 노출</span>
                      <input type="checkbox" checked={editingServiceIsActive} onChange={(event) => setEditingServiceIsActive(event.target.checked)} />
                    </label>
                  </SettingsFieldCard>
                  <div className="grid grid-cols-2 gap-2">
                    <OutlineButton onClick={stopEditingService}>취소</OutlineButton>
                    <SolidButton onClick={() => handleServiceSave(service)} disabled={!editingServiceName || !editingServicePrice}>
                      저장
                    </SolidButton>
                  </div>
                </div>
              ) : (
                <SettingsFieldCard label={service.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text)]">
                        가격 {formatServicePrice(service.price, service.price_type ?? "starting")}
                      </p>
                      {!service.is_active ? (
                        <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">소비자 화면에 노출되지 않아요.</p>
                      ) : null}
                    </div>
                    <button className="shrink-0 text-[13px] font-medium text-[var(--accent)]" onClick={() => startEditingService(service)}>
                      수정
                    </button>
                  </div>
                </SettingsFieldCard>
              )}
            </div>
          );
        })}

        {isNewServiceFormOpen ? (
          <div className="space-y-2.5">
              <SettingsFieldCard label="서비스 이름">
                <input
                  className="w-full bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  placeholder="서비스 이름 입력"
                  value={newService.name}
                  onChange={(event) => setNewService((prev) => ({ ...prev, name: event.target.value }))}
                />
              </SettingsFieldCard>
              <SettingsFieldCard label="가격">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 bg-transparent p-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    placeholder="최소 가격 입력"
                    value={newService.price}
                    onChange={(event) => setNewService((prev) => ({ ...prev, price: event.target.value }))}
                  />
                  <span className="shrink-0 text-[14px] font-medium tracking-[-0.01em] text-[var(--muted)]">원</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input type="checkbox" checked={newService.priceType === "starting"} onChange={(event) => setNewService((prev) => ({ ...prev, priceType: event.target.checked ? "starting" : "fixed" }))} />
                  <span>시작가로 표시하기</span>
                </label>
              </SettingsFieldCard>
              <SettingsFieldCard label="노출 설정" className="pb-3 pt-2.5">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium tracking-[-0.01em] text-[var(--text)]">소비자 화면에 노출</span>
                  <input type="checkbox" checked={newService.isActive} onChange={(event) => setNewService((prev) => ({ ...prev, isActive: event.target.checked }))} />
                </label>
              </SettingsFieldCard>
              <div className="grid grid-cols-2 gap-2">
                <OutlineButton
                  onClick={() => {
                    setIsNewServiceFormOpen(false);
                    setNewService({ name: "", price: "", duration: "60", priceType: "starting", isActive: true });
                  }}
                >
                  취소
                </OutlineButton>
                <SolidButton onClick={() => void handleServiceCreate()} disabled={!newService.name || !newService.price}>
                  추가
                </SolidButton>
              </div>
          </div>
        ) : null}

        <div className="pt-1">
          <button
            type="button"
            className="w-full rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-3 py-[11px] text-[14px] font-medium text-white"
            onClick={() => setIsNewServiceFormOpen(true)}
          >
            서비스 추가
          </button>
        </div>
      </div>
    </SettingsCard>
  );

  const accountSection = onLogout ? (
    <SettingsCard>
      <div className="divide-y divide-[var(--border)]">
        {userEmail ? <AccountRow icon={Mail} label="로그인 이메일" value={userEmail} /> : null}
        <AccountRow href="/login/reset" icon={KeyRound} label="비밀번호 재설정" />
        <AccountActionRow icon={LogOut} label={loggingOut ? "로그아웃 중..." : "로그아웃"} onClick={onLogout} disabled={loggingOut} />
      </div>
    </SettingsCard>
  ) : null;

  const screenMap: Record<Exclude<SettingsScreen, null>, { title: string; content: ReactNode }> = {
    subscription: { title: "현재 플랜", content: subscriptionSection },
    shop: { title: "매장 기본 정보", content: shopSection },
    closures: { title: "운영시간 안내", content: closuresSection },
    services: { title: "서비스 관리", content: servicesSection },
    account: { title: "계정", content: accountSection },
  };

  if (activeScreen) {
    const isShopScreen = activeScreen === "shop";

    return (
      <section className={`space-y-3.5 p-4 ${isShopScreen ? "pb-[calc(env(safe-area-inset-bottom)+96px)]" : ""}`}>
        <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          {screenMap[activeScreen].content}
        </div>

        {isShopScreen ? (
          <div className="pointer-events-none fixed bottom-[68px] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
            <div className="pointer-events-auto space-y-2 rounded-[10px] bg-[rgba(248,246,242,0.96)] px-1 pb-1 pt-2 backdrop-blur">
              {basicInfoFeedback.type !== "idle" ? (
                <div
                  className={`rounded-[10px] px-4 py-2.5 text-[13px] font-medium ${
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
          </div>
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
          <KakaoPostcodeSheet
            onClose={() => setIsAddressSearchOpen(false)}
            initialQuery={address}
            onSelect={(nextAddress) => {
              setAddress(nextAddress.address);
              setPostalCode(nextAddress.zonecode);
              setIsAddressSearchOpen(false);
            }}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="p-4">
      {subscriptionSummary ? <div className="mb-3.5">{subscriptionSection}</div> : null}

      <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)] divide-y divide-[var(--border)]">
        <SettingsNavRow
          icon={Store}
          title="매장 기본 정보"
          onClick={() => setActiveScreen("shop")}
        />
        <SettingsNavRow
          icon={CalendarDays}
          title="운영시간 안내"
          onClick={() => setActiveScreen("closures")}
        />
        <SettingsNavRow
          icon={Scissors}
          title="서비스 관리"
          onClick={() => setActiveScreen("services")}
        />
        {onLogout ? (
          <SettingsNavRow
            icon={UserRound}
            title="계정"
            onClick={() => setActiveScreen("account")}
          />
        ) : null}
      </div>

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
        <KakaoPostcodeSheet
          onClose={() => setIsAddressSearchOpen(false)}
          initialQuery={address}
          onSelect={(nextAddress) => {
            setAddress(nextAddress.address);
            setPostalCode(nextAddress.zonecode);
            setIsAddressSearchOpen(false);
          }}
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
            <h3 className="text-base font-semibold text-[var(--text)]">특정 휴무일 추가</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">휴무로 둘 날짜를 선택해 주세요.</p>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
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

function SettingsCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="px-4 py-3.5">
      {title ? (
        <div className="mb-2">
          <h2 className="text-[17px] font-medium tracking-[-0.02em] text-[var(--text)]">{title}</h2>
        </div>
      ) : null}
      <div className={`space-y-1 ${title ? "pt-2.5" : ""}`}>{children}</div>
    </section>
  );
}

function SettingsNavRow({
  icon: Icon,
  title,
  onClick,
  accent = false,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3 text-left ${
        accent ? "bg-[#f6fbf9]" : "bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center ${
          accent ? "text-[var(--accent)]" : "text-[var(--text)]"
        }`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{title}</p>
        </div>
      </div>
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${accent ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} strokeWidth={1.9} />
    </button>
  );
}

function Field({ label, children, labelClassName }: { label: string; children: ReactNode; labelClassName?: string }) {
  return (
    <label className="block text-sm font-medium text-[var(--text)]">
      <span className={labelClassName ?? "mb-1 block text-xs text-[var(--muted)]"}>{label}</span>
      {children}
    </label>
  );
}

function SettingsFieldCard({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`min-w-0 overflow-visible rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pb-2.5 pt-2 ${className}`.trim()}>
      <legend className="ml-0.5 px-1.5 text-[15px] font-medium tracking-[-0.01em] text-[var(--muted)]">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 ${
        disabled ? "opacity-55" : ""
      }`}
    >
      <p className="text-sm font-medium text-[var(--text)]">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

function SolidButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void | Promise<void> }) {
  return (
    <button disabled={disabled} onClick={() => void onClick()} className="flex h-[43px] w-full items-center justify-center rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] disabled:opacity-50">
      {children}
    </button>
  );
}

function OutlineButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex h-[43px] w-full items-center justify-center rounded-[10px] border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:opacity-50">
      {children}
    </button>
  );
}

function AccountRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-[18px] w-[18px] shrink-0 text-[var(--text)]" strokeWidth={1.9} />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-[var(--text)]">{label}</p>
          {value ? <p className="mt-0.5 truncate text-[13px] text-[var(--muted)]">{value}</p> : null}
        </div>
      </div>
      {href ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" /> : null}
    </>
  );

  const className = "flex min-h-[52px] w-full items-center justify-between gap-3 px-1 py-2.5 text-left";

  return href ? <a href={href} className={className}>{content}</a> : <div className={className}>{content}</div>;
}

function AccountActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-[#c43d3d] disabled:opacity-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
        <p className="text-[15px] font-medium">{label}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
    </button>
  );
}



