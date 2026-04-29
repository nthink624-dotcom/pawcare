export type ApprovalMode = "manual" | "auto";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "almost_done"
  | "completed"
  | "cancelled"
  | "rejected"
  | "noshow";

export type NotificationType =
  | "booking_received"
  | "booking_confirmed"
  | "owner_booking_requested"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_rescheduled_confirmed"
  | "appointment_reminder_10m"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "landing_feedback"
  | "waitlist_interest"
  | "birthday_greeting";

export type ChannelType = "alimtalk" | "sms" | "in_app" | "mock";
export type NotificationStatus = "queued" | "sent" | "failed" | "mocked" | "skipped";

export type ShopNotificationSettings = {
  enabled: boolean;
  revisit_enabled: boolean;
  booking_confirmed_enabled: boolean;
  booking_rejected_enabled: boolean;
  booking_cancelled_enabled: boolean;
  booking_rescheduled_enabled: boolean;
  grooming_almost_done_enabled: boolean;
  grooming_completed_enabled: boolean;
};

export type GuardianNotificationSettings = {
  enabled: boolean;
  revisit_enabled: boolean;
};

export type CustomerPageSettings = {
  shop_name: string;
  tagline: string;
  hero_image_url: string;
  primary_color: string;
  notices: string[];
  operating_hours_note: string;
  holiday_notice: string;
  parking_notice: string;
  kakao_inquiry_url: string;
  show_notices: boolean;
  show_parking_notice: boolean;
  show_services: boolean;
  booking_button_label: string;
  show_kakao_inquiry: boolean;
  font_preset: "soft" | "clean" | "classic";
  font_scale: "compact" | "comfortable";
};

export type BusinessHours = Partial<
  Record<
    number,
    {
      open: string;
      close: string;
      enabled: boolean;
    }
  >
>;

export type Shop = {
  id: string;
  owner_user_id?: string | null;
  name: string;
  phone: string;
  address: string;
  description: string;
  business_hours: BusinessHours;
  regular_closed_days: number[];
  temporary_closed_dates: string[];
  concurrent_capacity: number;
  booking_slot_interval_minutes: number;
  booking_slot_offset_minutes: number;
  approval_mode: ApprovalMode;
  notification_settings: ShopNotificationSettings;
  customer_page_settings: CustomerPageSettings;
  created_at: string;
  updated_at: string;
};

export type Guardian = {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  memo: string;
  notification_settings: GuardianNotificationSettings;
  deleted_at?: string | null;
  deleted_restore_until?: string | null;
  created_at: string;
  updated_at: string;
};

export type Pet = {
  id: string;
  shop_id: string;
  guardian_id: string;
  name: string;
  breed: string;
  weight: number | null;
  age: number | null;
  notes: string;
  birthday: string | null;
  grooming_cycle_weeks: number;
  avatar_seed: string;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  price_type?: "fixed" | "starting";
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  memo: string;
  rejection_reason: string | null;
  start_at: string;
  end_at: string;
  source: "owner" | "customer";
  created_at: string;
  updated_at: string;
};

export type GroomingRecord = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  service_id: string;
  appointment_id: string | null;
  style_notes: string;
  memo: string;
  price_paid: number;
  groomed_at: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  shop_id: string;
  appointment_id: string | null;
  pet_id: string | null;
  guardian_id: string | null;
  type: NotificationType;
  channel: ChannelType;
  message: string;
  status: NotificationStatus;
  template_key?: string | null;
  template_type?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  recipient_phone?: string | null;
  fail_reason?: string | null;
  scheduled_at?: string | null;
  metadata?: Record<string, string | boolean | number | null>;
  sent_at: string | null;
  created_at: string;
};

export type LandingInterest = {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  needs: string[];
  created_at: string;
};

export type LandingFeedback = {
  id: string;
  type: "feature" | "bug" | "idea";
  text: string;
  created_at: string;
};

export type BootstrapPayload = {
  mode: "mock" | "supabase";
  shop: Shop;
  guardians: Guardian[];
  deletedGuardians?: Guardian[];
  pets: Pet[];
  services: Service[];
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  notifications: Notification[];
  landingInterests: LandingInterest[];
  landingFeedback: LandingFeedback[];
};



