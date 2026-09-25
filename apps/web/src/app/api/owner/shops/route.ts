import { NextRequest } from "next/server";
import { z } from "zod";

import { MAX_CUSTOMER_PAGE_HERO_IMAGES, normalizeDiscountCoupons } from "@/lib/customer-page-settings";
import {
  coerceEnabledShopNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { getSupabaseServerRuntimeStage, hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import {
  assertOwnerOrManager,
  assertServerManagedAccountActive,
  loadOwnerShopAccessForUser,
  OwnerApiError,
  requireOwnerShop,
} from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete, OWNER_INITIAL_SETUP_REQUIRED_MESSAGE } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import {
  assertShopIdentityChangeLimit,
  buildShopIdentityChanges,
  insertShopIdentityChangeEvents,
  type ShopIdentityChange,
} from "@/server/shop-identity-guard";
import type { ShopNotificationSettings } from "@/types/domain";

const SHOP_WRITE_CORS = { methods: "GET, PATCH, OPTIONS" };

const notificationSettingsPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    revisitEnabled: z.boolean().optional(),
    bookingConfirmedEnabled: z.boolean().optional(),
    bookingCancelledEnabled: z.boolean().optional(),
    bookingRescheduledEnabled: z.boolean().optional(),
    groomingAlmostDoneEnabled: z.boolean().optional(),
    groomingCompletedEnabled: z.boolean().optional(),
    groomingStartWithoutPhotoEnabled: z.boolean().optional(),
    groomingCompleteWithoutPhotoEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, "알림톡 설정을 다시 확인해 주세요.");

const updateShopSchema = z.object({
  shopId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().trim().max(120).optional(),
  heroImageUrl: z.string().trim().max(2000).optional(),
  heroImageUrls: z.array(z.string().trim().max(2000)).max(MAX_CUSTOMER_PAGE_HERO_IMAGES).optional(),
  heroMediaAssetIds: z.array(z.string().trim().min(1)).max(MAX_CUSTOMER_PAGE_HERO_IMAGES).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  address: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(500).optional(),
  showcaseTitle: z.string().trim().max(60).optional(),
  showcaseBody: z.string().trim().max(220).optional(),
  socialLinks: z
    .object({
      instagram_url: z.string().trim().max(500).optional(),
      kakao_channel_url: z.string().trim().max(500).optional(),
      naver_blog_url: z.string().trim().max(500).optional(),
      tiktok_url: z.string().trim().max(500).optional(),
      threads_url: z.string().trim().max(500).optional(),
    })
    .optional(),
  businessCategory: z.string().trim().min(1).max(40).optional(),
  additionalContact: z.string().trim().max(30).optional(),
  postalCode: z.string().trim().max(20).optional(),
  addressDetail: z.string().trim().max(120).optional(),
  // 구버전 앱 요청은 수신하되 제품 공통 예약 정책을 바꾸지는 않습니다.
  cancelWindow: z.enum(["none", "1h", "2h", "6h", "24h"]).optional(),
  notificationSettings: notificationSettingsPatchSchema.optional(),
  expectedUpdatedAt: z.string().trim().min(1).max(64).optional(),
  discountCoupons: z.unknown().optional(),
});

function toStoredNotificationSettings(patch: z.infer<typeof notificationSettingsPatchSchema>) {
  return {
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.revisitEnabled !== undefined ? { revisit_enabled: patch.revisitEnabled } : {}),
    ...(patch.bookingConfirmedEnabled !== undefined ? { booking_confirmed_enabled: patch.bookingConfirmedEnabled } : {}),
    ...(patch.bookingCancelledEnabled !== undefined ? { booking_cancelled_enabled: patch.bookingCancelledEnabled } : {}),
    ...(patch.bookingRescheduledEnabled !== undefined ? { booking_rescheduled_enabled: patch.bookingRescheduledEnabled } : {}),
    ...(patch.groomingAlmostDoneEnabled !== undefined ? { grooming_almost_done_enabled: patch.groomingAlmostDoneEnabled } : {}),
    ...(patch.groomingCompletedEnabled !== undefined ? { grooming_completed_enabled: patch.groomingCompletedEnabled } : {}),
    ...(patch.groomingStartWithoutPhotoEnabled !== undefined
      ? { grooming_start_without_photo_enabled: patch.groomingStartWithoutPhotoEnabled }
      : {}),
    ...(patch.groomingCompleteWithoutPhotoEnabled !== undefined
      ? { grooming_complete_without_photo_enabled: patch.groomingCompleteWithoutPhotoEnabled }
      : {}),
  } satisfies Partial<ShopNotificationSettings>;
}

function toMobileNotificationSettingsReadback(settings: Partial<ShopNotificationSettings> | null | undefined) {
  const normalized = normalizeShopNotificationSettings(settings);
  return {
    enabled: normalized.enabled,
    revisitEnabled: normalized.revisit_enabled,
    bookingConfirmedEnabled: normalized.booking_confirmed_enabled,
    bookingCancelledEnabled: normalized.booking_cancelled_enabled,
    bookingRescheduledEnabled: normalized.booking_rescheduled_enabled,
    groomingAlmostDoneEnabled: normalized.grooming_almost_done_enabled,
    groomingCompletedEnabled: normalized.grooming_completed_enabled,
    groomingStartWithoutPhotoEnabled: normalized.grooming_start_without_photo_enabled,
    groomingCompleteWithoutPhotoEnabled: normalized.grooming_complete_without_photo_enabled,
  };
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
      ], undefined, SHOP_WRITE_CORS);
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

    const user = userResult.data.user;
    // getUser(token) performs a network lookup, so app_metadata is not read from a stale local JWT decode.
    assertServerManagedAccountActive(user);

    const accessibleShops = await loadOwnerShopAccessForUser(user.id);
    if (accessibleShops.length === 0) {
      throw new OwnerApiError("접근할 수 있는 매장이 없습니다.", 403);
    }
    const accessibleShopIds = accessibleShops.map((access) => access.shopId);

    const shopsResult = await admin
      .from("shops")
      .select("id,name,address,customer_page_settings,created_at")
      .in("id", accessibleShopIds)
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
          .in("id", accessibleShopIds)
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
          undefined,
          SHOP_WRITE_CORS,
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
      undefined,
      SHOP_WRITE_CORS,
    );
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, SHOP_WRITE_CORS);
    }

    return ownerMobileCorsJson(request, { message: "매장 목록을 불러오지 못했습니다." }, { status: 500 }, SHOP_WRITE_CORS);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      if (getSupabaseServerRuntimeStage() === "production") {
        throw new OwnerApiError("Supabase 서버 설정이 없어 운영 매장 정보를 저장할 수 없습니다.", 503);
      }
      throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
    }

    const body = updateShopSchema.parse(await request.json());
    const heroMediaAssetIds = body.heroMediaAssetIds;
    const heroImageUrls =
      body.heroImageUrls !== undefined ? body.heroImageUrls : body.heroImageUrl !== undefined ? (body.heroImageUrl ? [body.heroImageUrl] : []) : undefined;
    const primaryHeroImageUrl = body.heroImageUrl !== undefined ? body.heroImageUrl : heroImageUrls?.[0];
    const hasNotificationSettingsUpdate = body.notificationSettings !== undefined;
    const owner = await requireOwnerShop(request, body.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new OwnerApiError("Supabase 관리자 연결을 확인해 주세요.", 503);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.description !== undefined) updates.description = body.description;
    const hasCustomerPageUpdates =
      body.name !== undefined ||
      body.tagline !== undefined ||
      body.businessCategory !== undefined ||
      body.showcaseTitle !== undefined ||
      body.showcaseBody !== undefined ||
      body.socialLinks !== undefined ||
      body.additionalContact !== undefined ||
      body.postalCode !== undefined ||
      body.addressDetail !== undefined ||
      body.heroImageUrl !== undefined ||
      body.heroImageUrls !== undefined ||
      body.heroMediaAssetIds !== undefined ||
      body.discountCoupons !== undefined;

    if (
      Object.keys(updates).length === 0 &&
      body.cancelWindow === undefined &&
      !hasNotificationSettingsUpdate &&
      !hasCustomerPageUpdates
    ) {
      throw new OwnerApiError("저장할 매장 정보가 없습니다.", 400);
    }

    const needsCurrentShop =
      hasCustomerPageUpdates ||
      body.cancelWindow !== undefined ||
      hasNotificationSettingsUpdate ||
      body.name !== undefined ||
      body.phone !== undefined ||
      body.address !== undefined ||
      body.additionalContact !== undefined;
    let currentShop: {
      name: string | null;
      phone: string | null;
      address: string | null;
      customer_page_settings: Record<string, unknown> | null;
      reservation_policy_settings: Record<string, unknown> | null;
      notification_settings: Partial<ShopNotificationSettings> | null;
      updated_at: string | null;
    } | null = null;

    if (needsCurrentShop) {
      const currentShopResult = await admin
        .from("shops")
        .select("name,phone,address,customer_page_settings,reservation_policy_settings,notification_settings,updated_at")
        .eq("id", owner.shopId)
        .eq("owner_user_id", owner.userId)
        .maybeSingle<{
          name: string | null;
          phone: string | null;
          address: string | null;
          customer_page_settings: Record<string, unknown> | null;
          reservation_policy_settings: Record<string, unknown> | null;
          notification_settings: Partial<ShopNotificationSettings> | null;
          updated_at: string | null;
        }>();

      if (currentShopResult.error) {
        throw new OwnerApiError(
          hasNotificationSettingsUpdate ? "현재 알림톡 설정을 불러오지 못했습니다." : currentShopResult.error.message,
          500,
        );
      }

      currentShop = currentShopResult.data ?? null;

      if (hasNotificationSettingsUpdate) {
        if (!currentShop) {
          throw new OwnerApiError("현재 매장 설정을 다시 확인해 주세요.", 409);
        }
        if (body.expectedUpdatedAt && currentShop.updated_at !== body.expectedUpdatedAt) {
          throw new OwnerApiError("다른 설정 변경이 반영되었습니다. 화면을 다시 확인해 주세요.", 409);
        }

        updates.notification_settings = coerceEnabledShopNotificationSettings(
          normalizeShopNotificationSettings({
            ...currentShop.notification_settings,
            ...toStoredNotificationSettings(body.notificationSettings!),
          }),
        );
        updates.updated_at = new Date().toISOString();
      }

      if (hasCustomerPageUpdates) {
        const currentCustomerPageSettings = currentShop?.customer_page_settings ?? {};
        const currentSocialLinks =
          typeof currentCustomerPageSettings.social_links === "object" && currentCustomerPageSettings.social_links
            ? currentCustomerPageSettings.social_links
            : {};
        updates.customer_page_settings = {
          ...currentCustomerPageSettings,
          ...(body.name !== undefined ? { shop_name: body.name } : {}),
          ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
          ...(body.showcaseTitle !== undefined ? { showcase_title: body.showcaseTitle } : {}),
          ...(body.showcaseBody !== undefined ? { showcase_body: body.showcaseBody } : {}),
          ...(body.socialLinks !== undefined ? { social_links: { ...currentSocialLinks, ...body.socialLinks } } : {}),
          ...(body.businessCategory !== undefined ? { business_category: body.businessCategory } : {}),
          ...(body.additionalContact !== undefined ? { additional_contact: body.additionalContact } : {}),
          ...(body.postalCode !== undefined ? { postal_code: body.postalCode } : {}),
          ...(body.addressDetail !== undefined ? { address_detail: body.addressDetail } : {}),
          ...(primaryHeroImageUrl !== undefined ? { hero_image_url: primaryHeroImageUrl } : {}),
          ...(heroImageUrls !== undefined ? { hero_image_urls: heroImageUrls } : {}),
          ...(heroMediaAssetIds !== undefined
            ? {
                hero_media_asset_id: heroMediaAssetIds[0] ?? "",
                hero_media_asset_ids: heroMediaAssetIds,
              }
            : {}),
          ...(body.discountCoupons !== undefined ? { discount_coupons: normalizeDiscountCoupons(body.discountCoupons) } : {}),
        };
      }

      if (body.cancelWindow !== undefined) {
        updates.reservation_policy_settings = {
          ...(currentShop?.reservation_policy_settings ?? {}),
          cancel_window: "2h",
          customer_change_enabled: true,
        };
      }
    }

    const currentAdditionalContact =
      typeof currentShop?.customer_page_settings?.additional_contact === "string"
        ? currentShop.customer_page_settings.additional_contact
        : "";
    const currentAddressDetail =
      typeof currentShop?.customer_page_settings?.address_detail === "string"
        ? currentShop.customer_page_settings.address_detail
        : "";
    const nextAddressBase = body.address ?? currentShop?.address ?? "";
    const nextAddressDetail = body.addressDetail ?? currentAddressDetail;
    const addressCandidate =
      body.address !== undefined || body.addressDetail !== undefined
        ? [nextAddressBase, nextAddressDetail].map((value) => value.trim()).filter(Boolean).join(" ")
        : undefined;
    const currentAddressCandidate = [currentShop?.address ?? "", currentAddressDetail]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" ");
    const identityChanges: ShopIdentityChange[] = currentShop
      ? buildShopIdentityChanges({
          current: {
            name: currentShop.name,
            phone: currentShop.phone,
            address: currentAddressCandidate,
            additional_contact: currentAdditionalContact,
          },
          next: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(addressCandidate !== undefined ? { address: addressCandidate } : {}),
            ...(body.additionalContact !== undefined ? { additional_contact: body.additionalContact } : {}),
          },
        })
      : [];
    const identityLimit = await assertShopIdentityChangeLimit({
      admin,
      shopId: owner.shopId,
      changes: identityChanges,
    });

    let updateQuery = admin
      .from("shops")
      .update(updates)
      .eq("id", owner.shopId)
      .eq("owner_user_id", owner.userId);

    if (hasNotificationSettingsUpdate && currentShop?.updated_at) {
      updateQuery = updateQuery.eq("updated_at", currentShop.updated_at);
    }

    const result = await updateQuery
      .select("id,name,phone,address,description,approval_mode,concurrent_capacity,reservation_policy_settings,customer_page_settings,notification_settings")
      .maybeSingle<{
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
        notification_settings?: Partial<ShopNotificationSettings> | null;
      }>();

    if (result.error) {
      throw new OwnerApiError(hasNotificationSettingsUpdate ? "알림톡 설정을 저장하지 못했습니다." : result.error.message, 500);
    }
    if (!result.data) {
      throw new OwnerApiError("다른 설정 변경이 반영되었습니다. 화면을 다시 확인해 주세요.", 409);
    }

    await insertShopIdentityChangeEvents({
      admin,
      shopId: owner.shopId,
      ownerUserId: owner.userId,
      changedByUserId: owner.userId,
      changes: identityChanges,
      changeGroupId: identityLimit.changeGroupId,
      source: "owner_shop_patch",
    });

    const shop = hasNotificationSettingsUpdate
      ? {
          ...result.data,
          notificationSettings: toMobileNotificationSettingsReadback(result.data.notification_settings),
        }
      : result.data;
    return ownerMobileCorsJson(request, { shop }, undefined, SHOP_WRITE_CORS);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "매장 정보를 다시 확인해 주세요." }, { status: 400 }, SHOP_WRITE_CORS);
    }

    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, SHOP_WRITE_CORS);
    }

    return ownerMobileCorsJson(request, { message: "매장 정보를 저장하지 못했습니다." }, { status: 500 }, SHOP_WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, SHOP_WRITE_CORS);
}
