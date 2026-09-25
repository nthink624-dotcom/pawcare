import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOwnerEmailConfirmationRedirectUrl } from "@/lib/auth/owner-email-confirmation";
import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import { getSupabaseAuthClient } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

const schema = z.object({ email: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "이메일 인증 환경이 준비되지 않았습니다." }, { status: 503 });
    }

    const body = schema.parse(await request.json());
    const email = normalizeOwnerEmail(body.email);
    if (!isValidOwnerEmail(email)) {
      return NextResponse.json({ message: "이메일 형식을 확인해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAuthClient();
    if (!supabase) {
      return NextResponse.json({ message: "이메일 인증 환경이 준비되지 않았습니다." }, { status: 503 });
    }

    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getOwnerEmailConfirmationRedirectUrl(request.nextUrl.origin) },
    });
  } catch {
    // The response must not disclose whether the email is already registered.
  }

  return NextResponse.json({
    success: true,
    message: "가입된 이메일이라면 인증 메일을 다시 보냈습니다. 메일함과 스팸함을 확인해 주세요.",
  });
}
