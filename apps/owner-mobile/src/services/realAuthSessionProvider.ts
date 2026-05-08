import type { AuthSessionProvider } from "@/services/authSessionProvider";

const notImplementedMessage =
  "Real Supabase Auth session provider is not implemented yet. Use the mock auth provider until the approved auth step.";

export function createRealAuthSessionProvider(): AuthSessionProvider {
  return {
    async getSession() {
      throw new Error(notImplementedMessage);
    },
    async getAccessToken() {
      throw new Error(notImplementedMessage);
    },
    async signIn() {
      throw new Error(notImplementedMessage);
    },
    async signOut() {
      throw new Error(notImplementedMessage);
    },
    async restoreSession() {
      throw new Error(notImplementedMessage);
    },
  };
}
