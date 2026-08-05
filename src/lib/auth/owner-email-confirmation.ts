import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_CONFIRMATION_MESSAGE = "이메일 인증 메일을 보냈어요. 메일의 인증 링크를 연 뒤 로그인해 주세요.";

function getConfiguredSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  if (configured) return configured;

  return process.env.VERCEL_ENV === "production" ? "https://www.petmanager.co.kr" : "http://localhost:3000";
}

export function getOwnerEmailConfirmationRedirectUrl() {
  try {
    const redirectUrl = new URL("/login", getConfiguredSiteUrl());
    redirectUrl.searchParams.set("message", "email-confirmed");
    return redirectUrl.toString();
  } catch {
    throw new Error("이메일 인증 후 이동할 사이트 주소 설정을 확인해 주세요.");
  }
}

export function mapOwnerEmailConfirmationError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.toLowerCase();

  if (
    message === "인증 메일 요청이 잠시 제한되었어요. 잠시 후 다시 시도해 주세요." ||
    message === "이메일 인증 후 이동할 주소 설정을 확인해 주세요." ||
    message === "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."
  ) {
    return message;
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "인증 메일 요청이 잠시 제한되었어요. 잠시 후 다시 시도해 주세요.";
  }

  if (normalized.includes("redirect") || normalized.includes("url")) {
    return "이메일 인증 후 이동할 주소 설정을 확인해 주세요.";
  }

  return "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export async function sendOwnerEmailConfirmation(supabase: SupabaseClient, email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: getOwnerEmailConfirmationRedirectUrl(),
    },
  });

  if (error) {
    throw new Error(mapOwnerEmailConfirmationError(error));
  }
}

export { EMAIL_CONFIRMATION_MESSAGE };
