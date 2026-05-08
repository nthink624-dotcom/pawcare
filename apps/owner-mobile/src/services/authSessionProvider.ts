import type { AuthSession, AuthSignInCredentials } from "@/types/auth";

export type AuthSessionProvider = {
  getSession(): Promise<AuthSession | null>;
  getAccessToken(): Promise<string | null>;
  signIn(credentials: AuthSignInCredentials): Promise<AuthSession>;
  signOut(): Promise<void>;
  restoreSession(): Promise<AuthSession | null>;
};

export type OwnerSessionTokenResolver = () => Promise<{
  accessToken: string;
  ownerEmail: string | null;
} | null>;

export function createAuthSessionTokenResolver(provider: AuthSessionProvider): OwnerSessionTokenResolver {
  return async () => {
    const [session, accessToken] = await Promise.all([provider.getSession(), provider.getAccessToken()]);

    if (!session?.isAuthenticated || !accessToken) {
      return null;
    }

    return {
      accessToken,
      ownerEmail: session.email,
    };
  };
}
