import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasPortoneServerEnv, serverEnv } from "@/lib/server-env";
import { createCustomerBooking } from "@/server/customer-bookings";

const paymentBookingSchema = z.object({
  paymentId: z.string().min(1),
  expectedAmount: z.coerce.number().min(0),
  booking: z.object({
    shopId: z.string().min(1),
    guardianName: z.string().trim().min(1),
    phone: z.string().trim().min(10),
    petName: z.string().trim().min(1),
    breed: z.string().trim().optional().default(""),
    extraPets: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          breed: z.string().trim().optional().default(""),
        }),
      )
      .optional()
      .default([]),
    serviceId: z.string().min(1),
    appointmentDate: z.string().min(1),
    appointmentTime: z.string().min(1),
    memo: z.string().optional().default(""),
  }),
});

type PortonePaymentResponse = {
  payment?: {
    status?: string;
    amount?: { total?: number };
    totalAmount?: number;
    paidAmount?: number;
  };
  status?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  message?: string;
};

function extractPaymentShape(payload: PortonePaymentResponse) {
  const payment = payload.payment ?? payload;
  const status = payment.status ?? payload.status ?? "";
  const amount =
    payment.amount?.total ??
    payload.amount?.total ??
    payment.totalAmount ??
    payload.totalAmount ??
    payment.paidAmount ??
    payload.paidAmount ??
    0;

  return { status, amount };
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPortoneServerEnv()) {
      return NextResponse.json({ message: "PortOne 서버 설정이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const payload = paymentBookingSchema.parse(body);

    const paymentResponse = await fetch(`https://api.portone.io/payments/${encodeURIComponent(payload.paymentId)}`, {
      headers: {
        Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const paymentJson = (await paymentResponse.json()) as PortonePaymentResponse;
    if (!paymentResponse.ok) {
      return NextResponse.json({ message: paymentJson.message ?? "결제 정보를 불러오지 못했습니다." }, { status: 400 });
    }

    const { status, amount } = extractPaymentShape(paymentJson);

    if (status !== "PAID") {
      return NextResponse.json({ message: "결제가 아직 완료되지 않았습니다." }, { status: 400 });
    }

    if (amount !== payload.expectedAmount) {
      return NextResponse.json({ message: "결제 금액이 예약 금액과 일치하지 않습니다." }, { status: 400 });
    }

    const appointment = await createCustomerBooking(payload.booking);
    return NextResponse.json({
      appointment,
      message: "결제가 완료되어 예약이 접수되었어요.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결제 완료 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
