export type AppointmentIdentityTone = {
  background: string;
  mutedBackground: string;
  border: string;
  accent: string;
  text: string;
};

export const appointmentIdentityPalette = [
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#6f8faf", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#6f9585", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#88799b", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#b17b69", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#8c926b", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#a97b88", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#668f92", text: "#243447" },
  { background: "#ffffff", mutedBackground: "#f8fafc", border: "#e4e9ef", accent: "#75869a", text: "#243447" },
] satisfies readonly AppointmentIdentityTone[];

function hashIdentity(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getAppointmentIdentityTone(identity: string | null | undefined) {
  const key = identity?.trim() || "appointment";
  return appointmentIdentityPalette[hashIdentity(key) % appointmentIdentityPalette.length]!;
}
