import { NextRequest, NextResponse } from "next/server";

import { hasPortoneServerEnv, serverEnv } from "@/lib/server-env";
import { createCustomerBooking } from "@/server/customer-bookings";
import { quoteCustomerDiscount } from "@/server/customer-discount-quote";
import { paymentBookingSchema } from "@/server/payment-booking-schema";

type PortonePaymentResponse = {
  payment?: {
    status?: string;
    orderId?: string;
    amount?: { total?: number };
    totalAmount?: number;
    paidAmount?: number;
  };
  status?: string;
  orderId?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  message?: string;
};

function extractPaymentShape(payload: PortonePaymentResponse) {
  const payment = payload.payment ?? payload;
  const status = payment.status ?? payload.status ?? "";
  const orderId = payment.orderId ?? payload.orderId ?? "";
  const amount =
    payment.amount?.total ??
    payload.amount?.total ??
    payment.totalAmount ??
    payload.totalAmount ??
    payment.paidAmount ??
    payload.paidAmount ??
    0;

  return { status, amount, orderId };
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPortoneServerEnv()) {
      return NextResponse.json({ message: "PortOne 서버 설정이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const payload = paymentBookingSchema.parse(body);
    const discountQuote = await quoteCustomerDiscount(payload.booking);

    if (payload.expectedAmount !== discountQuote.finalAmount) {
      return NextResponse.json(
        {
          message: "혜택 또는 서비스 금액이 변경되었습니다. 결제 전 최종 금액을 다시 확인해 주세요.",
          discountQuote,
        },
        { status: 409 },
      );
    }

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

    const { status, amount, orderId } = extractPaymentShape(paymentJson);

    if (status !== "PAID") {
      return NextResponse.json({ message: "결제가 아직 완료되지 않았습니다." }, { status: 400 });
    }

    if (amount !== payload.expectedAmount) {
      return NextResponse.json({ message: "결제 금액이 예약 금액과 일치하지 않습니다." }, { status: 400 });
    }
    if (!orderId || orderId !== payload.orderId) {
      return NextResponse.json({ message: "결제 주문 정보가 예약 요청과 일치하지 않습니다." }, { status: 400 });
    }

    const bookingResult = await createCustomerBooking(
      { ...payload.booking, expectedFinalAmount: discountQuote.finalAmount },
      {
        trustedDiscountQuote: discountQuote,
        payment: { paymentId: payload.paymentId, providerOrderId: orderId },
      },
    );
    return NextResponse.json({
      ...bookingResult,
      message: "결제가 완료되어 예약이 접수되었어요.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결제 완료 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
