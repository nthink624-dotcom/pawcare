import { NextRequest } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { getSupabaseAuthClient } from "@/lib/supabase/server";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireAdminUser(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!token) {
    throw new AdminApiError("로그인이 필요합니다.", 401);
  }

  const authClient = getSupabaseAuthClient();
  if (!authClient) {
    throw new AdminApiError("Supabase 인증 설정을 확인해 주세요.", 503);
  }

  const userResult = await authClient.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    throw new AdminApiError("로그인이 필요합니다.", 401);
  }

  const email = userResult.data.user.email?.toLowerCase().trim() ?? "";
  if (!email || !serverEnv.adminOwnerEmails.includes(email)) {
    throw new AdminApiError("운영자 전용 기능입니다.", 403);
  }

  return userResult.data.user;
}
