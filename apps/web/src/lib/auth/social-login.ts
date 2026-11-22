import { getSafeOwnerLoginReturnPath } from "@/lib/auth/login-return-path";
import type { SocialLoginError } from "@petmanager/shared/lib/owner-social-login";

export {
  completeSocialLogin,
  readSocialLoginAvailability,
  SOCIAL_AUTH_READ_TIMEOUT_MS,
  SOCIAL_LOGIN_PROVIDERS,
  SocialLoginFailure,
  type SocialLoginAvailability,
  type SocialLoginError,
  type SocialLoginProvider,
} from "@petmanager/shared/lib/owner-social-login";

export function getSocialLoginReturnPath(value?: string) {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/owner";
  const safe = getSafeOwnerLoginReturnPath(value);
  const normalized = new URL(safe, "https://petmanager.invalid");
  return getSafeOwnerLoginReturnPath(`${normalized.pathname}${normalized.search}${normalized.hash}`);
}

export function getSocialLoginCallbackUrl(origin: string, nextPath: string) {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", getSocialLoginReturnPath(nextPath));
  return callback.toString();
}

export function getSocialLoginFailurePath(reason: SocialLoginError, nextPath: string) {
  return `/login?${new URLSearchParams({ error: reason, next: getSocialLoginReturnPath(nextPath) })}`;
}
