import { z } from "zod";

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

const customerAppointmentBaseSchema = z.object({
  shopId: z.string(),
  appointmentId: z.string(),
  phone: z.string().min(8),
});

export const customerAppointmentMutationSchema = z.discriminatedUnion("action", [
  customerAppointmentBaseSchema.extend({
    action: z.literal("cancel"),
  }),
  customerAppointmentBaseSchema.extend({
    action: z.literal("reschedule"),
    serviceId: z.string(),
    appointmentDate: z.string(),
    appointmentTime: z.string(),
    memo: z.string().default(""),
  }),
]);

export const guardianInputSchema = z.object({
  shopId: z.string(),
  name: z.string().min(1),
  phone: z.string().min(8),
  memo: z.string().default(""),
});

export const guardianNotificationSettingsSchema = z.object({
  guardianId: z.string(),
  enabled: z.boolean(),
  revisitEnabled: z.boolean(),
});

export const petInputSchema = z.object({
  shopId: z.string(),
  guardianId: z.string(),
  name: z.string().min(1),
  breed: z.string().min(1),
  weight: z.coerce.number().nullable(),
  age: z.coerce.number().nullable(),
  notes: z.string().default(""),
  birthday: z.string().nullable().optional().default(null),
  groomingCycleWeeks: z.coerce.number().min(1).max(12).default(4),
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

export const recordInputSchema = z.object({
  recordId: z.string(),
  styleNotes: z.string().default(""),
  memo: z.string().default(""),
  pricePaid: z.coerce.number().min(0),
  serviceId: z.string(),
});

export const shopSettingsSchema = z.object({
  shopId: z.string(),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  description: z.string().default(""),
  concurrentCapacity: z.coerce.number().min(1).max(5),
  approvalMode: z.enum(["manual", "auto"]),
  regularClosedDays: z.array(z.number().min(0).max(6)),
  temporaryClosedDates: z.array(z.string()),
  businessHours: z.record(z.string(), z.object({
    open: z.string(),
    close: z.string(),
    enabled: z.boolean(),
  })),
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

export const landingInterestSchema = z.object({
  shopName: z.string().min(1),
  ownerName: z.string().min(1),
  phone: z.string().min(8),
  needs: z.array(z.string()).default([]),
});

export const landingFeedbackSchema = z.object({
  type: z.enum(["feature", "bug", "idea"]),
  text: z.string().min(3),
});

export const petUpdateSchema = z.object({
  petId: z.string(),
  name: z.string().min(1),
  breed: z.string().min(1),
  birthday: z.string().nullable().optional().default(null),
});

