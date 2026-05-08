import { mockAuthSessionProvider } from "@/services/mockAuthSessionProvider";
import type { AuthSession } from "@/types/auth";

export type OwnerSession = AuthSession;

export const defaultAuthSessionProvider = mockAuthSessionProvider;

export async function getCurrentOwnerSession(): Promise<OwnerSession | null> {
  return defaultAuthSessionProvider.restoreSession();
}

export async function signInWithMockOwnerSession(): Promise<OwnerSession> {
  return defaultAuthSessionProvider.signIn({
    loginId: "mock-owner",
    password: "mock-password",
  });
}

export async function signOutCurrentOwnerSession(): Promise<void> {
  await defaultAuthSessionProvider.signOut();
}

export async function getCurrentOwnerAccessToken(): Promise<string | null> {
  return defaultAuthSessionProvider.getAccessToken();
}
