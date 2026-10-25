import { fetchApiJsonWithAuth } from "@/lib/api";

export type OwnerAccountDeletionAdapterInput = Readonly<{
  currentPassword: string;
  confirmed: true;
  idempotencyKey: string;
}>;

export type OwnerAccountDeletionAdapterResult = Readonly<{
  status: "completed" | "blocked" | "failed";
  message: string;
}>;

export type OwnerAccountDeletionAdapter = (
  input: OwnerAccountDeletionAdapterInput,
) => Promise<OwnerAccountDeletionAdapterResult>;

export async function deleteOwnerAccount(
  input: OwnerAccountDeletionAdapterInput,
): Promise<OwnerAccountDeletionAdapterResult> {
  const result = await fetchApiJsonWithAuth<{ success?: boolean; message?: string }>("/api/owner/account-deletion", {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({
      confirmation: input.confirmed,
      currentPassword: input.currentPassword,
      idempotencyKey: input.idempotencyKey,
    }),
  });

  return result?.success
    ? { status: "completed", message: "계정 삭제가 완료되었습니다." }
    : { status: "failed", message: result?.message ?? "계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." };
}
