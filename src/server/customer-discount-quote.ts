import { z } from "zod";

import {
  buildCustomerDiscountQuote,
  type CustomerDiscountQuote,
} from "@/lib/discount-coupons";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import { findCustomerBreedPricingGroup } from "@/lib/customer-breed-pricing-group";
import { currentDateInTimeZone, phoneNormalize } from "@/lib/utils";
import { getBootstrap } from "@/server/bootstrap";

export const customerDiscountQuoteInputSchema = z.object({
  shopId: z.string().min(1),
  guardianName: z.string().trim().min(1),
  phone: z.string().trim().min(10),
  serviceId: z.string().min(1),
  customerServiceOptionId: z.string().trim().optional().default(""),
  breed: z.string().trim().optional().default(""),
  appointmentDate: z.string().trim().optional().default(""),
});

export type CustomerDiscountQuoteResponse = CustomerDiscountQuote & {
  customerRecognized: boolean;
  customerServiceOptionId: string;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export async function quoteCustomerDiscount(input: unknown): Promise<CustomerDiscountQuoteResponse> {
  const payload = customerDiscountQuoteInputSchema.parse(input);
  const bootstrap = await getBootstrap(payload.shopId, {
    includeNotifications: false,
    includeGroomingRecords: false,
    includeLanding: false,
  });
  const normalizedPhone = phoneNormalize(payload.phone);
  const normalizedGuardianName = normalizeName(payload.guardianName);
  const guardians = bootstrap.guardians.filter(
    (guardian) =>
      phoneNormalize(guardian.phone) === normalizedPhone &&
      normalizeName(guardian.name) === normalizedGuardianName,
  );
  const guardianIds = new Set(guardians.map((guardian) => guardian.id));
  const priorAppointments = bootstrap.appointments.filter(
    (appointment) =>
      guardianIds.has(appointment.guardian_id) &&
      appointment.status !== "cancelled" &&
      appointment.status !== "rejected" &&
      appointment.status !== "noshow",
  );
  const visitType = priorAppointments.length > 0 ? "revisit" : "first_visit";
  const pricingGroup = findCustomerBreedPricingGroup(bootstrap.services, payload.breed);
  const customerServiceOptions = applyConfiguredCustomerServiceOverrides(
    buildCustomerServiceSourceOptions(bootstrap.services, {
      priceGuideOnly: true,
      priceGuideGroupKey: pricingGroup?.key,
    }),
    bootstrap.shop.customer_page_settings.customer_service_overrides,
  );
  if (payload.serviceId === "__custom__") {
    return {
      ...buildCustomerDiscountQuote({
        coupons: [],
        visitType,
        dateKey: payload.appointmentDate || currentDateInTimeZone(),
        serviceOptionIds: [],
        originalAmount: 0,
      }),
      customerRecognized: guardians.length > 0,
      customerServiceOptionId: "",
    };
  }
  const selectedOption = payload.customerServiceOptionId
    ? customerServiceOptions.find(
        (option) => option.id === payload.customerServiceOptionId && option.serviceId === payload.serviceId,
      )
    : customerServiceOptions.find((option) => option.serviceId === payload.serviceId);

  if (!selectedOption) {
    throw new Error("선택한 서비스의 할인 정보를 확인할 수 없습니다.");
  }

  const usedCouponIds = priorAppointments.flatMap((appointment) => appointment.discount_coupon_ids ?? []);
  const serviceOptionIds = Array.from(
    new Set([selectedOption.id, selectedOption.linkedOptionId].filter((value): value is string => Boolean(value))),
  );
  const quote = buildCustomerDiscountQuote({
    coupons: bootstrap.shop.customer_page_settings.discount_coupons ?? [],
    visitType,
    dateKey: payload.appointmentDate || currentDateInTimeZone(),
    serviceOptionIds,
    originalAmount: selectedOption.price,
    usedCouponIds,
  });

  return {
    ...quote,
    customerRecognized: guardians.length > 0,
    customerServiceOptionId: selectedOption.id,
  };
}
