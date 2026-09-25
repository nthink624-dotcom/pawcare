export type StaffChipTone = {
  border: string;
  background: string;
  selectedBackground: string;
  text: string;
  mutedText: string;
  badgeBackground: string;
  badgeText: string;
};

type ScheduleStaffIdentityTone = {
  color: string;
  background: string;
  border: string;
  text: string;
};

export const staffChipPalette = [
  {
    label: "브라이트 버건디",
    border: "#EAC7D0",
    background: "#FBECEF",
    selectedBackground: "#AE3D57",
    text: "#72273C",
    mutedText: "#72273C",
    badgeBackground: "#FBECEF",
    badgeText: "#72273C",
  },
  {
    label: "선셋 테라코타",
    border: "#EBCDBB",
    background: "#FDF0E8",
    selectedBackground: "#D86B3D",
    text: "#83431F",
    mutedText: "#83431F",
    badgeBackground: "#FDF0E8",
    badgeText: "#83431F",
  },
  {
    label: "선샤인 옐로",
    border: "#EADF9C",
    background: "#FFFBE3",
    selectedBackground: "#E4B92E",
    text: "#716014",
    mutedText: "#716014",
    badgeBackground: "#FFFBE3",
    badgeText: "#716014",
  },
  {
    label: "클리어 에메랄드",
    border: "#C1DFCE",
    background: "#EAF6EF",
    selectedBackground: "#258F60",
    text: "#245E42",
    mutedText: "#245E42",
    badgeBackground: "#EAF6EF",
    badgeText: "#245E42",
  },
  {
    label: "클리어 블루",
    border: "#C1DCEE",
    background: "#EAF4FC",
    selectedBackground: "#2686C7",
    text: "#225D87",
    mutedText: "#225D87",
    badgeBackground: "#EAF4FC",
    badgeText: "#225D87",
  },
  {
    label: "딥 네이비",
    border: "#CCD3E4",
    background: "#EDF0F7",
    selectedBackground: "#334574",
    text: "#2D3A59",
    mutedText: "#2D3A59",
    badgeBackground: "#EDF0F7",
    badgeText: "#2D3A59",
  },
  {
    label: "딥 로열 퍼플",
    border: "#D4C3E6",
    background: "#F0EAF7",
    selectedBackground: "#5B2B8A",
    text: "#45206B",
    mutedText: "#45206B",
    badgeBackground: "#F0EAF7",
    badgeText: "#45206B",
  },
  {
    label: "체스트넛 브라운",
    border: "#DDCBBD",
    background: "#F5EDE7",
    selectedBackground: "#7A4F36",
    text: "#603F2D",
    mutedText: "#603F2D",
    badgeBackground: "#F5EDE7",
    badgeText: "#603F2D",
  },
  {
    label: "피콕 청록",
    border: "#B9DFE3",
    background: "#E6F6F7",
    selectedBackground: "#008E9A",
    text: "#21626B",
    mutedText: "#21626B",
    badgeBackground: "#E6F6F7",
    badgeText: "#21626B",
  },
  {
    label: "샌드 베이지",
    border: "#E2D6C3",
    background: "#F7F2E9",
    selectedBackground: "#B89460",
    text: "#716047",
    mutedText: "#716047",
    badgeBackground: "#F7F2E9",
    badgeText: "#716047",
  },
] satisfies readonly (StaffChipTone & { label: string })[];

export const staffChipColorIndexMax = staffChipPalette.length - 1;

function hashStaffKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function normalizeStaffChipColorIndex(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > staffChipColorIndexMax
  ) return null;
  return value;
}

export function getStaffChipColorIndex(staffKey: string | null | undefined, paletteIndex?: number | null) {
  const normalizedPaletteIndex = normalizeStaffChipColorIndex(paletteIndex);
  if (normalizedPaletteIndex !== null) return normalizedPaletteIndex;
  return staffKey ? hashStaffKey(staffKey) % staffChipPalette.length : 0;
}

export function findAvailableStaffChipColorIndex(
  staffKey: string | null | undefined,
  occupiedColorIndices: Iterable<number | null | undefined>,
) {
  const occupied = new Set(
    Array.from(occupiedColorIndices)
      .map(normalizeStaffChipColorIndex)
      .filter((index): index is number => index !== null),
  );
  const preferredIndex = getStaffChipColorIndex(staffKey, null);
  for (let offset = 0; offset < staffChipPalette.length; offset += 1) {
    const candidateIndex = (preferredIndex + offset) % staffChipPalette.length;
    if (!occupied.has(candidateIndex)) return candidateIndex;
  }
  return null;
}

export function getStaffChipTone(staffKey: string | null | undefined, paletteIndex?: number | null) {
  if (!staffKey) {
    return {
      border: "#e1e1dd",
      background: "#f7f7f4",
      selectedBackground: "#6f747a",
      text: "#30312f",
      mutedText: "#6f747a",
      badgeBackground: "#f1f0ec",
      badgeText: "#6f747a",
    } satisfies StaffChipTone;
  }

  return staffChipPalette[getStaffChipColorIndex(staffKey, paletteIndex)]!;
}

export function getScheduleStaffIdentityTone(staffKey: string | null | undefined, paletteIndex?: number | null) {
  const persistedChipTone = getStaffChipTone(staffKey, paletteIndex);

  return {
    color: persistedChipTone.selectedBackground,
    background: persistedChipTone.background,
    border: persistedChipTone.border,
    text: persistedChipTone.text,
  } satisfies ScheduleStaffIdentityTone;
}
