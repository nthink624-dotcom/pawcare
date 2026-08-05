import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import {
  EMAIL_CONFIRMATION_MESSAGE,
  mapOwnerEmailConfirmationError,
  sendOwnerEmailConfirmation,
} from "@/lib/auth/owner-email-confirmation";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().min(1),
});

const genericSuccessMessage = "가입한 이메일이라면 인증 메일을 보냈어요. 받은편지함과 스팸함을 확인해 주세요.";

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "이메일 인증 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const payload = schema.parse(await request.json());
    const email = normalizeOwnerEmail(payload.email);
    if (!isValidOwnerEmail(email)) {
      return NextResponse.json({ message: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "이메일 인증 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const profileResult = await supabase
      .from("owner_profiles")
      .select("user_id")
      .eq("login_id", email)
      .maybeSingle<{ user_id: string }>();

    if (profileResult.error) {
      console.error("[owner-email-confirmation] profile lookup failed", profileResult.error.message);
      return NextResponse.json({ message: "인증 메일 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (!profileResult.data?.user_id) {
      return NextResponse.json({ success: true, message: genericSuccessMessage });
    }

    const userResult = await supabase.auth.admin.getUserById(profileResult.data.user_id);
    if (userResult.error || !userResult.data.user) {
      console.error("[owner-email-confirmation] auth user lookup failed", userResult.error?.message);
      return NextResponse.json({ message: "인증 메일 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (userResult.data.user.email_confirmed_at) {
      return NextResponse.json({ success: true, message: "이미 이메일 인증이 완료되었어요. 로그인해 주세요." });
    }

    await sendOwnerEmailConfirmation(supabase, email);
    return NextResponse.json({ success: true, message: EMAIL_CONFIRMATION_MESSAGE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "이메일을 입력해 주세요." }, { status: 400 });
    }

    const message = mapOwnerEmailConfirmationError(error);
    const status = message.includes("잠시 제한") ? 429 : 400;
    return NextResponse.json({ message }, { status });
  }
}
