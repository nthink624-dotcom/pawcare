export type StaffChipTone = {
  border: string;
  background: string;
  selectedBackground: string;
  text: string;
  mutedText: string;
  badgeBackground: string;
  badgeText: string;
};

export const staffChipPalette: StaffChipTone[] = [
  {
    border: "#f2b84b",
    background: "#fff8e8",
    selectedBackground: "#f59e0b",
    text: "#7a4a00",
    mutedText: "#a16207",
    badgeBackground: "#fef3c7",
    badgeText: "#92400e",
  },
  {
    border: "#7cc6a4",
    background: "#eefaf5",
    selectedBackground: "#2f7866",
    text: "#155e4a",
    mutedText: "#2f7866",
    badgeBackground: "#dff5ec",
    badgeText: "#17614f",
  },
  {
    border: "#8eb6f2",
    background: "#f0f6ff",
    selectedBackground: "#3b82f6",
    text: "#1d4f91",
    mutedText: "#2563eb",
    badgeBackground: "#dbeafe",
    badgeText: "#1d4ed8",
  },
  {
    border: "#d7a6f5",
    background: "#fbf4ff",
    selectedBackground: "#9b5dd8",
    text: "#6b2d96",
    mutedText: "#7e3fb5",
    badgeBackground: "#f3e8ff",
    badgeText: "#7e22ce",
  },
  {
    border: "#f3a6b8",
    background: "#fff3f6",
    selectedBackground: "#d94b73",
    text: "#9f294d",
    mutedText: "#be3b62",
    badgeBackground: "#ffe4ec",
    badgeText: "#be123c",
  },
  {
    border: "#a9c06f",
    background: "#f7faed",
    selectedBackground: "#6f8f2b",
    text: "#4f641d",
    mutedText: "#68821f",
    badgeBackground: "#edf6d3",
    badgeText: "#4d7c0f",
  },
  {
    border: "#e7a16b",
    background: "#fff5ed",
    selectedBackground: "#c76a2a",
    text: "#8a451b",
    mutedText: "#a65720",
    badgeBackground: "#ffedd5",
    badgeText: "#c2410c",
  },
  {
    border: "#83c5d8",
    background: "#effbff",
    selectedBackground: "#14809a",
    text: "#0f6478",
    mutedText: "#0e7490",
    badgeBackground: "#cffafe",
    badgeText: "#0e7490",
  },
];

function hashStaffKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function normalizeStaffChipColorIndex(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.abs(Math.trunc(value)) % staffChipPalette.length;
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

  const normalizedPaletteIndex = normalizeStaffChipColorIndex(paletteIndex);
  if (normalizedPaletteIndex !== null) {
    return staffChipPalette[normalizedPaletteIndex]!;
  }

  return staffChipPalette[hashStaffKey(staffKey) % staffChipPalette.length]!;
}
