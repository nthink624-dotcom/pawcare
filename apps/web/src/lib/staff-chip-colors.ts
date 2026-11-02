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
    label: "빨강",
    border: "#F59999",
    background: "#FCE5E5",
    selectedBackground: "#EF5B5B",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#FCE5E5",
    badgeText: "#1F2937",
  },
  {
    label: "주황",
    border: "#F9C08F",
    background: "#FDEFE2",
    selectedBackground: "#F59A4A",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#FDEFE2",
    badgeText: "#1F2937",
  },
  {
    label: "노랑",
    border: "#FFE667",
    background: "#FFF8D8",
    selectedBackground: "#FFD60A",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#FFF8D8",
    badgeText: "#1F2937",
  },
  {
    label: "초록",
    border: "#97CCB1",
    background: "#E4F2EB",
    selectedBackground: "#57AD81",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#E4F2EB",
    badgeText: "#1F2937",
  },
  {
    label: "블루",
    border: "#91B8F6",
    background: "#E3EDFD",
    selectedBackground: "#4D8CF1",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#E3EDFD",
    badgeText: "#1F2937",
  },
  {
    label: "슬레이트",
    border: "#AEBBCD",
    background: "#EAEEF2",
    selectedBackground: "#7D92AF",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#EAEEF2",
    badgeText: "#1F2937",
  },
  {
    label: "보라",
    border: "#C4ADE9",
    background: "#F0EAF9",
    selectedBackground: "#A07ADB",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#F0EAF9",
    badgeText: "#1F2937",
  },
  {
    label: "브라운",
    border: "#8A7A70",
    background: "#E1DDDA",
    selectedBackground: "#432818",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#E1DDDA",
    badgeText: "#1F2937",
  },
  {
    label: "청록",
    border: "#61A4AB",
    background: "#D6E8E9",
    selectedBackground: "#006D77",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#D6E8E9",
    badgeText: "#1F2937",
  },
  {
    label: "핑크",
    border: "#ECB5CF",
    background: "#FAECF3",
    selectedBackground: "#E087B1",
    text: "#1F2937",
    mutedText: "#1F2937",
    badgeBackground: "#FAECF3",
    badgeText: "#1F2937",
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
