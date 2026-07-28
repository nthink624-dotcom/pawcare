import type { SocialProvider } from "@/lib/auth/social-auth";

const kakaoSimpleSignupEnabled =
  process.env.NEXT_PUBLIC_KAKAO_SIMPLE_SIGNUP_ENABLED === "true";

export type SocialSignupAgreementState = {
  service: boolean;
  privacy: boolean;
  location: boolean;
  marketing: boolean;
};

export const initialSocialSignupAgreements: SocialSignupAgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

export function requiresPetManagerSocialTerms(provider: SocialProvider | undefined) {
  if (provider === "naver") return false;
  if (provider === "kakao") return !kakaoSimpleSignupEnabled;
  return true;
}

export function resolveSocialSignupAgreements(
  provider: SocialProvider,
  agreements: SocialSignupAgreementState,
): SocialSignupAgreementState {
  if (provider === "naver" || (provider === "kakao" && kakaoSimpleSignupEnabled)) {
    return {
      ...agreements,
      service: true,
      privacy: true,
    };
  }

  return agreements;
}

export function resolveSocialConsentSource(provider: SocialProvider) {
  if (provider === "naver") return "naver_login_plus";
  if (provider === "kakao" && kakaoSimpleSignupEnabled) return "kakao_simple_signup";
  return "petmanager_social_signup";
}
