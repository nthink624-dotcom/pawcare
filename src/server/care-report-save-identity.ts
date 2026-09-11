import { createHash } from "node:crypto";

export function hashCareReportSavePayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

export function decideCareReportSaveReplay({
  requestId,
  fingerprint,
  existingRequestId,
  existingFingerprint,
}: {
  requestId: string;
  fingerprint: string;
  existingRequestId?: string;
  existingFingerprint?: string;
}) {
  if (requestId !== existingRequestId) return "write" as const;
  return fingerprint === existingFingerprint ? "replay" as const : "conflict" as const;
}
