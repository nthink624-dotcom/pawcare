import type { AuthSession } from "@/types/auth";

export type SupabaseSessionLike = {
  access_token?: string | null;
  expires_at?: number | null;
  user?: {
    id?: string | null;
    email?: string | null;
  } | null;
};

export type MapSupabaseSessionOptions = {
  now?: () => number;
};

export function mapSupabaseSessionToAuthSession(
  session: SupabaseSessionLike | null | undefined,
  { now = Date.now }: MapSupabaseSessionOptions = {},
): AuthSession | null {
  const accessToken = session?.access_token?.trim();
  const userId = session?.user?.id?.trim();

  if (!session || !accessToken || !userId) {
    return null;
  }

  const expiresAt = typeof session.expires_at === "number" ? session.expires_at : null;
  if (expiresAt !== null && expiresAt * 1000 <= now()) {
    return null;
  }

  return {
    userId,
    ownerId: userId,
    email: session.user?.email?.trim() || null,
    accessToken,
    expiresAt,
    isAuthenticated: true,
  };
}
