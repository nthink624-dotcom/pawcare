export type ReservationChipSurface = {
  background: string;
  mutedBackground: string;
  border: string;
  text: string;
};

function surface(background: string): ReservationChipSurface {
  return {
    background,
    mutedBackground: "#F7F7F7",
    border: background,
    text: "#263640",
  };
}

// Booking surfaces are shared by PC and mobile; staff identity accents stay separate.
export const reservationChipSurfaces = {
  rose: surface("#FBE7E7"),
  cream: surface("#FBF3E0"),
  lemon: surface("#F8FBE0"),
  mint: surface("#E0FBEA"),
  sky: surface("#E0F4FB"),
  neutral: surface("#F7F7F7"),
  lavender: surface("#F0EBFB"),
  sand: surface("#F4EEE5"),
  aqua: surface("#E0FBF2"),
  pink: surface("#FBEAF1"),
} satisfies Record<string, ReservationChipSurface>;

export const reservationServiceChipPalette: readonly ReservationChipSurface[] = [
  reservationChipSurfaces.sky,
  reservationChipSurfaces.mint,
  reservationChipSurfaces.lavender,
  reservationChipSurfaces.cream,
  reservationChipSurfaces.rose,
  reservationChipSurfaces.aqua,
  reservationChipSurfaces.lemon,
  reservationChipSurfaces.pink,
  surface("#E8EDFC"),
  surface("#E8F1DE"),
  surface("#FBE8DA"),
  surface("#F0E2F5"),
  surface("#D8EBF1"),
  surface("#D6F0E5"),
  surface("#E1DEF5"),
  surface("#F1E7CF"),
  surface("#F2DADB"),
  surface("#D9F0EC"),
  surface("#EFF1CF"),
  surface("#F2DDEA"),
  surface("#DBE5F6"),
  surface("#E3EACC"),
  surface("#F3E1D5"),
  surface("#E7E4EF"),
];

const extendedPalette = [...reservationServiceChipPalette];
const usedBackgrounds = new Set(extendedPalette.map((tone) => tone.background));

function pastelHex(index: number) {
  const hue = ((index * 137.508 + 27) % 360) / 60;
  const saturation = 0.64;
  const lightness = 0.92 + (Math.floor(index / 24) % 3) * 0.01;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((hue % 2) - 1));
  const offset = lightness - chroma / 2;
  const channels = hue < 1 ? [chroma, secondary, 0]
    : hue < 2 ? [secondary, chroma, 0]
    : hue < 3 ? [0, chroma, secondary]
    : hue < 4 ? [0, secondary, chroma]
    : hue < 5 ? [secondary, 0, chroma]
    : [chroma, 0, secondary];
  return `#${channels.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

let nextGeneratedColor = 0;

export function getReservationServiceChipTone(index: number): ReservationChipSurface {
  const paletteIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  while (extendedPalette.length <= paletteIndex) {
    const background = pastelHex(nextGeneratedColor++);
    if (usedBackgrounds.has(background)) continue;
    usedBackgrounds.add(background);
    extendedPalette.push(surface(background));
  }
  return extendedPalette[paletteIndex]!;
}

export type ReservationChipService = { id: string; created_at?: string };

export function buildServiceReservationChipTones(services: readonly ReservationChipService[]) {
  // Keep inactive services in this list. View filters and menu reordering must not change colors.
  const ordered = [...services].sort((first, second) => {
    const firstKey = `${first.created_at ?? ""}\u0000${first.id}`;
    const secondKey = `${second.created_at ?? ""}\u0000${second.id}`;
    return firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0;
  });
  const tones: Record<string, ReservationChipSurface> = {};
  let paletteIndex = 0;
  for (const service of ordered) {
    if (Object.hasOwn(tones, service.id)) continue;
    Object.defineProperty(tones, service.id, {
      value: getReservationServiceChipTone(paletteIndex++),
      enumerable: true,
    });
  }
  return tones;
}
