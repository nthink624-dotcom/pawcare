"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SettingsTabKey } from "@/components/owner-web/owner-web-data";
import OperatingHoursSettings from "@/components/owner-web/operating-hours-settings";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import ShopInfoSettingsPanel from "@/components/owner-web/settings-shop-info-panel";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { cn } from "@/lib/utils";
import type { ApprovalMode, ReservationPolicySettings, Shop } from "@/types/domain";

type SettingControl = "text" | "address" | "select" | "toggle" | "readonly" | "stepper" | "businessHours" | "closedDays";

type SettingRow = {
  id: string;
  label: string;
  value: string | boolean | number;
  description?: string;
  control: SettingControl;
  options?: string[];
  suffix?: string;
};

type SettingsTab = {
  key: SettingsTabKey;
  label: string;
  title: string;
  description: string;
  rows: SettingRow[];
};

type ShopProfilePatch = Pick<Shop, "name" | "phone" | "address" | "description"> & {
  businessCategory: string;
  additionalContact: string;
  postalCode: string;
  addressDetail: string;
};
type ShopPolicyPatch = {
  approvalMode: ApprovalMode;
  cancelWindow: ReservationPolicySettings["cancel_window"];
};

function approvalModeLabel(value: ApprovalMode | null | undefined) {
  return value === "auto" ? "바로 승인" : "직접 승인";
}

function approvalModeFromLabel(value: string): ApprovalMode {
  return value === "바로 승인" ? "auto" : "manual";
}

function cancelWindowLabel(value: ReservationPolicySettings["cancel_window"] | string | null | undefined) {
  switch (value) {
    case "none":
      return "불가";
    case "1h":
      return "예약 1시간 전까지";
    case "6h":
      return "예약 6시간 전까지";
    case "24h":
      return "예약 1일 전까지";
    case "2h":
    default:
      return "예약 2시간 전까지";
  }
}

function cancelWindowFromLabel(value: string): ReservationPolicySettings["cancel_window"] {
  if (value === "불가") return "none";
  if (value === "예약 1시간 전까지") return "1h";
  if (value === "예약 6시간 전까지") return "6h";
  if (value === "예약 하루 전까지" || value === "예약 1일 전까지") return "24h";
  return "2h";
}

const settingsTabs: Array<{ key: SettingsTabKey; label: string }> = [
  { key: "shop", label: "매장 정보" },
  { key: "hours", label: "운영 시간" },
  { key: "alerts", label: "알림 설정" },
  { key: "billing", label: "결제 설정" },
];

const initialSettings: Record<SettingsTabKey, SettingsTab> = {
  shop: {
    key: "shop",
    label: "매장 정보",
    title: "매장 정보",
    description: "고객에게 보여지는 매장 기본 정보와 예약 정책을 관리하세요.",
    rows: [
      {
        id: "shopName",
        label: "매장명",
        value: "매장명",
        description: "고객 예약 화면과 결제 화면에 노출되는 대표 이름",
        control: "text",
      },
      {
        id: "description",
        label: "매장 소개",
        value: "",
        description: "고객 예약 화면에 보여지는 짧은 소개",
        control: "text",
      },
      {
        id: "businessCategory",
        label: "업종",
        value: "애견미용",
        description: "고객에게 표시되는 매장 업종",
        control: "select",
        options: ["애견미용"],
      },
      {
        id: "phone",
        label: "대표 연락처",
        value: "010-0000-0000",
        description: "고객 문의와 예약 확인에 사용하는 번호",
        control: "text",
      },
      {
        id: "additionalContact",
        label: "추가 연락처",
        value: "",
        description: "선택 입력",
        control: "text",
      },
      {
        id: "postalCode",
        label: "우편번호",
        value: "",
        description: "주소 검색으로 선택한 우편번호",
        control: "text",
      },
      {
        id: "address",
        label: "주소",
        value: "",
        description: "카카오 주소 검색으로 선택한 주소와 상세 주소를 합친 최종 노출 주소",
        control: "address",
      },
      {
        id: "addressDetail",
        label: "상세주소",
        value: "",
        description: "건물, 층, 호수 등 상세 위치",
        control: "text",
      },
      {
        id: "slotPolicy",
        label: "동일 시간 예약 규칙",
        value: "바로 승인 1건 / 직접 승인 대기 1건",
        description: "확정 예약은 같은 시간에 1건만 가능하고, 직접 승인 모드에서는 승인 대기로 접수됩니다.",
        control: "readonly",
      },
      {
        id: "approvalMode",
        label: "승인 방식",
        value: "직접 승인",
        description: "예약 요청 후 오너가 직접 확정하는 운영 방식",
        control: "select",
        options: ["직접 승인", "바로 승인"],
      },
      {
        id: "cancelWindow",
        label: "취소 허용 시간",
        value: "예약 2시간 전까지",
        description: "고객이 직접 변경/취소할 수 있는 범위",
        control: "select",
        options: ["예약 2시간 전까지", "예약 6시간 전까지", "예약 1일 전까지", "불가"],
      },
    ],
  },
  hours: {
    key: "hours",
    label: "운영 시간",
    title: "운영 시간",
    description: "예약 가능 시간과 휴무일 기준을 관리합니다.",
    rows: [
      {
        id: "businessHours",
        label: "전체 시간 설정",
        value: "10:00 - 19:00",
        description: "매장 기본 운영 시간을 오너가 직접 선택",
        control: "businessHours",
      },
      {
        id: "closedDay",
        label: "정기 휴무일",
        value: "일",
        description: "휴무일은 예약 가능한 날짜에서 자동 제외",
        control: "closedDays",
      },
    ],
  },
  alerts: {
    key: "alerts",
    label: "알림 설정",
    title: "알림 설정",
    description: "고객과 오너에게 발송되는 자동 안내 조건을 관리합니다.",
    rows: [
      {
        id: "alimtalkEnabled",
        label: "알림톡 전체 사용",
        value: true,
        description: "예약 확정, 취소, 픽업 준비, 완료 알림을 묶어서 관리",
        control: "toggle",
      },
      {
        id: "revisitEnabled",
        label: "재방문 안내",
        value: true,
        description: "주기 기준으로 고객에게 재방문 알림 발송",
        control: "toggle",
      },
      {
        id: "ownerAlertChannel",
        label: "운영자 알림",
        value: "카카오 채널 + 앱",
        description: "예약 요청과 변경 사항을 오너에게 즉시 전달",
        control: "select",
        options: ["앱만", "카카오 채널", "카카오 채널 + 앱"],
      },
    ],
  },
  billing: {
    key: "billing",
    label: "결제 설정",
    title: "결제 설정",
    description: "요금제, 정기 결제 수단, 환불 정책을 확인합니다.",
    rows: [
      {
        id: "plan",
        label: "현재 플랜",
        value: "스탠다드",
        description: "월 29,000원 / 직원 2~5명 / 알림톡 1,500건 포함",
        control: "readonly",
      },
      {
        id: "card",
        label: "정기 결제 수단",
        value: "신한카드 **** 1024",
        description: "등록된 카드 변경과 삭제를 확인",
        control: "select",
        options: ["신한카드 **** 1024", "카드 다시 등록"],
      },
      {
        id: "refundPolicy",
        label: "환불/취소 정책",
        value: "관리자 승인 필요",
        description: "운영자 확인 후 수동 취소가 가능한 구조",
        control: "select",
        options: ["관리자 승인 필요", "자동 처리 안 함"],
      },
    ],
  },
};

function cloneSettings(settings: Record<SettingsTabKey, SettingsTab>) {
  return Object.fromEntries(
    Object.entries(settings).map(([key, tab]) => [
      key,
      {
        ...tab,
        rows: tab.rows.map((row) => ({ ...row, options: row.options ? [...row.options] : undefined })),
      },
    ]),
  ) as Record<SettingsTabKey, SettingsTab>;
}

function applyShopToSettings(settings: Record<SettingsTabKey, SettingsTab>, shop?: Shop) {
  if (!shop) return settings;

  return {
    ...settings,
    shop: {
      ...settings.shop,
      rows: settings.shop.rows.map((row) => {
        if (row.id === "shopName") return { ...row, value: shop.name };
        if (row.id === "description") return { ...row, value: shop.description ?? "" };
        if (row.id === "businessCategory") return { ...row, value: shop.customer_page_settings.business_category || "애견미용" };
        if (row.id === "phone") return { ...row, value: shop.phone };
        if (row.id === "additionalContact") return { ...row, value: shop.customer_page_settings.additional_contact || "" };
        if (row.id === "postalCode") return { ...row, value: shop.customer_page_settings.postal_code || "" };
        if (row.id === "address") return { ...row, value: shop.address };
        if (row.id === "addressDetail") return { ...row, value: shop.customer_page_settings.address_detail || "" };
        if (row.id === "approvalMode") return { ...row, value: approvalModeLabel(shop.approval_mode) };
        if (row.id === "cancelWindow") {
          return { ...row, value: cancelWindowLabel(shop.reservation_policy_settings?.cancel_window) };
        }
        return row;
      }),
    },
  };
}

const ownerWebSettingsStorageKey = "petmanager.ownerWeb.settings";
const ownerWebShopProfileImageStorageKey = "petmanager.ownerWeb.shopProfileImage";

function mergeSettingsWithDefaults(savedSettings: unknown, shop?: Shop) {
  const nextSettings = applyShopToSettings(cloneSettings(initialSettings), shop);

  if (!savedSettings || typeof savedSettings !== "object") return nextSettings;

  for (const [tabKey, savedTab] of Object.entries(savedSettings)) {
    if (shop && tabKey === "shop") continue;
    if (!(tabKey in nextSettings) || !savedTab || typeof savedTab !== "object") continue;
    const rows = (savedTab as { rows?: unknown }).rows;
    if (!Array.isArray(rows)) continue;

    nextSettings[tabKey as SettingsTabKey] = {
      ...nextSettings[tabKey as SettingsTabKey],
      rows: nextSettings[tabKey as SettingsTabKey].rows.map((row) => {
        const savedRow = rows.find(
          (item): item is { id: string; value: SettingRow["value"] } =>
            Boolean(item) &&
            typeof item === "object" &&
            "id" in item &&
            (item as { id: unknown }).id === row.id &&
            "value" in item,
        );

        if (!savedRow) return row;
        const valueType = typeof savedRow.value;
        if (valueType !== "string" && valueType !== "boolean" && valueType !== "number") return row;
        return { ...row, value: savedRow.value };
      }),
    };
  }

  return nextSettings;
}

function readShopProfileFromSettings(settings: Record<SettingsTabKey, SettingsTab>): ShopProfilePatch {
  const rows = settings.shop.rows;
  return {
    name: String(rows.find((row) => row.id === "shopName")?.value ?? "").trim(),
    phone: String(rows.find((row) => row.id === "phone")?.value ?? "").trim(),
    address: String(rows.find((row) => row.id === "address")?.value ?? "").trim(),
    description: String(rows.find((row) => row.id === "description")?.value ?? "").trim(),
    businessCategory: String(rows.find((row) => row.id === "businessCategory")?.value ?? "").trim(),
    additionalContact: String(rows.find((row) => row.id === "additionalContact")?.value ?? "").trim(),
    postalCode: String(rows.find((row) => row.id === "postalCode")?.value ?? "").trim(),
    addressDetail: String(rows.find((row) => row.id === "addressDetail")?.value ?? "").trim(),
  };
}

function readShopPolicyFromSettings(settings: Record<SettingsTabKey, SettingsTab>): ShopPolicyPatch {
  const rows = settings.shop.rows;
  return {
    approvalMode: approvalModeFromLabel(String(rows.find((row) => row.id === "approvalMode")?.value ?? "")),
    cancelWindow: cancelWindowFromLabel(String(rows.find((row) => row.id === "cancelWindow")?.value ?? "")),
  };
}

function focusEditableControl(rowId: string) {
  const element = document.getElementById(`setting-control-${rowId}`) as HTMLElement | null;
  element?.focus();
}

const weekdayClosedOptions = ["월", "화", "수", "목", "금", "토", "일"] as const;

function parseBusinessHoursValue(value: SettingRow["value"]) {
  const text = String(value);
  const [open = "10:00", close = "19:00"] = text.split("-").map((item) => item.trim());
  return { open, close };
}

function parseClosedDayValue(value: SettingRow["value"]) {
  const text = String(value).trim();
  if (!text || text === "없음") return [];
  return text
    .replaceAll("매주", "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is (typeof weekdayClosedOptions)[number] =>
      weekdayClosedOptions.includes(item as (typeof weekdayClosedOptions)[number]),
    );
}

function formatClosedDayValue(days: string[]) {
  return days.length > 0 ? days.join(", ") : "없음";
}

function SettingSelectControl({
  row,
  onChange,
}: {
  row: SettingRow;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const value = String(row.value);
  const options = row.options ?? [];

  return (
    <div
      className="relative inline-block min-w-[210px] text-left"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setOpen(false);
        }
      }}
    >
      <button
        id={`setting-control-${row.id}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-[10px] border bg-white px-3 text-[14px] font-medium text-[#111827] outline-none transition",
          open ? "border-[#1f6b5b] shadow-[0_0_0_3px_rgba(31,107,91,0.08)]" : "border-[#dbe2ea] hover:border-[#bfd3cb]",
        )}
      >
        <span className="min-w-0 truncate text-left">{value}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180 text-[#1f6b5b]")} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-max min-w-full overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
        >
          {options.map((option) => {
            const selected = option === value;
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
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-4 rounded-[8px] px-3 text-left text-[14px] transition",
                  selected ? "bg-[#edf7f3] font-semibold text-[#1f6b5b]" : "text-[#334155] hover:bg-[#f8fafc]",
                )}
              >
                <span className="whitespace-nowrap">{option}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SettingValueControl({
  row,
  onChange,
  onCommit,
  onOpenAddressSearch,
}: {
  row: SettingRow;
  onChange: (value: SettingRow["value"]) => void;
  onCommit?: (value: SettingRow["value"]) => void;
  onOpenAddressSearch: () => void;
}) {
  if (row.control === "toggle") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(!row.value);
        }}
        className={cn(
          "relative inline-flex h-8 w-[58px] shrink-0 items-center rounded-full transition",
          row.value ? "bg-[#1f6b5b]" : "bg-[#dbe2ea]",
        )}
        aria-pressed={Boolean(row.value)}
      >
        <span
          className={cn(
            "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
            row.value ? "left-7" : "left-1",
          )}
        />
      </button>
    );
  }

  if (row.control === "address") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenAddressSearch();
        }}
        className="flex min-h-10 w-full min-w-[360px] max-w-[620px] items-center justify-end gap-3 rounded-[8px] border border-transparent bg-transparent px-3 py-2 text-right text-[15px] font-medium text-[#111827] transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#1f6b5b] focus:bg-white focus:outline-none"
      >
        <span className="line-clamp-2 min-w-0 break-words">{String(row.value) || "주소 검색으로 매장 주소를 선택해 주세요"}</span>
        <span className="shrink-0 text-[13px] font-semibold text-[#1f6b5b]">주소 검색</span>
      </button>
    );
  }

  if (row.control === "businessHours") {
    const { open, close } = parseBusinessHoursValue(row.value);
    const updateTime = (next: { open?: string; close?: string }) => {
      onChange(`${next.open ?? open} - ${next.close ?? close}`);
    };

    return (
      <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <label className="min-w-[132px]">
          <span className="mb-1 block text-left text-[12px] font-medium text-[#64748b]">시작</span>
          <input
            id={`setting-control-${row.id}`}
            type="time"
            value={open}
            onChange={(event) => updateTime({ open: event.target.value })}
            className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#1f6b5b]/10"
          />
        </label>
        <label className="min-w-[132px]">
          <span className="mb-1 block text-left text-[12px] font-medium text-[#64748b]">종료</span>
          <input
            type="time"
            value={close}
            onChange={(event) => updateTime({ close: event.target.value })}
            className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#1f6b5b]/10"
          />
        </label>
      </div>
    );
  }

  if (row.control === "closedDays") {
    const closedDays = parseClosedDayValue(row.value);
    return (
      <div className="flex max-w-[420px] flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        {weekdayClosedOptions.map((day) => {
          const active = closedDays.includes(day);
          return (
            <button
              key={day}
              id={day === "월" ? `setting-control-${row.id}` : undefined}
              type="button"
              onClick={() => {
                const nextDays = active ? closedDays.filter((item) => item !== day) : [...closedDays, day];
                onChange(formatClosedDayValue(weekdayClosedOptions.filter((item) => nextDays.includes(item))));
              }}
              className={cn(
                "inline-flex h-10 min-w-12 items-center justify-center rounded-[8px] border px-3 text-[14px] font-medium transition",
                active
                  ? "border-[#a04455] bg-[#fff7f8] text-[#8f2438]"
                  : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    );
  }

  if (row.control === "select") {
    return <SettingSelectControl row={row} onChange={(value) => onChange(value)} />;
  }

  if (row.control === "stepper") {
    const value = Number(row.value);
    return (
      <div className="inline-flex h-10 items-center rounded-[8px] border border-[#dbe2ea] bg-white" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-full w-9 text-[18px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
        >
          -
        </button>
        <span className="min-w-[62px] px-2 text-center text-[14px] font-semibold text-[#111827]">
          {value}
          {row.suffix}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-full w-9 text-[18px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
        >
          +
        </button>
      </div>
    );
  }

  if (row.control === "text") {
    return (
      <input
        id={`setting-control-${row.id}`}
        value={String(row.value)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit?.(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="h-10 w-full min-w-[280px] max-w-[520px] rounded-[8px] border border-transparent bg-transparent px-3 text-right text-[15px] font-medium text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#1f6b5b] focus:bg-white"
      />
    );
  }

  return <p className="text-[15px] font-medium text-[#111827]">{String(row.value)}</p>;
}

export default function SettingsManagementScreen({
  activeTab: controlledActiveTab,
  onActiveTabChange,
  showTabNavigation = true,
  shop,
  onShopChange,
  persistShopProfile = true,
  manualApprovalEnabled,
  onManualApprovalChange,
}: {
  activeTab?: SettingsTabKey;
  onActiveTabChange?: (tab: SettingsTabKey) => void;
  showTabNavigation?: boolean;
  shop?: Shop;
  onShopChange?: (shop: Shop) => void;
  persistShopProfile?: boolean;
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
}) {
  const [internalActiveTab, setInternalActiveTab] = useState<SettingsTabKey>("shop");
  const [draftSettings, setDraftSettings] = useState(() => applyShopToSettings(cloneSettings(initialSettings), shop));
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [shopProfileImage, setShopProfileImage] = useState("");
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const shopSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(ownerWebSettingsStorageKey);
      const storedProfileImage = window.localStorage.getItem(ownerWebShopProfileImageStorageKey);
      const frame = window.requestAnimationFrame(() => {
        if (storedSettings) {
          const nextSettings = mergeSettingsWithDefaults(JSON.parse(storedSettings), shop);
          setDraftSettings(cloneSettings(nextSettings));
        }

        if (storedProfileImage) {
          setShopProfileImage(storedProfileImage);
        }
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(ownerWebSettingsStorageKey);
      window.localStorage.removeItem(ownerWebShopProfileImageStorageKey);
    }
  }, [shop]);

  useEffect(() => {
    return () => {
      if (shopSaveTimerRef.current) {
        clearTimeout(shopSaveTimerRef.current);
      }
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const approvalModeValue = manualApprovalEnabled === false ? "바로 승인" : "직접 승인";
  const current = useMemo(() => {
    const tab = draftSettings[activeTab];
    if (activeTab !== "shop" || manualApprovalEnabled === undefined) return tab;
    return {
      ...tab,
      rows: tab.rows.map((row) => (row.id === "approvalMode" ? { ...row, value: approvalModeValue } : row)),
    };
  }, [activeTab, approvalModeValue, draftSettings, manualApprovalEnabled]);

  function showSavedToast() {
    setSaveToastVisible(true);
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
    }
    saveToastTimerRef.current = setTimeout(() => {
      setSaveToastVisible(false);
      saveToastTimerRef.current = null;
    }, 1800);
  }

  function saveShopSettings(
    settings: Record<SettingsTabKey, SettingsTab>,
    options: { profile?: boolean; policy?: boolean },
    immediate = false,
  ) {
    if (!shop) return;

    const profilePatch = options.profile ? readShopProfileFromSettings(settings) : {};
    const policyPatch = options.policy ? readShopPolicyFromSettings(settings) : null;
    const profileName = "name" in profilePatch && typeof profilePatch.name === "string" ? profilePatch.name : "";
    const businessCategory =
      "businessCategory" in profilePatch && typeof profilePatch.businessCategory === "string" ? profilePatch.businessCategory : "";
    const additionalContact =
      "additionalContact" in profilePatch && typeof profilePatch.additionalContact === "string" ? profilePatch.additionalContact : "";
    const postalCode = "postalCode" in profilePatch && typeof profilePatch.postalCode === "string" ? profilePatch.postalCode : "";
    const addressDetail =
      "addressDetail" in profilePatch && typeof profilePatch.addressDetail === "string" ? profilePatch.addressDetail : "";
    const optimisticShop: Shop = {
      ...shop,
      ...profilePatch,
      ...(policyPatch
        ? {
            approval_mode: policyPatch.approvalMode,
            concurrent_capacity: concurrentCapacityForApprovalMode(policyPatch.approvalMode),
            reservation_policy_settings: {
              ...shop.reservation_policy_settings,
              cancel_window: policyPatch.cancelWindow,
              customer_change_enabled: policyPatch.cancelWindow !== "none",
            },
          }
        : {}),
      customer_page_settings: {
        ...shop.customer_page_settings,
        shop_name: profileName || shop.customer_page_settings.shop_name,
        business_category: businessCategory || shop.customer_page_settings.business_category,
        additional_contact: additionalContact,
        postal_code: postalCode,
        address_detail: addressDetail,
      },
    };
    onShopChange?.(optimisticShop);

    if (!persistShopProfile) {
      showSavedToast();
      return;
    }

    if (shopSaveTimerRef.current) {
      clearTimeout(shopSaveTimerRef.current);
    }

    const persist = async () => {
      try {
        const result = await fetchApiJsonWithAuth<{
          shop: Pick<
            Shop,
            | "id"
            | "name"
            | "phone"
            | "address"
            | "description"
            | "approval_mode"
            | "concurrent_capacity"
            | "reservation_policy_settings"
            | "customer_page_settings"
          >;
        }>(
          "/api/owner/shops",
          {
            method: "PATCH",
            body: JSON.stringify({
              shopId: shop.id,
              ...profilePatch,
              ...(policyPatch ?? {}),
            }),
          },
        );
        onShopChange?.({ ...optimisticShop, ...result.shop });
        showSavedToast();
      } catch (error) {
        console.error("[OWNER SETTINGS] failed to save shop profile", error);
      }
    };

    if (immediate) {
      void persist();
      return;
    }

    shopSaveTimerRef.current = setTimeout(() => {
      shopSaveTimerRef.current = null;
      void persist();
    }, 400);
  }

  function updateRow(rowId: string, value: SettingRow["value"], saveImmediately = false) {
    if (rowId === "approvalMode" && typeof value === "string") {
      onManualApprovalChange?.(value !== "바로 승인");
    }
    setDraftSettings((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        [activeTab]: {
          ...currentSettings[activeTab],
          rows: currentSettings[activeTab].rows.map((row) => (row.id === rowId ? { ...row, value } : row)),
        },
      };
      persistSettings(nextSettings);
      if (
        activeTab === "shop" &&
        ["shopName", "description", "businessCategory", "phone", "additionalContact", "postalCode", "address", "addressDetail"].includes(rowId)
      ) {
        if (saveImmediately) {
          saveShopSettings(nextSettings, { profile: true }, true);
        }
      }
      if (activeTab === "shop" && ["approvalMode", "cancelWindow"].includes(rowId)) {
        saveShopSettings(nextSettings, { policy: true }, true);
      }
      return nextSettings;
    });
  }

  function updateShopAddress(address: string) {
    setDraftSettings((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        shop: {
          ...currentSettings.shop,
          rows: currentSettings.shop.rows.map((row) => (row.id === "address" ? { ...row, value: address } : row)),
        },
      };
      persistSettings(nextSettings);
      saveShopSettings(nextSettings, { profile: true }, true);
      return nextSettings;
    });
  }

  function handleRowClick(row: SettingRow) {
    if (row.control === "address") {
      setAddressSheetOpen(true);
      return;
    }
    if (row.control === "toggle") {
      updateRow(row.id, !row.value);
      return;
    }
    if (row.control === "text" || row.control === "select" || row.control === "businessHours" || row.control === "closedDays") {
      focusEditableControl(row.id);
    }
  }

  function persistSettings(nextSettings: Record<SettingsTabKey, SettingsTab>, nextShopProfileImage = shopProfileImage) {
    const settingsToStore = cloneSettings(nextSettings);
    try {
      window.localStorage.setItem(ownerWebSettingsStorageKey, JSON.stringify(settingsToStore));
      if (nextShopProfileImage) {
        window.localStorage.setItem(ownerWebShopProfileImageStorageKey, nextShopProfileImage);
      } else {
        window.localStorage.removeItem(ownerWebShopProfileImageStorageKey);
      }
    } catch {
      // Local preview storage can fail in private modes; keep the in-session state saved.
    }
  }

  function changeActiveTab(tab: SettingsTabKey) {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  }

  const addressValue = String(draftSettings.shop.rows.find((row) => row.id === "address")?.value ?? "");
  const businessHoursRow = current.rows.find((row) => row.id === "businessHours");
  const closedDayRow = current.rows.find((row) => row.id === "closedDay");

  function updateShopProfileImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const nextImage = typeof reader.result === "string" ? reader.result : "";
      setShopProfileImage(nextImage);
      persistSettings(draftSettings, nextImage);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div
        aria-live="polite"
        className={cn(
          "fixed right-5 top-[64px] z-50 flex items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[13px] font-semibold text-[#17211f] shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition-all duration-200",
          saveToastVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e6f3ef] text-[#2f7866]">
          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        저장되었습니다
      </div>

      <div className={cn("grid gap-6", showTabNavigation && "xl:grid-cols-[316px_minmax(0,1fr)]")}>
        {showTabNavigation ? (
          <WebSurface className="p-3">
            <div className="space-y-1.5">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => changeActiveTab(tab.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left transition",
                    activeTab === tab.key ? "bg-[#f1f7f4] text-[#2f7866]" : "text-[#5f5851] hover:bg-[#fbfaf8]",
                  )}
                >
                  <span className="text-[15px] font-medium">{tab.label}</span>
                  <span className="text-[12px]">{activeTab === tab.key ? "선택됨" : ""}</span>
                </button>
              ))}
            </div>
          </WebSurface>
        ) : null}

        <div className="min-w-0 space-y-4">
          <div>
            {activeTab === "alerts" ? (
              <div className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-[#f8fbfa] px-4 py-3">
                <p className="text-[13px] leading-5 text-[#5f6c66]">
                  알림톡은 펫매니저 공통 발신 프로필로 발송됩니다. 메시지 본문에는 매장명이 표시됩니다.
                </p>
              </div>
            ) : null}
          </div>

          {activeTab === "hours" && businessHoursRow && closedDayRow ? (
            <OperatingHoursSettings
              businessHoursValue={businessHoursRow.value}
              closedDaysValue={closedDayRow.value}
              onBusinessHoursChange={(value) => updateRow("businessHours", value)}
              onClosedDaysChange={(value) => updateRow("closedDay", value)}
              shop={shop}
              onShopChange={onShopChange}
              persistToSupabase={persistShopProfile}
            />
          ) : activeTab === "shop" ? (
            <ShopInfoSettingsPanel
              rows={current.rows}
              shopProfileImage={shopProfileImage}
              onProfileImageChange={updateShopProfileImage}
              onRowChange={(rowId, value) => updateRow(rowId, value)}
              onRowCommit={(rowId, value) => updateRow(rowId, value, true)}
              onOpenAddressSearch={() => setAddressSheetOpen(true)}
            />
          ) : (
            <WebSurface className="p-6">
              <div className="divide-y divide-[#f1e8e0]">
                {current.rows.map((row) => (
                  <div
                    key={row.id}
                    role={row.control === "readonly" || row.control === "stepper" ? undefined : "button"}
                    tabIndex={row.control === "readonly" || row.control === "stepper" ? undefined : 0}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowClick(row);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between gap-6 py-4 transition",
                      row.control !== "readonly" && "cursor-pointer hover:bg-[#fbfaf8]",
                    )}
                  >
                    <div className="min-w-0 px-1">
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <SettingValueControl
                        row={row}
                        onChange={(value) => updateRow(row.id, value)}
                        onCommit={(value) => updateRow(row.id, value, true)}
                        onOpenAddressSearch={() => setAddressSheetOpen(true)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </WebSurface>
          )}
        </div>
      </div>

      {addressSheetOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명이나 건물명으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={addressValue}
          onClose={() => setAddressSheetOpen(false)}
          onSelect={(selection) => {
            updateShopAddress(selection.address);
            setAddressSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
