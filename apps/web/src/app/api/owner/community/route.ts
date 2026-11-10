import { NextRequest } from "next/server";
import { z } from "zod";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { communityMutationSchema, communityReadSchema } from "@/server/community/schema";
import { cleanCommunityMedia, communityDispatch, mutateCommunity, resolveCommunityImages } from "@/server/community/service";

const CORS = { methods: "GET, POST, OPTIONS" };
const MAX_BODY = 3400000;
function reply(request: NextRequest, data: unknown, status = 200) {
  return ownerMobileCorsJson(request, data, { status, headers: { "Cache-Control": "private, no-store" } }, CORS);
}
function failure(request: NextRequest, error: unknown) {
  if (error instanceof OwnerApiError) return reply(request, { message: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return reply(request, { message: "입력 내용을 다시 확인해 주세요." }, 400);
  return reply(request, { message: "커뮤니티 요청을 처리하지 못했습니다. 다시 시도해 주세요." }, 503);
}
export async function GET(request: NextRequest) {
  try {
    const input = communityReadSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const owner = await requireOwnerShop(request, input.shopId, undefined, { deferBillingMaintenance: true });
    const result = await communityDispatch(owner, input.postId ? "detail" : "list", input);
    await cleanCommunityMedia().catch(() => undefined);
    return reply(request, await resolveCommunityImages(result));
  } catch (error) { return failure(request, error); }
}
export async function POST(request: NextRequest) {
  try {
    // Authenticate before consuming photos. Never accept a caller-supplied user ID.
    const shopId = z.string().min(1).max(100).parse(request.nextUrl.searchParams.get("shopId"));
    const owner = await requireOwnerShop(request, shopId, undefined, { deferBillingMaintenance: true });
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new OwnerApiError("첨부 용량이 큽니다.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new OwnerApiError("작성 내용을 확인해 주세요.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new OwnerApiError("첨부 용량이 큽니다.", 413); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const contentType = request.headers.get("content-type") ?? "";
    let input: unknown; let files: File[] = [];
    if (contentType.startsWith("multipart/form-data")) {
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      input = JSON.parse(String(form.get("payload") ?? ""));
      files = form.getAll("photos").filter((value): value is File => value instanceof File);
    } else if (contentType.startsWith("application/json")) {
      if (size > 80000) throw new OwnerApiError("작성 내용이 너무 깁니다.", 413);
      input = JSON.parse(bytes.toString("utf8"));
    } else throw new OwnerApiError("지원하지 않는 요청 형식입니다.", 415);
    return reply(request, await mutateCommunity(owner, communityMutationSchema.parse(input), files));
  } catch (error) { return failure(request, error); }
}
export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, CORS); }
