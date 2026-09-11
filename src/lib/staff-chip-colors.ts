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
    border: "#C5DEE0",
    background: "#E0F1F1",
    selectedBackground: "#1F5F69",
    text: "#193E45",
    mutedText: "#4B7076",
    badgeBackground: "#F1FAFA",
    badgeText: "#1D5560",
  },
  {
    border: "#C6E2DC",
    background: "#E3F5F0",
    selectedBackground: "#278D7F",
    text: "#1E554C",
    mutedText: "#518176",
    badgeBackground: "#F1FBF8",
    badgeText: "#227B6F",
  },
  {
    border: "#BFE5E0",
    background: "#DDF7F3",
    selectedBackground: "#199A98",
    text: "#1C5B5A",
    mutedText: "#50807E",
    badgeBackground: "#F0FCFA",
    badgeText: "#18817F",
  },
  {
    border: "#CDE3D2",
    background: "#EAF7ED",
    selectedBackground: "#4E9A68",
    text: "#315A3D",
    mutedText: "#668274",
    badgeBackground: "#F3FCF5",
    badgeText: "#43865A",
  },
  {
    border: "#E8DDC5",
    background: "#FBF6E8",
    selectedBackground: "#9A7D43",
    text: "#625233",
    mutedText: "#827355",
    badgeBackground: "#FEFCF4",
    badgeText: "#856A32",
  },
  {
    border: "#E8D6A8",
    background: "#FFF8D9",
    selectedBackground: "#AD7D08",
    text: "#644B12",
    mutedText: "#856A24",
    badgeBackground: "#FFFBE7",
    badgeText: "#906806",
  },
  {
    border: "#EBCFBA",
    background: "#FFF0E4",
    selectedBackground: "#C46219",
    text: "#6B3F1F",
    mutedText: "#8D6141",
    badgeBackground: "#FFF6EC",
    badgeText: "#A85014",
  },
  {
    border: "#E7CEBC",
    background: "#FDF0E7",
    selectedBackground: "#B85B24",
    text: "#6A3C21",
    mutedText: "#895E42",
    badgeBackground: "#FFF3E9",
    badgeText: "#9E4A1D",
  },
  {
    border: "#EBCFCC",
    background: "#FFF0EF",
    selectedBackground: "#B94A45",
    text: "#6B3936",
    mutedText: "#8A5A56",
    badgeBackground: "#FFF4F2",
    badgeText: "#9F3F3B",
  },
  {
    border: "#E7CBC8",
    background: "#FBEDEC",
    selectedBackground: "#953E3B",
    text: "#602E2C",
    mutedText: "#7F504C",
    badgeBackground: "#FDF1EF",
    badgeText: "#823431",
  },
] satisfies readonly StaffChipTone[];

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
