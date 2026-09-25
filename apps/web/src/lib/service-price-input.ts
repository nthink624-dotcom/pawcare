export const SERVICE_PRICE_MAX_KRW = 100_000_000;

export type ServicePriceInputResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "syntax" | "range" };

// Keep raw input intact until it passes. In particular, a minus sign or decimal
// separator must never turn into a different, valid KRW amount.
export function parseServicePriceInput(value: string): ServicePriceInputResult {
  const raw = value.trim();
  if (!raw) return { ok: false, reason: "empty" };

  const hasValidGrouping = /^(?:0|[1-9]\d{0,2}(?:,\d{3})+)$/.test(raw);
  const hasUngroupedInteger = /^(?:0|[1-9]\d*)$/.test(raw);
  if (!hasValidGrouping && !hasUngroupedInteger) return { ok: false, reason: "syntax" };

  const amount = Number(raw.replaceAll(",", ""));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > SERVICE_PRICE_MAX_KRW) {
    return { ok: false, reason: "range" };
  }

  return { ok: true, value: amount };
}

export function formatServicePriceInput(value: string) {
  const parsed = parseServicePriceInput(value);
  return parsed.ok ? parsed.value.toLocaleString("ko-KR") : value;
}

// Saved owner-web rows historically use a presentation-only `원` suffix. This
// accepts that exact display form while keeping live user input strict.
export function parseStoredServicePrice(value: string) {
  const raw = value.trim();
  return parseServicePriceInput(raw.endsWith("원") ? raw.slice(0, -1).trim() : raw);
}
