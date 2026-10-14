/** Approved legacy links must resolve to exactly the same origin and signed token. */
export function isSameBookingManageLink(candidate: string, expected: string) {
  try {
    const target = new URL(expected);
    const link = new URL(candidate);
    if (target.pathname !== "/m" || !target.searchParams.get("t")) return false;
    if (link.pathname === "/book/manage") link.pathname = "/m";
    return link.href === target.href;
  } catch {
    return false;
  }
}
