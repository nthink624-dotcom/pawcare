"use client";

import { Check, ChevronDown, ImagePlus } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { SettingsTabKey } from "@/components/owner-web/owner-web-data";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { cn } from "@/lib/utils";

type SettingControl = "text" | "address" | "select" | "toggle" | "readonly" | "stepper";

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

const settingsTabs: Array<{ key: SettingsTabKey; label: string }> = [
  { key: "shop", label: "매장 정보" },
  { key: "hours", label: "운영 시간" },
  { key: "policy", label: "예약 정책" },
  { key: "alerts", label: "알림 설정" },
  { key: "billing", label: "결제 설정" },
  { key: "users", label: "사용자 관리" },
];

const initialSettings: Record<SettingsTabKey, SettingsTab> = {
  shop: {
    key: "shop",
    label: "매장 정보",
    title: "매장 정보",
    description: "고객 예약 화면과 결제 화면에 노출되는 기본 매장 정보를 관리합니다.",
    rows: [
      {
        id: "shopName",
        label: "매장명",
        value: "우유 미용실",
        description: "고객 예약 화면과 결제 화면에 노출되는 대표 이름",
        control: "text",
      },
      {
        id: "phone",
        label: "대표 연락처",
        value: "010-8989-8498",
        description: "고객 문의와 예약 확인에 사용하는 번호",
        control: "text",
      },
      {
        id: "address",
        label: "주소",
        value: "서울특별시 동대문구 서울시립대로 26-1 (전농동), 1층",
        description: "카카오 주소 검색으로 선택한 주소와 상세 주소를 합친 최종 노출 주소",
        control: "address",
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
        description: "월요일부터 토요일까지 한 번에 적용",
        control: "select",
        options: ["09:00 - 18:00", "10:00 - 19:00", "11:00 - 20:00", "직접 설정"],
      },
      {
        id: "closedDay",
        label: "정기 휴무일",
        value: "매주 일요일",
        description: "휴무일은 예약 가능한 날짜에서 자동 제외",
        control: "select",
        options: ["없음", "매주 월요일", "매주 일요일", "직접 설정"],
      },
      {
        id: "slotInterval",
        label: "예약 가능 간격",
        value: "정각 / 30분",
        description: "고객 예약 화면 시간 슬롯 간격과 연결",
        control: "select",
        options: ["정각만", "정각 / 30분", "15분 단위"],
      },
    ],
  },
  policy: {
    key: "policy",
    label: "예약 정책",
    title: "예약 정책",
    description: "승인 방식과 취소 가능 시간을 관리합니다. 동일 시간 예약 수는 승인 방식에 따라 자동 적용됩니다.",
    rows: [
      {
        id: "slotPolicy",
        label: "동일 시간 예약 규칙",
        value: "바로 승인 1건 / 직접 승인 대기 2건",
        description: "확정 예약은 같은 시간에 1건만 가능하고, 직접 승인 모드에서는 승인 대기만 최대 2건까지 받습니다.",
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
        options: ["불가", "예약 1시간 전까지", "예약 2시간 전까지", "예약 하루 전까지"],
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
  users: {
    key: "users",
    label: "사용자 관리",
    title: "사용자 관리",
    description: "오너 계정과 직원 접근 권한을 관리합니다.",
    rows: [
      {
        id: "ownerAccount",
        label: "오너 계정",
        value: "owner@petmanager.co.kr",
        description: "매장 전체 권한 / 설정 수정 가능",
        control: "readonly",
      },
      {
        id: "staffCount",
        label: "서브 스태프",
        value: 2,
        description: "캘린더 열람, 예약 진행, 완료 처리 권한",
        control: "stepper",
        suffix: "명",
      },
      {
        id: "adminLog",
        label: "관리자 활동 기록",
        value: "최근 7일 14건",
        description: "누가 어떤 설정을 바꿨는지 확인하는 로그",
        control: "readonly",
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

const ownerWebSettingsStorageKey = "petmanager.ownerWeb.settings";
const ownerWebShopProfileImageStorageKey = "petmanager.ownerWeb.shopProfileImage";

function mergeSettingsWithDefaults(savedSettings: unknown) {
  const nextSettings = cloneSettings(initialSettings);

  if (!savedSettings || typeof savedSettings !== "object") return nextSettings;

  for (const [tabKey, savedTab] of Object.entries(savedSettings)) {
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

function focusEditableControl(rowId: string) {
  const element = document.getElementById(`setting-control-${rowId}`) as HTMLElement | null;
  element?.focus();
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
  onOpenAddressSearch,
}: {
  row: SettingRow;
  onChange: (value: SettingRow["value"]) => void;
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
        onClick={(event) => event.stopPropagation()}
        className="h-10 w-full min-w-[280px] max-w-[520px] rounded-[8px] border border-transparent bg-transparent px-3 text-right text-[15px] font-medium text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#1f6b5b] focus:bg-white"
      />
    );
  }

  return <p className="text-[15px] font-medium text-[#111827]">{String(row.value)}</p>;
}

function ShopProfileImageRow({
  previewUrl,
  onChange,
}: {
  previewUrl: string;
  onChange: (file: File) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-5 transition hover:bg-[#fbfaf8]">
      <div className="min-w-0 px-1">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">매장 프로필</p>
        <p className="mt-2 text-[13px] leading-6 text-[#81796f]">
          고객 예약 화면에 노출되는 대표 이미지
        </p>
      </div>
      <div className="shrink-0 text-right">
        <label className="relative inline-flex h-[72px] w-[72px] cursor-pointer overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white text-[#1f6b5b] transition hover:border-[#1f6b5b] hover:bg-[#f6fbf9]">
          {previewUrl ? (
            <Image src={previewUrl} alt="매장 프로필" width={72} height={72} unoptimized className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[#eef7f4]">
              <ImagePlus className="h-6 w-6" />
            </span>
          )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onChange(file);
              }}
            />
        </label>
      </div>
    </div>
  );
}

export default function SettingsManagementScreen({
  activeTab: controlledActiveTab,
  onActiveTabChange,
  showTabNavigation = true,
  manualApprovalEnabled,
  onManualApprovalChange,
}: {
  activeTab?: SettingsTabKey;
  onActiveTabChange?: (tab: SettingsTabKey) => void;
  showTabNavigation?: boolean;
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
}) {
  const [internalActiveTab, setInternalActiveTab] = useState<SettingsTabKey>("shop");
  const [draftSettings, setDraftSettings] = useState(() => cloneSettings(initialSettings));
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [shopProfileImage, setShopProfileImage] = useState("");

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(ownerWebSettingsStorageKey);
      const storedProfileImage = window.localStorage.getItem(ownerWebShopProfileImageStorageKey);
      const frame = window.requestAnimationFrame(() => {
        if (storedSettings) {
          const nextSettings = mergeSettingsWithDefaults(JSON.parse(storedSettings));
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
  }, []);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const approvalModeValue = manualApprovalEnabled === false ? "바로 승인" : "직접 승인";
  const current = useMemo(() => {
    const tab = draftSettings[activeTab];
    if (activeTab !== "policy" || manualApprovalEnabled === undefined) return tab;
    return {
      ...tab,
      rows: tab.rows.map((row) => (row.id === "approvalMode" ? { ...row, value: approvalModeValue } : row)),
    };
  }, [activeTab, approvalModeValue, draftSettings, manualApprovalEnabled]);

  function updateRow(rowId: string, value: SettingRow["value"]) {
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
    if (row.control === "text" || row.control === "select") {
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

        <WebSurface className="p-6">
          <div className="border-b border-[#f0e8e1] pb-4">
            <div>
              <h3 className="text-[18px] font-semibold text-[#17211f]">{current.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#7a7269]">{current.description}</p>
            </div>
            {activeTab === "alerts" ? (
              <div className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-[#f8fbfa] px-4 py-3">
                <p className="text-[13px] leading-5 text-[#5f6c66]">
                  알림톡은 펫매니저 공통 발신 프로필로 발송됩니다. 메시지 본문에는 매장명이 표시됩니다.
                </p>
              </div>
            ) : null}
          </div>

          <div className="divide-y divide-[#f1e8e0]">
            {activeTab === "shop" ? (
              <ShopProfileImageRow previewUrl={shopProfileImage} onChange={updateShopProfileImage} />
            ) : null}
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
                  "flex items-start justify-between gap-6 py-5 transition",
                  row.control !== "readonly" && "cursor-pointer hover:bg-[#fbfaf8]",
                )}
              >
                <div className="min-w-0 px-1">
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.label}</p>
                  {row.description ? <p className="mt-2 text-[13px] leading-6 text-[#81796f]">{row.description}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <SettingValueControl
                    row={row}
                    onChange={(value) => updateRow(row.id, value)}
                    onOpenAddressSearch={() => setAddressSheetOpen(true)}
                  />
                </div>
              </div>
            ))}
          </div>

        </WebSurface>
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
