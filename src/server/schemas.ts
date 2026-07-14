import { z } from "zod";

const bookingSlotIntervalOptions = [10, 15, 20, 30, 60] as const;

export const appointmentInputSchema = z.object({
  shopId: z.string(),
  guardianId: z.string(),
  petId: z.string(),
  serviceId: z.string(),
  staffId: z.string().trim().optional().nullable(),
  customServiceName: z.string().optional().default(""),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  memo: z.string().default(""),
  source: z.enum(["owner", "customer"]).default("customer"),
  visitReminderOffsetMinutes: z.coerce.number().int().min(0).max(180).optional(),
  pickupReadyEtaMinutes: z.coerce.number().int().min(0).max(180).optional(),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string(),
  status: z.enum(["confirmed", "in_progress", "almost_done", "completed", "cancelled", "rejected", "noshow"]),
  rejectionReasonTemplate: z.string().optional(),
  rejectionReasonCustom: z.string().optional(),
  eventType: z.enum(["booking_rescheduled_confirmed"]).optional(),
  mediaAssetIds: z.array(z.string()).max(10).optional(),
  notifyCustomer: z.boolean().optional().default(true),
});

export const appointmentEditSchema = z.object({
  appointmentId: z.string(),
  shopId: z.string(),
  serviceId: z.string(),
  staffId: z.string().nullable().optional(),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  durationMinutes: z.coerce.number().min(15).max(24 * 60).optional(),
  memo: z.string().default(""),
  visitReminderOffsetMinutes: z.coerce.number().int().min(0).max(180).optional(),
  pickupReadyEtaMinutes: z.coerce.number().int().min(0).max(180).optional(),
  eventType: z.enum(["booking_rescheduled_confirmed"]).optional(),
  enforceShopCapacity: z.boolean().optional().default(true),
  allowOutsideShopHours: z.boolean().optional().default(false),
  notifyCustomer: z.boolean().optional().default(true),
  preserveStatus: z.boolean().optional().default(false),
});

export const guardianInputSchema = z.object({
  shopId: z.string(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  memo: z.string().default(""),
});

export const guardianUpdateSchema = z.object({
  shopId: z.string().optional(),
  guardianId: z.string(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  memo: z.string().default("").optional(),
  enabled: z.boolean().optional(),
  revisitEnabled: z.boolean().optional(),
  notificationSettings: z.record(z.string(), z.boolean()).optional(),
});

export const guardianDeleteSchema = z.object({
  shopId: z.string().optional(),
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
  shopId: z.string().optional(),
  petId: z.string(),
  name: z.string().trim().min(1),
  breed: z.string().trim().min(1),
  birthday: z.string().nullable().optional(),
  weight: z.coerce.number().nullable().optional(),
  age: z.coerce.number().nullable().optional(),
  notes: z.string().optional(),
  groomingCycleWeeks: z.coerce.number().min(1).max(52).optional(),
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

export const staffMemberProfileSchema = z.object({
  shopId: z.string(),
  staffMemberId: z.string().optional(),
  name: z.string().trim().min(1),
  displayName: z.string().trim().optional().default(""),
  profileImageUrl: z.string().trim().optional().default(""),
  profileImageUrls: z.array(z.string().trim()).max(3).optional().default([]),
  profileImageAssetIds: z.array(z.string().trim()).max(3).optional().default([]),
  titlePrefix: z.string().trim().optional().default(""),
  position: z.string().trim().optional().default(""),
  chipColorIndex: z.coerce.number().int().min(0).max(31).nullable().optional(),
  profileMessage: z.string().trim().optional().default(""),
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
    { message: "吏?먰븯吏 ?딅뒗 ?덉빟 ?쒓컙 媛꾧꺽?낅땲??" },
  ),
  bookingSlotOffsetMinutes: z.coerce.number().int().min(0).max(55),
  bookingAvailableStartTime: z.string().default("10:00"),
  bookingAvailableEndTime: z.string().default("17:00"),
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
    appointmentReminder10mEnabled: z.boolean().default(true),
    appointmentReminder10mMode: z.enum(["manual", "auto"]).default("manual"),
    visitReminderOffsetMinutes: z.coerce.number().int().min(0).max(180).default(10),
    groomingStartedEnabled: z.boolean().default(true),
    groomingAlmostDoneEnabled: z.boolean(),
    pickupReadyEtaMinutes: z.coerce.number().int().min(0).max(180).default(5),
    groomingCompletedEnabled: z.boolean(),
    groomingStartWithoutPhotoEnabled: z.boolean().default(false),
    groomingCompleteWithoutPhotoEnabled: z.boolean().default(false),
  }),
}).superRefine((value, ctx) => {
  if (value.bookingSlotOffsetMinutes >= value.bookingSlotIntervalMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingSlotOffsetMinutes"],
      message: "湲곗? 遺꾩? ?덉빟 媛꾧꺽蹂대떎 ?묒븘???⑸땲??",
    });
  }

  if (value.bookingSlotOffsetMinutes % 5 !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingSlotOffsetMinutes"],
      message: "湲곗? 遺꾩? 5遺??⑥쐞濡??좏깮??二쇱꽭??",
    });
  }
});
