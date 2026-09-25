type CustomerBookingNotificationIdentity = {
  appointmentId?: string | null;
  type?: string;
};

type NotificationFailureLogger = (message: string, context: Record<string, unknown>) => void;

export async function deliverCustomerBookingNotificationSafely<TInput extends CustomerBookingNotificationIdentity, TResult>(
  input: TInput,
  deliver: (payload: TInput) => Promise<TResult>,
  logFailure: NotificationFailureLogger = (message, context) => console.error(message, context),
) {
  try {
    return await deliver(input);
  } catch (error) {
    logFailure("[customer-bookings] notification dispatch failed after booking mutation", {
      appointmentId: input.appointmentId ?? null,
      type: input.type ?? null,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
