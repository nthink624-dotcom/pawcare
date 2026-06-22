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
  {
    border: "#c4b5fd",
    background: "#f5f3ff",
    selectedBackground: "#7c3aed",
    text: "#5b21b6",
    mutedText: "#6d28d9",
    badgeBackground: "#ede9fe",
    badgeText: "#5b21b6",
  },
  {
    border: "#f9a8d4",
    background: "#fdf2f8",
    selectedBackground: "#db2777",
    text: "#9d174d",
    mutedText: "#be185d",
    badgeBackground: "#fce7f3",
    badgeText: "#9d174d",
  },
  {
    border: "#fca5a5",
    background: "#fff1f2",
    selectedBackground: "#dc2626",
    text: "#991b1b",
    mutedText: "#b91c1c",
    badgeBackground: "#fee2e2",
    badgeText: "#991b1b",
  },
  {
    border: "#fdba74",
    background: "#fff7ed",
    selectedBackground: "#ea580c",
    text: "#9a3412",
    mutedText: "#c2410c",
    badgeBackground: "#ffedd5",
    badgeText: "#9a3412",
  },
  {
    border: "#bef264",
    background: "#f7fee7",
    selectedBackground: "#65a30d",
    text: "#3f6212",
    mutedText: "#4d7c0f",
    badgeBackground: "#ecfccb",
    badgeText: "#3f6212",
  },
  {
    border: "#67e8f9",
    background: "#ecfeff",
    selectedBackground: "#0891b2",
    text: "#155e75",
    mutedText: "#0e7490",
    badgeBackground: "#cffafe",
    badgeText: "#155e75",
  },
  {
    border: "#93c5fd",
    background: "#eff6ff",
    selectedBackground: "#2563eb",
    text: "#1e40af",
    mutedText: "#1d4ed8",
    badgeBackground: "#dbeafe",
    badgeText: "#1e40af",
  },
  {
    border: "#cbd5e1",
    background: "#f8fafc",
    selectedBackground: "#475569",
    text: "#334155",
    mutedText: "#475569",
    badgeBackground: "#f1f5f9",
    badgeText: "#334155",
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
