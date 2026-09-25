import { minutesFromTime } from "@/lib/utils";
import type { AiBookingRecommendationMode } from "@/types/domain";

const maxRecommendedSlots = 4;
const minimumRecommendedSlotSeparationMinutes = 60;
const morningEndMinute = 12 * 60;
const afternoonStartMinute = 13 * 60;
const lateStartMinute = 17 * 60;

type StaffLoad = {
  staffId: string;
  bookingCount: number;
  bookedMinutes: number;
};

type EligibleStaffBySlot = {
  slot: string;
  staffIds: string[];
};

export type RuleBasedSlotRecommendationParams = {
  availableSlots: string[];
  baselineRecommendedSlots?: string[];
  recommendationMode: AiBookingRecommendationMode;
  customInstruction?: string;
  staffLoads?: StaffLoad[];
  eligibleStaffBySlot?: EligibleStaffBySlot[];
};

function normalizeSlots(slots: string[], availableSlots: string[]) {
  const availableSlotSet = new Set(availableSlots);
  return slots.filter((slot, index) => availableSlotSet.has(slot) && slots.indexOf(slot) === index);
}

export function selectDiverseRecommendedSlots(slots: string[], availableSlots: string[]) {
  const normalized = normalizeSlots(slots, availableSlots);
  const selected: string[] = [];

  for (const slot of normalized) {
    const slotMinute = minutesFromTime(slot);
    if (selected.every((selectedSlot) => Math.abs(minutesFromTime(selectedSlot) - slotMinute) >= minimumRecommendedSlotSeparationMinutes)) {
      selected.push(slot);
    }
    if (selected.length >= maxRecommendedSlots) return selected;
  }

  for (const slot of normalized) {
    if (!selected.includes(slot)) selected.push(slot);
    if (selected.length >= maxRecommendedSlots) break;
  }

  return selected;
}

function customerConvenienceScore(slot: string) {
  const minute = minutesFromTime(slot);
  const preferredDistance = Math.min(
    Math.abs(minute - 11 * 60),
    Math.abs(minute - 14 * 60 - 30),
  );
  const earlyPenalty = minute < 10 * 60 ? 180 + (10 * 60 - minute) : 0;
  const latePenalty = minute >= lateStartMinute ? 240 + (minute - lateStartMinute) * 2 : 0;
  return preferredDistance + earlyPenalty + latePenalty;
}

function getBestStaffLoadForSlot(
  slot: string,
  staffLoads: StaffLoad[],
  eligibleStaffBySlot: EligibleStaffBySlot[],
) {
  const eligibleStaffIds = eligibleStaffBySlot.find((item) => item.slot === slot)?.staffIds ?? [];
  const loadByStaffId = new Map(staffLoads.map((load) => [load.staffId, load]));
  return eligibleStaffIds
    .map((staffId) => loadByStaffId.get(staffId) ?? { staffId, bookingCount: 0, bookedMinutes: 0 })
    .sort((left, right) =>
      left.bookedMinutes - right.bookedMinutes ||
      left.bookingCount - right.bookingCount ||
      left.staffId.localeCompare(right.staffId),
    )[0] ?? { staffId: "", bookingCount: Number.MAX_SAFE_INTEGER, bookedMinutes: Number.MAX_SAFE_INTEGER };
}

function sortForCustomInstruction(slots: string[], instruction: string) {
  const normalized = instruction.toLowerCase();
  const preferMorning = normalized.includes("오전") || normalized.includes("morning");
  const preferAfternoon = normalized.includes("오후") || normalized.includes("afternoon");
  const avoidLate = normalized.includes("마감") || normalized.includes("늦") || normalized.includes("late");

  return slots.slice().sort((left, right) => {
    const leftMinute = minutesFromTime(left);
    const rightMinute = minutesFromTime(right);
    const periodPenalty = (minute: number) => {
      if (preferMorning) return minute <= morningEndMinute ? 0 : 1_000;
      if (preferAfternoon) return minute >= afternoonStartMinute ? 0 : 1_000;
      return 0;
    };
    const latePenalty = (minute: number) => avoidLate && minute >= lateStartMinute ? 2_000 : 0;
    return (
      periodPenalty(leftMinute) - periodPenalty(rightMinute) ||
      latePenalty(leftMinute) - latePenalty(rightMinute) ||
      customerConvenienceScore(left) - customerConvenienceScore(right) ||
      leftMinute - rightMinute
    );
  });
}

export function buildRuleBasedSlotRecommendations(params: RuleBasedSlotRecommendationParams) {
  const availableSlots = normalizeSlots(params.availableSlots, params.availableSlots)
    .sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
  const baseline = normalizeSlots(params.baselineRecommendedSlots ?? [], availableSlots);
  let rankedSlots: string[];

  switch (params.recommendationMode) {
    case "staff_balance": {
      const staffLoads = params.staffLoads ?? [];
      const eligibleStaffBySlot = params.eligibleStaffBySlot ?? [];
      rankedSlots = availableSlots.slice().sort((left, right) => {
        const leftLoad = getBestStaffLoadForSlot(left, staffLoads, eligibleStaffBySlot);
        const rightLoad = getBestStaffLoadForSlot(right, staffLoads, eligibleStaffBySlot);
        return (
          leftLoad.bookedMinutes - rightLoad.bookedMinutes ||
          leftLoad.bookingCount - rightLoad.bookingCount ||
          customerConvenienceScore(left) - customerConvenienceScore(right) ||
          minutesFromTime(left) - minutesFromTime(right)
        );
      });
      break;
    }
    case "customer_convenience":
      rankedSlots = availableSlots.slice().sort((left, right) =>
        customerConvenienceScore(left) - customerConvenienceScore(right) ||
        minutesFromTime(left) - minutesFromTime(right),
      );
      break;
    case "custom": {
      const instruction = params.customInstruction ?? "";
      const preferContinuity = instruction.includes("빈 시간") || instruction.toLowerCase().includes("gap");
      const customRankedSlots = sortForCustomInstruction(availableSlots, instruction);
      rankedSlots = preferContinuity ? [...baseline, ...customRankedSlots] : customRankedSlots;
      break;
    }
    case "continuity":
    default:
      rankedSlots = [
        ...baseline,
        ...availableSlots.slice().sort((left, right) =>
          customerConvenienceScore(left) - customerConvenienceScore(right) ||
          minutesFromTime(left) - minutesFromTime(right),
        ),
      ];
      break;
  }

  return selectDiverseRecommendedSlots(rankedSlots, availableSlots);
}
