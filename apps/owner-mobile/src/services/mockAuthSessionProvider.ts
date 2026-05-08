import type { AuthSession } from "@/types/auth";
import type { AuthSessionProvider } from "@/services/authSessionProvider";

export const MOCK_AUTH_SESSION: AuthSession = {
  userId: "mock-owner-user",
  ownerId: "mock-owner",
  email: "mock-owner@owner.petmanager.local",
  accessToken: null,
  expiresAt: null,
  isAuthenticated: true,
};

export function createMockAuthSessionProvider(initialSession: AuthSession | null = null): AuthSessionProvider {
  let currentSession = initialSession;

  return {
    async getSession() {
      return currentSession;
    },
    async getAccessToken() {
      return currentSession?.accessToken ?? null;
    },
    async signIn() {
      currentSession = MOCK_AUTH_SESSION;
      return currentSession;
    },
    async signOut() {
      currentSession = null;
    },
    async restoreSession() {
      return currentSession;
    },
  };
}

export const mockAuthSessionProvider = createMockAuthSessionProvider();
