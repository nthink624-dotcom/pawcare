export type BookingDepositNotice = {
  accountId: string; appointmentId: string; date: string; key: string;
  kind: "refund" | "review"; amount: number; guardianName: string; payerName: string; urgent: boolean;
};
