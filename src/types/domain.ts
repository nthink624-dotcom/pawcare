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
  | "booking_time_proposed"
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
export type PetBiteLevel = "none" | "mild" | "watch" | "bite" | "strong";
export type MediaKind =
  | "grooming_before"
  | "grooming_after"
  | "grooming_result"
  | "message_image"
  | "shop_profile"
  | "customer_shared"
  | "memo_attachment";
export type MediaVisibility = "private" | "customer_shared" | "public";
export type MediaStatus = "uploading" | "uploaded" | "processing" | "ready" | "failed" | "deleted";
export type MediaRetentionPolicy = "transient" | "standard" | "archive";
export type MediaUploadSource = "owner_web" | "owner_mobile" | "customer_page" | "system";
export type MediaVariantKey = "thumbnail" | "preview" | "optimized" | "provider_ready";
export type NotificationMediaAttachmentRole = "message_image" | "before_photo" | "after_photo" | "result_photo" | "receipt" | "other";
export type MediaSendStatus = "queued" | "sent" | "failed" | "skipped";

export type ShopNotificationSettings = {
  enabled: boolean;
  revisit_enabled: boolean;
  booking_confirmed_enabled: boolean;
  booking_rejected_enabled: boolean;
  booking_cancelled_enabled: boolean;
  booking_rescheduled_enabled: boolean;
  appointment_reminder_10m_enabled: boolean;
  visit_reminder_offset_minutes: number;
  grooming_started_enabled: boolean;
  grooming_almost_done_enabled: boolean;
  pickup_ready_eta_minutes: number;
  grooming_completed_enabled: boolean;
  grooming_start_without_photo_enabled: boolean;
  grooming_complete_without_photo_enabled: boolean;
};

export type GuardianNotificationSettings = {
  enabled: boolean;
  revisit_enabled: boolean;
  booking_confirmed_enabled: boolean;
  booking_rejected_enabled: boolean;
  booking_cancelled_enabled: boolean;
  booking_rescheduled_enabled: boolean;
  appointment_reminder_10m_enabled: boolean;
  grooming_started_enabled: boolean;
  grooming_almost_done_enabled: boolean;
  grooming_completed_enabled: boolean;
  birthday_greeting_enabled: boolean;
};

export type CustomerPageSettings = {
  shop_name: string;
  tagline: string;
  hero_image_url: string;
  hero_image_urls?: string[];
  showcase_title?: string;
  showcase_body?: string;
  social_links?: {
    instagram_url?: string;
    kakao_channel_url?: string;
    tiktok_url?: string;
    threads_url?: string;
  };
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
  business_category?: string;
  additional_contact?: string;
  postal_code?: string;
  address_detail?: string;
  customer_service_overrides?: Record<
    string,
      {
        visible?: boolean;
        order?: number;
        displayName?: string;
        description?: string;
        linkedOptionId?: string;
      }
    >;
    discount_coupons?: CustomerDiscountCoupon[];
  };

export type CustomerDiscountCoupon = {
  id: string;
  name: string;
  enabled: boolean;
  visible: boolean;
  discount_type: "fixed" | "percent";
  discount_value: number;
  audience: "all" | "first_visit" | "revisit";
  service_scope: "all" | "specific";
  service_option_ids: string[];
  per_customer_limit: boolean;
  starts_at?: string;
  ends_at?: string;
};

export type BookingBlockedWindow = {
  id?: string;
  start: string;
  end: string;
  label?: string;
};

export type RegularClosedCycle = "weekly" | "biweekly" | "monthly_1_3" | "monthly_2_4";

export type ReservationPolicySettings = {
  cancel_window: "none" | "1h" | "2h" | "6h" | "24h";
  customer_change_enabled: boolean;
  pending_hold_limit?: 1;
  booking_blocked_windows?: BookingBlockedWindow[];
  regular_closed_cycle?: RegularClosedCycle;
  regular_closed_anchor_date?: string | null;
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
  regular_closed_cycle?: RegularClosedCycle;
  regular_closed_anchor_date?: string | null;
  temporary_closed_dates: string[];
  concurrent_capacity: number;
  booking_slot_interval_minutes: number;
  booking_slot_offset_minutes: number;
  booking_available_start_time: string;
  booking_available_end_time: string;
  approval_mode: ApprovalMode;
  reservation_policy_settings?: ReservationPolicySettings;
  notification_settings: ShopNotificationSettings;
  customer_page_settings: CustomerPageSettings;
  created_at: string;
  updated_at: string;
};

export type OwnerProfile = {
  user_id: string;
  shop_id: string;
  login_id: string;
  name: string;
  birth_date: string | null;
  phone_number: string | null;
  identity_verified_at?: string | null;
  agreements?: Record<string, unknown>;
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
  bite_level?: PetBiteLevel;
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
  category?: string;
  description?: string;
  sort_order?: number;
  capacity_label?: string;
  staff_selection_mode?: "all" | "unassigned" | "specific";
  price_guide?: unknown;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  service_id: string;
  staff_id?: string | null;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  memo: string;
  rejection_reason: string | null;
  start_at: string;
  end_at: string;
  actual_started_at?: string | null;
  actual_completed_at?: string | null;
  visit_reminder_offset_minutes?: number;
  pickup_ready_eta_minutes?: number;
  source: "owner" | "customer";
  created_at: string;
  updated_at: string;
};

export type AppointmentChangeEventType = "status" | "details";

export type AppointmentChangeEvent = {
  id: string;
  shop_id: string;
  appointment_id: string;
  event_type: AppointmentChangeEventType;
  previous_values: Record<string, unknown>;
  next_values: Record<string, unknown>;
  note: string | null;
  created_at: string;
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

export type PetStaffNote = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string | null;
  note: string;
  note_scope: "staff_shared" | "owner_private";
  source: "owner_web" | "owner_mobile" | "system";
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BootstrapStaffMember = {
  id: string;
  name: string;
  displayName?: string;
  profileImageUrl?: string;
  chipColorIndex?: number | null;
  phone: string;
  role: string;
  titlePrefix?: string;
  position?: string;
  defaultDays: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  startTime: string;
  endTime: string;
  regularOff: string;
  annualRemain: number;
  todayBookings: number;
  weekBookings: number;
};

export type StaffScheduleOverride = {
  id: string;
  shop_id: string;
  staff_id: string;
  work_date: string;
  status: "work" | "off" | "annual" | "half";
  start_time: string | null;
  end_time: string | null;
  period: "오전" | "오후" | null;
  reason: string | null;
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

export type MediaAsset = {
  id: string;
  shop_id: string;
  guardian_id: string | null;
  pet_id: string | null;
  appointment_id: string | null;
  grooming_record_id: string | null;
  bucket: string;
  storage_path: string;
  original_file_name: string | null;
  content_type: string;
  byte_size: number;
  source_byte_size?: number | null;
  width: number | null;
  height: number | null;
  checksum_sha256: string | null;
  media_kind: MediaKind;
  visibility: MediaVisibility;
  status: MediaStatus;
  retention_policy: MediaRetentionPolicy;
  uploaded_by_user_id: string | null;
  uploaded_from: MediaUploadSource;
  metadata: Record<string, string | boolean | number | null>;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  deleted_at: string | null;
};

export type MediaVariant = {
  id: string;
  media_asset_id: string;
  variant_key: MediaVariantKey;
  bucket: string;
  storage_path: string;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type NotificationMediaAttachment = {
  id: string;
  shop_id: string;
  notification_id: string;
  media_asset_id: string;
  guardian_id: string | null;
  pet_id: string | null;
  appointment_id: string | null;
  attachment_role: NotificationMediaAttachmentRole;
  sort_order: number;
  channel: ChannelType | string;
  provider: string | null;
  provider_media_id: string | null;
  provider_media_url: string | null;
  send_status: MediaSendStatus;
  sent_at: string | null;
  fail_reason: string | null;
  metadata: Record<string, string | boolean | number | null>;
  created_at: string;
};

export type MediaSendAttempt = {
  id: string;
  shop_id: string;
  notification_id: string | null;
  notification_media_attachment_id: string | null;
  media_asset_id: string;
  guardian_id: string | null;
  pet_id: string | null;
  appointment_id: string | null;
  channel: ChannelType | string;
  provider: string | null;
  provider_message_id: string | null;
  provider_media_id: string | null;
  recipient_phone: string | null;
  status: MediaSendStatus;
  fail_reason: string | null;
  sent_at: string | null;
  metadata: Record<string, string | boolean | number | null>;
  created_at: string;
};

export type AlimtalkCreditSummary = {
  shop_id: string;
  included_total: number;
  included_used: number;
  included_remaining: number;
  included_period_started_at: string | null;
  included_period_ends_at: string | null;
  purchased_total: number;
  purchased_used: number;
  purchased_remaining: number;
  remaining_total: number;
  updated_at: string | null;
};

export type ShopMediaUsageMonth = {
  shop_id: string;
  usage_month: string;
  uploaded_asset_count: number;
  uploaded_bytes: number;
  sent_asset_count: number;
  sent_bytes: number;
  updated_at: string;
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
  ownerProfile?: OwnerProfile | null;
  guardians: Guardian[];
  deletedGuardians?: Guardian[];
  pets: Pet[];
  services: Service[];
  staffMembers: BootstrapStaffMember[];
  staffScheduleOverrides?: StaffScheduleOverride[];
  appointments: Appointment[];
  appointmentChangeEvents?: AppointmentChangeEvent[];
  groomingRecords: GroomingRecord[];
  petStaffNotes?: PetStaffNote[];
  notifications: Notification[];
  alimtalkCreditSummary?: AlimtalkCreditSummary | null;
  landingInterests: LandingInterest[];
  landingFeedback: LandingFeedback[];
};



