import { NextRequest, NextResponse } from "next/server";
import { OwnerApiError, requestCanonicalApi } from "@/server/owner-api-auth";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !["hours", "staff"].includes(body.step) || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
      return NextResponse.json({ message: "초기 설정 내용을 확인해 주세요." }, { status: 400 });
    }
    const result = await requestCanonicalApi({
      request,
      path: body.step === "hours" ? "/api/owner/initial-setup/hours" : "/api/staff-members",
      method: "PATCH",
      body: body.payload,
      auth: "required",
    });
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof OwnerApiError ? error.message : "설정을 저장하지 못했어요. 다시 시도해 주세요." }, { status: error instanceof OwnerApiError ? error.status : 400 });
  }
}
