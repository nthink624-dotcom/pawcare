import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewCustomerBookingConsents } from "@/server/customer-booking-consents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  shopId: z.string().trim().min(1).max(100),
  guardianName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(10).max(20),
  petName: z.string().trim().min(1).max(100),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const result = await previewCustomerBookingConsents(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "동의서 정보를 불러오지 못했습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
