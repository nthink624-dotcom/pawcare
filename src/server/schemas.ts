import { z } from "zod";

const bookingSlotIntervalOptions = [10, 15, 20, 30, 60] as const;

export const appointmentInputSchema = z.object({
  shopId: z.string(),
  guardianId: z.string(),
  petId: z.string(),
  serviceId: z.string(),
  customServiceName: z.string().optional().default(""),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  memo: z.string().default(""),
  source: z.enum(["owner", "customer"]).default("customer"),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string(),
  status: z.enum(["pending", "confirmed", "in_progress", "almost_done", "completed", "cancelled", "rejected", "noshow"]),
  rejectionReasonTemplate: z.string().optional(),
  rejectionReasonCustom: z.string().optional(),
  eventType: z.enum(["booking_rescheduled_confirmed"]).optional(),
});

export const appointmentEditSchema = z.object({
  appointmentId: z.string(),
  shopId: z.string(),
  serviceId: z.string(),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  memo: z.string().default(""),
});

export const guardianInputSchema = z.object({
  shopId: z.string(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  memo: z.string().default(""),
});

export const guardianUpdateSchema = z.object({
  guardianId: z.string(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  memo: z.string().default("").optional(),
  enabled: z.boolean().optional(),
  revisitEnabled: z.boolean().optional(),
});

export const guardianDeleteSchema = z.object({
  guardianId: z.string().optional(),
  guardianIds: z.array(z.string()).default([]).optional(),
});

export const guardianRestoreSchema = z.object({
  guardianId: z.string().optional(),
  guardianIds: z.array(z.string()).default([]).optional(),
});

export const petInputSchema = z.object({
  shopId: z.string(),
  guardianId: z.string(),
  name: z.string().trim().min(1),
  breed: z.string().trim().min(1),
  birthday: z.string().nullable().optional(),
  weight: z.coerce.number().nullable().optional(),
  age: z.coerce.number().nullable().optional(),
  notes: z.string().default(""),
  groomingCycleWeeks: z.coerce.number().min(1).max(52).default(4),
});

export const petUpdateSchema = z.object({
  petId: z.string(),
  name: z.string().trim().min(1),
  breed: z.string().trim().min(1),
  birthday: z.string().nullable().optional(),
});

export const serviceInputSchema = z.object({
  shopId: z.string(),
  serviceId: z.string().optional(),
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  priceType: z.enum(["fixed", "starting"]).default("starting"),
  durationMinutes: z.coerce.number().min(15).max(480),
  isActive: z.boolean().default(true),
});

export const shopSettingsSchema = z.object({
  shopId: z.string(),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  description: z.string().default(""),
  concurrentCapacity: z.coerce.number().min(1).max(5),
  bookingSlotIntervalMinutes: z.coerce.number().refine(
    (value) => bookingSlotIntervalOptions.includes(value as (typeof bookingSlotIntervalOptions)[number]),
    { message: "지원하지 않는 예약 시간 간격입니다." },
  ),
  bookingSlotOffsetMinutes: z.coerce.number().int().min(0).max(55),
  approvalMode: z.enum(["manual", "auto"]),
  regularClosedDays: z.array(z.number().min(0).max(6)),
  temporaryClosedDates: z.array(z.string()),
  businessHours: z.record(
    z.string(),
    z.object({
      open: z.string(),
      close: z.string(),
      enabled: z.boolean(),
    }),
  ),
  notificationSettings: z.object({
    enabled: z.boolean(),
    revisitEnabled: z.boolean(),
    bookingConfirmedEnabled: z.boolean(),
    bookingRejectedEnabled: z.boolean(),
    bookingCancelledEnabled: z.boolean(),
    bookingRescheduledEnabled: z.boolean(),
    groomingAlmostDoneEnabled: z.boolean(),
    groomingCompletedEnabled: z.boolean(),
  }),
}).superRefine((value, ctx) => {
  if (value.bookingSlotOffsetMinutes >= value.bookingSlotIntervalMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingSlotOffsetMinutes"],
      message: "기준 분은 예약 간격보다 작아야 합니다.",
    });
  }

  if (value.bookingSlotOffsetMinutes % 5 !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingSlotOffsetMinutes"],
      message: "기준 분은 5분 단위로 선택해 주세요.",
    });
  }
});

export const customerPageSettingsSchema = z.object({
  shopId: z.string(),
  customerPageSettings: z.object({
    shop_name: z.string().min(1),
    tagline: z.string().min(1).max(120),
    hero_image_url: z.string().default(""),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    notices: z.array(z.string()).max(3),
    operating_hours_note: z.string().default(""),
    holiday_notice: z.string().default(""),
    parking_notice: z.string().default(""),
    kakao_inquiry_url: z.string().default(""),
    show_notices: z.boolean(),
    show_parking_notice: z.boolean(),
    show_services: z.boolean(),
    booking_button_label: z.string().min(1).max(30),
    show_kakao_inquiry: z.boolean(),
    font_preset: z.enum(["soft", "clean", "classic"]),
    font_scale: z.enum(["compact", "comfortable"]),
  }),
});
