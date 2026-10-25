/** Compare only the approved, shop-submitted message; never infer approval from service readiness. */
export function shopTemplateInspectionState(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (["APR", "APPROVED"].includes(status)) return "approved";
  if (["REJ", "REJECTED"].includes(status)) return "rejected";
  if (["ING", "REVIEWING", "PROCESSING"].includes(status)) return "reviewing";
  if (["REQ", "REQUESTED", "WAIT", "WAITING"].includes(status)) return "requested";
  return "unknown";
}

function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").split("\n").map(line => line.trimEnd()).join("\n").trim() : "";
}

function buttons(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(button => {
    if (!button || typeof button !== "object") return null;
    const name = text(button.name ?? button.buttonName), mobile = text(button.linkMobile);
    const type = button.type ?? button.buttonType;
    if (!name || !mobile || type !== "WL") return null;
    return { type, name, mobile, pc: text(button.linkPc) || mobile };
  });
  return normalized.some(button => !button) ? null : normalized;
}

export function matchesShopTemplateSnapshot(
  row: { template_code?: unknown; template_content?: unknown; template_buttons?: unknown },
  provider: { templateCode?: unknown; templateContent?: unknown; buttons?: unknown },
) {
  const expectedButtons = buttons(row.template_buttons), actualButtons = buttons(provider.buttons);
  return Boolean(text(row.template_code)) && row.template_code === provider.templateCode
    && Boolean(text(row.template_content)) && text(row.template_content) === text(provider.templateContent)
    && expectedButtons !== null && actualButtons !== null
    && JSON.stringify(expectedButtons) === JSON.stringify(actualButtons);
}
