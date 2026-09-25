import type { NextRequest } from "next/server";

import { AdminAccountError, getAdminAccountById } from "@/server/admin-account";
import { getAdminSessionFromRequest } from "@/server/admin-session";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireAdminSession(request: NextRequest) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    throw new AdminApiError("관리자 로그인이 필요합니다.", 401);
  }

  try {
    const account = await getAdminAccountById(session.accountId);
    if (!account || !account.isActive) {
      throw new AdminApiError("사용 가능한 관리자 계정을 찾을 수 없습니다.", 403);
    }

    return account;
  } catch (error) {
    if (error instanceof AdminAccountError) {
      throw new AdminApiError(error.message, error.status);
    }

    throw error;
  }
}

export const requireAdminUser = requireAdminSession;
