export type RetirementState = "stopped" | "review_cancelled" | "manual_review" | "unknown";
type Detail = { inspectionStatus: string | null; serviceStatus: string | null };

/** Every attempt starts with fresh readback. A timeout never causes a blind repeat of a provider write. */
export async function retireTemplate(
  code: string,
  read: (code: string) => Promise<Detail>,
  stop: (code: string) => Promise<unknown>,
  cancelReview: (code: string) => Promise<unknown>,
): Promise<RetirementState> {
  const detail = await read(code);
  const inspection = String(detail.inspectionStatus ?? "").toUpperCase();
  const service = String(detail.serviceStatus ?? "").toUpperCase();
  const stopped = (value: Detail) => ["S", "STP", "STOP", "STOPPED", "BLK"].includes(String(value.serviceStatus ?? "").toUpperCase());
  if (stopped(detail)) return "stopped";
  if (inspection === "APR" && ["A", "R", "ACT", "RDY", "ACTIVE", "READY"].includes(service)) {
    await stop(code);
    return stopped(await read(code)) ? "stopped" : "unknown";
  }
  if (inspection === "REQ" && service === "R") {
    await cancelReview(code);
    return ["REG", "REJ"].includes(String((await read(code)).inspectionStatus).toUpperCase()) ? "review_cancelled" : "unknown";
  }
  // Provider deletion is restricted by review/service state; never invent success or auto-delete an unverified record.
  return "manual_review";
}
