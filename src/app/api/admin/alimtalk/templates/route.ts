import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getAppTemplateDrafts, saveAppTemplateDraft } from "@/server/alimtalk-template-overrides";
import type { AlimtalkTemplateAlias } from "@/lib/notification-registry";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    return NextResponse.json({ items: await getAppTemplateDrafts() });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 템플릿을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = (await request.json()) as { alias?: string; body?: string };
    const result = await saveAppTemplateDraft({
      alias: body.alias as AlimtalkTemplateAlias,
      body: body.body ?? "",
      adminId: admin.id,
    });
    return NextResponse.json({ item: result });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 템플릿 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
