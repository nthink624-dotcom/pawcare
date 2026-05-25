import { NextRequest } from "next/server";
import { z } from "zod";

import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const updateShopSchema = z.object({
  shopId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  address: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(500).optional(),
  businessCategory: z.string().trim().min(1).max(40).optional(),
  additionalContact: z.string().trim().max(30).optional(),
  postalCode: z.string().trim().max(20).optional(),
  addressDetail: z.string().trim().max(120).optional(),
  approvalMode: z.enum(["manual", "auto"]).optional(),
  cancelWindow: z.enum(["none", "1h", "2h", "6h", "24h"]).optional(),
  pendingHoldLimit: z.coerce.number().int().min(1).max(3).optional(),
});

function isSuspendedMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.account_suspended === true;
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      if (getSupabaseServerRuntimeStage() === "production") {
        throw new OwnerApiError("Supabase 서버 설정이 없어 운영 오너 매장 정보를 불러올 수 없습니다.", 503);
      }

      return ownerMobileCorsJson(request, [
        {
          id: "demo-shop",
          name: "데모 매장",
          address: "서울시 강남구 테헤란로 1",
          heroImageUrl: "",
        },
      ]);
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    const authClient = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!authClient || !admin) {
      throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
    }

    const userResult = await authClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    if (isSuspendedMetadata(userResult.data.user.user_metadata)) {
      throw new OwnerApiError("이 계정은 운영자에 의해 일시 중지되었습니다.", 403);
    }

    const shopsResult = await admin
      .from("shops")
      .select("id,name,address,customer_page_settings,created_at")
      .eq("owner_user_id", userResult.data.user.id)
      .order("created_at");

    if (shopsResult.error) {
      const missingCustomerPageSettings =
        /customer_page_settings/i.test(
          `${shopsResult.error.message} ${shopsResult.error.details ?? ""} ${shopsResult.error.hint ?? ""}`,
        ) &&
        (/column/i.test(shopsResult.error.message) || /schema cache/i.test(shopsResult.error.message));

      if (missingCustomerPageSettings) {
        const fallbackResult = await admin
          .from("shops")
          .select("id,name,address,created_at")
          .eq("owner_user_id", userResult.data.user.id)
          .order("created_at");

        if (fallbackResult.error) {
          throw new OwnerApiError(fallbackResult.error.message, 500);
        }

        return ownerMobileCorsJson(
          request,
          (fallbackResult.data ?? []).map((shop) => ({
            id: shop.id,
            name: shop.name,
            address: shop.address,
            heroImageUrl: "",
          })),
        );
      }

      throw new OwnerApiError(shopsResult.error.message, 500);
    }

    return ownerMobileCorsJson(
      request,
      (shopsResult.data ?? []).map((shop) => ({
        id: shop.id,
        name: shop.name,
        address: shop.address,
        heroImageUrl:
          typeof shop.customer_page_settings === "object" &&
          shop.customer_page_settings &&
          "hero_image_url" in shop.customer_page_settings &&
          typeof shop.customer_page_settings.hero_image_url === "string"
            ? shop.customer_page_settings.hero_image_url
            : "",
      })),
    );
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "매장 목록을 불러오지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      if (getSupabaseServerRuntimeStage() === "production") {
        throw new OwnerApiError("Supabase 서버 설정이 없어 운영 매장 정보를 저장할 수 없습니다.", 503);
      }

      const body = updateShopSchema.parse(await request.json());
      return ownerMobileCorsJson(request, {
        shop: {
          id: body.shopId,
          name: body.name ?? "데모 매장",
          phone: body.phone ?? "",
          address: body.address ?? "",
          description: body.description ?? "",
          approval_mode: body.approvalMode ?? "manual",
          concurrent_capacity: concurrentCapacityForApprovalMode(body.approvalMode ?? "manual"),
          reservation_policy_settings: {
            cancel_window: body.cancelWindow ?? "2h",
            customer_change_enabled: body.cancelWindow !== "none",
            pending_hold_limit: body.pendingHoldLimit ?? 1,
          },
          customer_page_settings: {
            shop_name: body.name ?? "?곕え 留ㅼ옣",
            business_category: body.businessCategory ?? "애견미용",
            additional_contact: body.additionalContact ?? "",
            postal_code: body.postalCode ?? "",
            address_detail: body.addressDetail ?? "",
          },
        },
      });
    }

    const body = updateShopSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new OwnerApiError("Supabase 관리자 연결을 확인해 주세요.", 503);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.description !== undefined) updates.description = body.description;
    if (body.approvalMode !== undefined) {
      updates.approval_mode = body.approvalMode;
      updates.concurrent_capacity = concurrentCapacityForApprovalMode(body.approvalMode);
    }

    const hasCustomerPageUpdates =
      body.name !== undefined ||
      body.businessCategory !== undefined ||
      body.additionalContact !== undefined ||
      body.postalCode !== undefined ||
      body.addressDetail !== undefined;

    if (
      Object.keys(updates).length === 0 &&
      body.cancelWindow === undefined &&
      body.pendingHoldLimit === undefined &&
      !hasCustomerPageUpdates
    ) {
      throw new OwnerApiError("저장할 매장 정보가 없습니다.", 400);
    }

    if (hasCustomerPageUpdates || body.cancelWindow !== undefined || body.pendingHoldLimit !== undefined) {
      const currentShopResult = await admin
        .from("shops")
        .select("customer_page_settings,reservation_policy_settings")
        .eq("id", owner.shopId)
        .eq("owner_user_id", owner.userId)
        .maybeSingle<{
          customer_page_settings: Record<string, unknown> | null;
          reservation_policy_settings: Record<string, unknown> | null;
        }>();

      if (currentShopResult.error) {
        throw new OwnerApiError(currentShopResult.error.message, 500);
      }

      if (hasCustomerPageUpdates) {
        updates.customer_page_settings = {
          ...(currentShopResult.data?.customer_page_settings ?? {}),
          ...(body.name !== undefined ? { shop_name: body.name } : {}),
          ...(body.businessCategory !== undefined ? { business_category: body.businessCategory } : {}),
          ...(body.additionalContact !== undefined ? { additional_contact: body.additionalContact } : {}),
          ...(body.postalCode !== undefined ? { postal_code: body.postalCode } : {}),
          ...(body.addressDetail !== undefined ? { address_detail: body.addressDetail } : {}),
        };
      }

      if (body.cancelWindow !== undefined || body.pendingHoldLimit !== undefined) {
        updates.reservation_policy_settings = {
          ...(currentShopResult.data?.reservation_policy_settings ?? {}),
          ...(body.cancelWindow !== undefined
            ? {
                cancel_window: body.cancelWindow,
                customer_change_enabled: body.cancelWindow !== "none",
              }
            : {}),
          ...(body.pendingHoldLimit !== undefined ? { pending_hold_limit: body.pendingHoldLimit } : {}),
        };
      }
    }

    const result = await admin
      .from("shops")
      .update(updates)
      .eq("id", owner.shopId)
      .eq("owner_user_id", owner.userId)
      .select("id,name,phone,address,description,approval_mode,concurrent_capacity,reservation_policy_settings,customer_page_settings")
      .single<{
        id: string;
        name: string;
        phone: string;
        address: string;
        description: string;
        approval_mode: "manual" | "auto";
        concurrent_capacity: number;
        reservation_policy_settings: {
          cancel_window: "none" | "1h" | "2h" | "6h" | "24h";
          customer_change_enabled: boolean;
          pending_hold_limit?: 1 | 2 | 3;
        };
        customer_page_settings: Record<string, unknown>;
      }>();

    if (result.error) {
      throw new OwnerApiError(result.error.message, 500);
    }

    return ownerMobileCorsJson(request, { shop: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "매장 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "매장 정보를 저장하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
