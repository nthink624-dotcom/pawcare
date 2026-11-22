import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { OwnerApiError } from "@/server/owner-api-auth";
import { manageCommunityResources, resourceMutationSchema, resourcePageSchema } from "@/server/community/resources";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const known = error instanceof AdminApiError || error instanceof OwnerApiError;
  return NextResponse.json({ message: known ? error.message : error instanceof z.ZodError || error instanceof SyntaxError ? "입력 내용을 다시 확인해 주세요." : "소식을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: known ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503, headers });
}
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const page = resourcePageSchema.parse(request.nextUrl.searchParams.get("page") ?? undefined);
    return NextResponse.json(await manageCommunityResources(admin.id, "list", { page }), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const origin = request.headers.get("origin");
    let sameOrigin = true;
    if (origin) {
      try {
        // NextURL normalizes loopback IPs to localhost; Host retains the
        // browser's actual authority. Keep protocol and host checks together.
        const expected = new URL(request.nextUrl.origin);
        const host = request.headers.get("host");
        if (host) expected.host = host;
        sameOrigin = new URL(origin).origin === expected.origin;
      } catch { sameOrigin = false; }
    }
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") throw new AdminApiError("허용되지 않은 요청입니다.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OwnerApiError("지원하지 않는 요청 형식입니다.", 415);
    if (Number(request.headers.get("content-length") ?? 0) > 40000) throw new OwnerApiError("작성 내용이 너무 깁니다.", 413);
    const reader = request.body?.getReader(); if (!reader) throw new OwnerApiError("작성 내용을 확인해 주세요.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 40000) { await reader.cancel(); throw new OwnerApiError("작성 내용이 너무 깁니다.", 413); } chunks.push(value); }
    const payload = resourceMutationSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return NextResponse.json(await manageCommunityResources(admin.id, payload.action, payload), { headers });
  } catch (error) { return failure(error); }
}
