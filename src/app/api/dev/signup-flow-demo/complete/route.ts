import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  services: z.array(
    z.object({
      id: z.string().min(1),
      service: z.string().trim().min(1),
      price: z.string().regex(/^\d+$/),
      duration: z.string().regex(/^\d+$/),
      target: z.string().trim().min(1),
    }),
  ).min(1),
  account: z.object({
    ownerName: z.string().trim().min(1),
    email: z.string().email(),
    password: z.literal("[DEMO_REDACTED]"),
    shopName: z.string().trim().min(1),
    shopPhone: z.string().trim().min(1),
    shopAddress: z.string().trim().min(1),
    requiredConsent: z.literal(true),
  }),
  sourcePhoto: z.object({
    name: z.string().min(1),
    size: z.number().int().nonnegative(),
    type: z.string(),
  }).nullable(),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, persisted: false, message: "최종 가입 내용을 다시 확인해 주세요." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    persisted: false,
    boundary: "single-final-request",
    received: {
      serviceCount: parsed.data.services.length,
      hasPhotoMetadata: Boolean(parsed.data.sourcePhoto),
      accountFieldsValidated: true,
    },
  });
}
