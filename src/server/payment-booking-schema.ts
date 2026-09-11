import { z } from "zod";

import { SERVICE_PRICE_MAX_KRW } from "@/lib/service-price-input";

export const paymentBookingSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  expectedAmount: z.coerce.number().int().min(0).max(SERVICE_PRICE_MAX_KRW),
  booking: z.object({
    shopId: z.string().min(1),
    guardianName: z.string().trim().min(1),
    phone: z.string().trim().min(10),
    petName: z.string().trim().min(1),
    breed: z.string().trim().optional().default(""),
    weightKg: z.coerce.number().positive().max(200),
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
    customerServiceOptionId: z.string().trim().optional().default(""),
    staffId: z.string().nullable().optional(),
    customServiceName: z.string().trim().optional().default(""),
    appointmentDate: z.string().min(1),
    appointmentTime: z.string().min(1),
    memo: z.string().optional().default(""),
    rebookingAccessToken: z.string().trim().optional().default(""),
    rebookingPetId: z.string().trim().optional().default(""),
  }),
});
