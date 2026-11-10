import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { OwnerApiError } from "@/server/owner-api-auth";
import { communityAdmin, communityDatabaseError, resolveCommunityImages } from "@/server/community/service";

const schema = z.object({ action: z.enum(["hide", "dismiss"]), id: z.string().uuid() });
function fail(error: unknown) {
  if (error instanceof AdminApiError || error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
  return NextResponse.json({ message: "신고를 처리하지 못했습니다. 다시 시도해 주세요." }, { status: error instanceof z.ZodError ? 400 : 503 });
}
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const { data, error } = await communityAdmin().rpc("community_moderate", { p_admin: admin.id, p_action: "list" });
    if (error) communityDatabaseError(error);
    const signed = await resolveCommunityImages({ posts: data.reports });
    return NextResponse.json({ reports: signed.posts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = schema.parse(await request.json());
    const { data, error } = await communityAdmin().rpc("community_moderate", { p_admin: admin.id, p_action: body.action, p_id: body.id });
    if (error) communityDatabaseError(error);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
