import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ownerPilotCohortStatuses } from "@/lib/billing/owner-pilot-cohort";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import {
  getOwnerPilotCohortProjection,
  OwnerPilotCohortError,
  recordOwnerPilotFeedback,
  setOwnerPilotCohortMembership,
} from "@/server/owner-pilot-cohort";

const identitySchema = z.object({
  ownerUserId: z.string().uuid(),
  shopId: z.string().trim().min(1).max(100),
});

const membershipSchema = identitySchema.extend({
  action: z.literal("membership"),
  status: z.enum(ownerPilotCohortStatuses),
  reason: z.string().trim().min(3).max(300),
  idempotencyKey: z.string().uuid(),
});

const feedbackSchema = identitySchema.extend({
  action: z.literal("feedback"),
  feedbackText: z.string().trim().min(1).max(4000),
  days: z.number().int().min(3).max(60),
  idempotencyKey: z.string().uuid(),
});

const actionSchema = z.discriminatedUnion("action", [membershipSchema, feedbackSchema]);

function responseForError(error: unknown) {
  if (error instanceof AdminApiError || error instanceof OwnerPilotCohortError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ ok: false, message: "파일럿 대상과 요청 내용을 확인해 주세요." }, { status: 400 });
  }
  return NextResponse.json({ ok: false, message: "파일럿 코호트 상태를 확인하지 못했습니다." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const identity = identitySchema.parse({
      ownerUserId: request.nextUrl.searchParams.get("ownerUserId"),
      shopId: request.nextUrl.searchParams.get("shopId"),
    });
    return NextResponse.json({ ok: true, cohort: await getOwnerPilotCohortProjection(identity) });
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = actionSchema.parse(await request.json());
    const adminEmail = admin.email.trim().toLowerCase();
    if (body.action === "membership") {
      const cohort = await setOwnerPilotCohortMembership({ ...body, adminEmail });
      return NextResponse.json({ ok: true, cohort });
    }

    const contentFingerprint = createHash("sha256").update(body.feedbackText).digest("hex");
    const result = await recordOwnerPilotFeedback({
      ownerUserId: body.ownerUserId,
      shopId: body.shopId,
      contentFingerprint,
      days: body.days,
      adminEmail,
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseForError(error);
  }
}
