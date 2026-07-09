import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import {
  createOwnerSupportRequest,
  listOwnerSupportRequestsForOwner,
  markOwnerSupportRequestRead,
  OwnerSupportRequestError,
} from "@/server/owner-support-requests";

const createSupportRequestSchema = z.object({
  shopId: z.string().trim().min(1),
  requestType: z
    .enum(["bug", "improvement", "question", "how_to_use", "payment", "feature_request", "account", "notification", "other"])
    .optional(),
  category: z.enum(["how_to_use", "bug", "payment", "feature_request", "account", "notification", "other"]).optional(),
  title: z.string().trim().max(160).optional().default(""),
  contact: z.string().trim().max(200).optional().default(""),
  ownerName: z.string().trim().max(120).optional().default(""),
  ownerPhone: z.string().trim().max(80).optional().default(""),
  ownerEmail: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  context: z.record(z.string(), z.unknown()).optional().default({}),
  attachments: z
    .array(
      z.object({
        mediaAssetId: z.string().uuid(),
        fileName: z.string().trim().max(240).optional().nullable(),
        fileType: z.string().trim().max(120).optional().nullable(),
        fileSize: z.number().int().positive().optional().nullable(),
      }),
    )
    .max(3)
    .optional()
    .default([]),
});

const readSupportRequestSchema = z.object({
  shopId: z.string().trim().min(1),
  requestId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shopId") ?? "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);
    const owner = await requireOwnerShop(request, shopId);
    const requests = await listOwnerSupportRequestsForOwner({
      shopId: owner.shopId,
      ownerUserId: owner.userId,
      limit,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof OwnerApiError || error instanceof OwnerSupportRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "문의 내역을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

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
          requestType: body.requestType ?? body.category ?? "other",
          category: body.category ?? "other",
          status: "open",
          priority: "normal",
          title: body.title || "1:1 문의",
          contact: body.contact,
          ownerName: body.ownerName,
          ownerPhone: body.ownerPhone,
          ownerEmail: body.ownerEmail,
          message: body.message,
          context: body.context,
          adminNote: "",
          source: "owner_web",
          answeredAt: null,
          closedAt: null,
          ownerLastReadAt: new Date().toISOString(),
          adminLastReadAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          attachments: [],
        },
      });
    }

    const owner = await requireOwnerShop(request, body.shopId);
    const supportRequest = await createOwnerSupportRequest({
      shopId: owner.shopId,
      ownerUserId: owner.userId,
      requestType: body.requestType,
      category: body.category,
      title: body.title,
      contact: body.contact,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      ownerEmail: body.ownerEmail,
      message: body.message,
      context: body.context,
      source: "owner_web",
      attachments: body.attachments,
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

export async function PATCH(request: NextRequest) {
  try {
    const body = readSupportRequestSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    await markOwnerSupportRequestRead({
      id: body.requestId,
      shopId: owner.shopId,
      ownerUserId: owner.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "읽음 처리할 문의를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof OwnerApiError || error instanceof OwnerSupportRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "문의 읽음 처리를 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
