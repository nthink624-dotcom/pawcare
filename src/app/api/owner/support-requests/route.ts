import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import {
  createOwnerSupportRequest,
  OwnerSupportRequestError,
  type OwnerSupportRequestType,
} from "@/server/owner-support-requests";

const createSupportRequestSchema = z.object({
  shopId: z.string().trim().min(1),
  requestType: z.enum(["bug", "improvement", "question"]),
  contact: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  context: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = createSupportRequestSchema.parse(await request.json());

    if (!hasSupabaseServerEnv()) {
      if (getSupabaseServerRuntimeStage() === "production") {
        throw new OwnerApiError("Supabase 서버 설정이 없어 문의를 접수할 수 없습니다.", 503);
      }

      return NextResponse.json({
        request: {
          id: `demo-support-${Date.now()}`,
          shopId: body.shopId,
          shopName: "Demo",
          ownerUserId: null,
          requestType: body.requestType as OwnerSupportRequestType,
          status: "open",
          contact: body.contact,
          message: body.message,
          context: body.context,
          adminNote: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const owner = await requireOwnerShop(request, body.shopId);
    const supportRequest = await createOwnerSupportRequest({
      shopId: owner.shopId,
      ownerUserId: owner.userId,
      requestType: body.requestType,
      contact: body.contact,
      message: body.message,
      context: body.context,
    });

    return NextResponse.json({ request: supportRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "문의 내용을 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof OwnerApiError || error instanceof OwnerSupportRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "문의를 접수하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
