import { NextRequest, NextResponse } from "next/server";

import { updateCustomerAppointment } from "@/server/repositories/app-repository";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateCustomerAppointment(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "\uC608\uC57D\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." },
      { status: 400 },
    );
  }
}
