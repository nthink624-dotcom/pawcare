export type AuthSession = {
  userId: string;
  ownerId: string;
  email: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
};

export type AuthSignInCredentials = {
  loginId: string;
  password: string;
};
