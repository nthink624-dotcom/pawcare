export type PushRegistrationState = "unavailable" | "ready" | "registered";

export async function getPushRegistrationState(): Promise<PushRegistrationState> {
  return "unavailable";
}
