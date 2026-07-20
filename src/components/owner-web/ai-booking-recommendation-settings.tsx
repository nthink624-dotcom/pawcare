"use client";

import { Check, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { cn } from "@/lib/utils";
import type { AiBookingRecommendationMode, Shop } from "@/types/domain";

const options: Array<{ value: AiBookingRecommendationMode; label: string; description: string }> = [
  { value: "continuity", label: "예약 붙여 받기", description: "기존 예약 전후의 빈 시간을 줄여요." },
  { value: "staff_balance", label: "직원 예약량 균형", description: "예약량이 적은 직원의 가능 시간을 우선해요." },
  { value: "customer_convenience", label: "고객 편한 시간", description: "낮 시간과 이른 선택지를 우선해요." },
  { value: "custom", label: "직접 설정", description: "매장에 맞는 추천 원칙을 골라요." },
];

const customRuleOptions = [
  { id: "minimize_gaps", label: "빈 시간 최소화", exclusiveGroup: null },
  { id: "prefer_morning", label: "오전 우선", exclusiveGroup: "preferred_period" },
  { id: "prefer_afternoon", label: "오후 우선", exclusiveGroup: "preferred_period" },
  { id: "avoid_late", label: "마감 직전 제외", exclusiveGroup: null },
] as const;

type CustomRuleId = (typeof customRuleOptions)[number]["id"];

const customRuleLinePrefix = "선택 기준: ";
const customNoteLinePrefix = "추가 요청: ";

function parseCustomInstruction(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return { ruleIds: ["minimize_gaps"] as CustomRuleId[], note: "" };
  }

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ruleLine = lines.find((line) => line.startsWith(customRuleLinePrefix));
  const noteLine = lines.find((line) => line.startsWith(customNoteLinePrefix));
  if (!ruleLine && !noteLine) {
    return { ruleIds: ["minimize_gaps"] as CustomRuleId[], note: normalized };
  }

  const labels = new Set(
    (ruleLine?.slice(customRuleLinePrefix.length) ?? "")
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean),
  );
  const ruleIds = customRuleOptions.filter((option) => labels.has(option.label)).map((option) => option.id);
  return {
    ruleIds: ruleIds.length > 0 ? ruleIds : (["minimize_gaps"] as CustomRuleId[]),
    note: noteLine?.slice(customNoteLinePrefix.length).trim() ?? "",
  };
}

function buildCustomInstruction(ruleIds: CustomRuleId[], note: string) {
  const selectedLabels = customRuleOptions
    .filter((option) => ruleIds.includes(option.id))
    .map((option) => option.label);
  const lines = selectedLabels.length > 0 ? [`${customRuleLinePrefix}${selectedLabels.join(", ")}`] : [];
  if (note.trim()) lines.push(`${customNoteLinePrefix}${note.trim()}`);
  return lines.join("\n").slice(0, 240);
}

function buildSettingsPayload(shop: Shop, reservationPolicySettings: Shop["reservation_policy_settings"]) {
  return {
    shopId: shop.id,
    name: shop.name,
    phone: shop.phone,
    address: shop.address,
    description: shop.description,
    concurrentCapacity: shop.concurrent_capacity,
    bookingSlotIntervalMinutes: shop.booking_slot_interval_minutes,
    bookingSlotOffsetMinutes: shop.booking_slot_offset_minutes,
    bookingAvailableStartTime: shop.booking_available_start_time,
    bookingAvailableEndTime: shop.booking_available_end_time,
    approvalMode: shop.approval_mode,
    regularClosedDays: shop.regular_closed_days,
    regularClosedCycle: shop.regular_closed_cycle ?? "weekly",
    regularClosedAnchorDate: shop.regular_closed_anchor_date ?? null,
    temporaryClosedDates: shop.temporary_closed_dates,
    businessHours: shop.business_hours,
    reservationPolicySettings,
    notificationSettings: {
      enabled: shop.notification_settings.enabled,
      alimtalkSenderMode: shop.notification_settings.alimtalk_sender_mode,
      alimtalkShopChannelStatus: shop.notification_settings.alimtalk_shop_channel_status,
      alimtalkShopChannelName: shop.notification_settings.alimtalk_shop_channel_name ?? "",
      alimtalkShopChannelUrl: shop.notification_settings.alimtalk_shop_channel_url ?? "",
      alimtalkSenderProfileKey: shop.notification_settings.alimtalk_sender_profile_key ?? "",
      alimtalkChannelRequestedAt: shop.notification_settings.alimtalk_channel_requested_at ?? null,
      alimtalkChannelAdminNote: shop.notification_settings.alimtalk_channel_admin_note ?? "",
      alimtalkBusinessChannelVerified: shop.notification_settings.alimtalk_business_channel_verified ?? false,
      alimtalkTemplateRequestNote: shop.notification_settings.alimtalk_template_request_note ?? "",
      alimtalkTemplateRequestUpdatedAt: shop.notification_settings.alimtalk_template_request_updated_at ?? null,
      revisitEnabled: shop.notification_settings.revisit_enabled,
      bookingConfirmedEnabled: shop.notification_settings.booking_confirmed_enabled,
      bookingRejectedEnabled: shop.notification_settings.booking_rejected_enabled,
      bookingCancelledEnabled: shop.notification_settings.booking_cancelled_enabled,
      bookingRescheduledEnabled: shop.notification_settings.booking_rescheduled_enabled,
      appointmentReminder10mEnabled: shop.notification_settings.appointment_reminder_10m_enabled,
      appointmentReminder10mMode: shop.notification_settings.appointment_reminder_10m_mode,
      visitReminderOffsetMinutes: shop.notification_settings.visit_reminder_offset_minutes,
      groomingStartedEnabled: shop.notification_settings.grooming_started_enabled,
      groomingAlmostDoneEnabled: shop.notification_settings.grooming_almost_done_enabled,
      pickupReadyEtaMinutes: shop.notification_settings.pickup_ready_eta_minutes,
      groomingCompletedEnabled: shop.notification_settings.grooming_completed_enabled,
      groomingStartWithoutPhotoEnabled: shop.notification_settings.grooming_start_without_photo_enabled,
      groomingCompleteWithoutPhotoEnabled: shop.notification_settings.grooming_complete_without_photo_enabled,
    },
  };
}

export default function AiBookingRecommendationSettings({
  shop,
  onShopChange,
  persistToSupabase = false,
  compact = false,
}: {
  shop?: Shop;
  onShopChange?: (shop: Shop) => void;
  persistToSupabase?: boolean;
  compact?: boolean;
}) {
  const normalizedPolicy = normalizeReservationPolicySettings(shop?.reservation_policy_settings);
  const initialCustomSettings = parseCustomInstruction(normalizedPolicy.ai_booking_custom_instruction ?? "");
  const [mode, setMode] = useState<AiBookingRecommendationMode>(normalizedPolicy.ai_booking_recommendation_mode ?? "continuity");
  const [instruction, setInstruction] = useState(normalizedPolicy.ai_booking_custom_instruction ?? "");
  const [customRuleIds, setCustomRuleIds] = useState<CustomRuleId[]>(initialCustomSettings.ruleIds);
  const [customNote, setCustomNote] = useState(initialCustomSettings.note);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const nextInstruction = normalizedPolicy.ai_booking_custom_instruction ?? "";
    const nextCustomSettings = parseCustomInstruction(nextInstruction);
    setMode(normalizedPolicy.ai_booking_recommendation_mode ?? "continuity");
    setInstruction(nextInstruction);
    setCustomRuleIds(nextCustomSettings.ruleIds);
    setCustomNote(nextCustomSettings.note);
  }, [shop?.id, normalizedPolicy.ai_booking_recommendation_mode, normalizedPolicy.ai_booking_custom_instruction]);

  function toggleCustomRule(ruleId: CustomRuleId) {
    const target = customRuleOptions.find((option) => option.id === ruleId);
    setCustomRuleIds((current) => {
      if (current.includes(ruleId)) {
        return current.filter((id) => id !== ruleId);
      }

      const withoutExclusiveGroup = target?.exclusiveGroup
        ? current.filter((id) => {
            const option = customRuleOptions.find((item) => item.id === id);
            return option?.exclusiveGroup !== target.exclusiveGroup;
          })
        : current;
      return [...withoutExclusiveGroup, ruleId];
    });
  }

  async function save(nextMode: AiBookingRecommendationMode, nextInstruction: string) {
    setMode(nextMode);
    setInstruction(nextInstruction);
    if (!shop) return;

    const nextShop: Shop = {
      ...shop,
      reservation_policy_settings: {
        ...normalizedPolicy,
        ai_booking_recommendation_mode: nextMode,
        ai_booking_custom_instruction: nextInstruction.trim().slice(0, 240),
      },
    };
    onShopChange?.(nextShop);
    if (!persistToSupabase || shop.id === "demo-shop" || shop.id === "owner-demo") return;

    try {
      setSaving(true);
      setSaveError("");
      const savedShop = await fetchApiJsonWithAuth<Shop>("/api/settings", {
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify(buildSettingsPayload(nextShop, nextShop.reservation_policy_settings)),
      });
      onShopChange?.(savedShop);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "AI 예약 추천 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WebSurface className={cn(compact ? "mt-3 p-3" : "mt-4 p-4")} aria-labelledby="ai-booking-recommendation-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="ai-booking-recommendation-heading" className={cn("flex items-center gap-2 font-normal text-[#334155]", compact ? "text-[15px]" : "text-[16px]")}>
            <Sparkles className="h-4 w-4 text-[#2563eb]" />
            AI 예약 추천
          </h3>
          <p className={cn("mt-1 text-[#64748b]", compact ? "text-[12px]" : "text-[13px]")}>예약 가능 시간 안에서만 추천하고, 직원 지정 예약은 바꾸지 않습니다.</p>
        </div>
        {saving ? <span className="shrink-0 text-[12px] text-[#64748b]">저장 중</span> : null}
      </div>

      <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")} role="radiogroup" aria-label="AI 예약 추천 기준">
        {options.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                void save(
                  option.value,
                  option.value === "custom"
                    ? buildCustomInstruction(customRuleIds, customNote)
                    : instruction,
                )
              }
              className={cn(
                "min-h-[72px] rounded-[8px] border px-3 py-2 text-left transition-colors",
                selected ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-[14px] font-medium">
                {option.label}
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </span>
              <span className="mt-1 block text-[12px] leading-4 text-[#64748b]">{option.description}</span>
            </button>
          );
        })}
      </div>

      {mode === "custom" ? (
        <div className="mt-3">
          <p className={cn("font-medium text-[#334155]", compact ? "text-[13px]" : "text-[14px]")}>추천 우선순위</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {customRuleOptions.map((rule) => {
              const selected = customRuleIds.includes(rule.id);
              return (
                <button
                  key={rule.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCustomRule(rule.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-[7px] border px-3 text-[14px] transition-colors",
                    selected
                      ? "border-[#9db7ad] bg-[#eef6f3] text-[#245f51]"
                      : "border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  {rule.label}
                </button>
              );
            })}
          </div>
          <label className={cn("mt-3 block font-medium text-[#334155]", compact ? "text-[13px]" : "text-[14px]")} htmlFor="ai-booking-custom-instruction">
            추가 요청 <span className="font-normal text-[#94a3b8]">(선택)</span>
          </label>
          <input
            id="ai-booking-custom-instruction"
            value={customNote}
            maxLength={120}
            onChange={(event) => setCustomNote(event.target.value)}
            placeholder="예: 토요일은 오후 시간을 먼저 보여주세요"
            className={cn("mt-1.5 h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[#111827] outline-none focus:border-[#2563eb]", compact ? "text-[13px]" : "text-[14px]")}
          />
          <p className="mt-1.5 text-[12px] leading-5 text-[#64748b]">
            실제 예약 가능한 시간 안에서 추천 순서만 조정합니다.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void save("custom", buildCustomInstruction(customRuleIds, customNote))}
              className={cn("inline-flex items-center gap-1.5 rounded-[8px] bg-[#2f7866] font-medium text-white hover:bg-[#286b5b]", compact ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-[14px]")}
            >
              <Save className="h-4 w-4" />
              저장
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? <p className="mt-2 text-[12px] text-[#a04455]">{saveError}</p> : null}
    </WebSurface>
  );
}
