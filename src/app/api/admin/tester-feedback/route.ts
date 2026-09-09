import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  testerAccessDecisionActions,
  testerFeedbackCategories,
  testerFeedbackStatuses,
} from "@/lib/tester-feedback";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import {
  listTesterFeedback,
  decideTesterAccess,
  getTesterFeedbackScreenshotPreview,
  hardPurgeTesterFeedbackScreenshot,
  TesterFeedbackError,
  updateTesterFeedbackStatus,
} from "@/server/tester-feedback";

const statusUpdateSchema = z.object({
  feedbackId: z.string().uuid(),
  status: z.enum(testerFeedbackStatuses),
}).strict();
const updateSchema = z.union([
  statusUpdateSchema,
  z.object({
    action: z.literal("tester_access"),
    feedbackId: z.string().uuid(),
    decision: z.enum(testerAccessDecisionActions),
    requestId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("remove_screenshot"),
    feedbackId: z.string().uuid(),
  }).strict(),
]);

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const screenshotFeedbackId = request.nextUrl.searchParams.get("screenshotFeedbackId");
    if (screenshotFeedbackId) {
      const parsedId = z.string().uuid().parse(screenshotFeedbackId);
      return NextResponse.json(await getTesterFeedbackScreenshotPreview(parsedId));
    }
    const categoryValue = request.nextUrl.searchParams.get("category");
    const statusValue = request.nextUrl.searchParams.get("status");
    const category = testerFeedbackCategories.find((value) => value === categoryValue);
    const status = testerFeedbackStatuses.find((value) => value === statusValue);
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 100), 1), 100);
    const feedback = await listTesterFeedback({ category, status, limit });
    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "스크린샷 요청을 다시 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof AdminApiError || error instanceof TesterFeedbackError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "피드백을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = updateSchema.parse(await request.json());
    if ("status" in body) {
      const feedback = await updateTesterFeedbackStatus(body);
      return NextResponse.json({ feedback });
    }
    if (body.action === "remove_screenshot") {
      return NextResponse.json(await hardPurgeTesterFeedbackScreenshot(body.feedbackId));
    }
    const result = await decideTesterAccess({
      feedbackId: body.feedbackId,
      action: body.decision,
      requestId: body.requestId,
      adminEmail: admin.email,
    });
    return NextResponse.json({ testerAccess: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "변경할 상태를 다시 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof AdminApiError || error instanceof TesterFeedbackError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "피드백 상태를 저장하지 못했습니다." }, { status: 500 });
  }
}
