import { env } from "@/lib/env";

export type SocialProvider = "google" | "kakao" | "naver";

export function getSocialOAuthProvider(provider: SocialProvider) {
  if (provider === "naver") {
    return env.naverOAuthProvider;
  }

  return provider;
}
