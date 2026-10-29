import type { getSupabaseAdmin } from "@/lib/supabase/server";

type BundleOptions = {
  staffSelection: string;
  appointmentSelection: string;
  appointmentsFrom?: string;
  appointmentsTo?: string;
  includeOwnerProfile: boolean;
};

export type BootstrapQueryBundle = {
  shop: Record<string, unknown>;
  guardians: unknown[];
  pets: unknown[];
  services: unknown[];
  staff: unknown[];
  overrides: unknown[];
  appointments: unknown[];
  ownerProfile: unknown;
  pendingDepositPreparationExists: boolean;
};

// These are schema compatibility failures only. Network, permission and server
// failures remain errors rather than returning an incomplete success snapshot.
const legacySchemaCodes = new Set(["PGRST116", "PGRST200", "PGRST201", "PGRST204", "PGRST205", "42703", "42P01"]);

export async function loadBootstrapQueryBundle(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  shopId: string,
  options: BundleOptions,
): Promise<BootstrapQueryBundle | null> {
  const selection = [
    "*",
    "entry_guardians:guardians!guardians_shop_id_fkey(*)",
    "entry_pets:pets!pets_shop_id_fkey(*)",
    "entry_services:services!services_shop_id_fkey(*)",
    `entry_staff:staff_members!staff_members_shop_id_fkey(${options.staffSelection})`,
    "entry_overrides:staff_schedule_overrides!staff_schedule_overrides_shop_id_fkey(id,shop_id,staff_id,work_date,status,start_time,end_time,period,reason,created_at,updated_at)",
    `entry_appointments:appointments!appointments_shop_id_fkey(${options.appointmentSelection})`,
    "entry_pending_deposits:booking_preparations!booking_preparations_shop_id_fkey(appointment_id)",
    ...(options.includeOwnerProfile ? ["entry_owner_profile:owner_profiles!owner_profiles_shop_id_fkey(user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at)"] : []),
  ].join(",");
  let query = supabase.from("shops").select(selection)
    .eq("id", shopId).is("deleted_at", null)
    .order("created_at", { referencedTable: "entry_guardians" })
    .order("created_at", { referencedTable: "entry_pets" })
    .order("created_at", { referencedTable: "entry_services" })
    .eq("entry_staff.is_active", true)
    .eq("entry_pending_deposits.data->deposit->>releaseIfUnreported", "true")
    .eq("entry_pending_deposits.data->deposit->>status", "pending")
    .order("sort_order", { referencedTable: "entry_staff" })
    .order("created_at", { referencedTable: "entry_staff" })
    .order("work_date", { referencedTable: "entry_overrides" })
    .order("appointment_date", { referencedTable: "entry_appointments" })
    .order("appointment_time", { referencedTable: "entry_appointments" });
  if (options.appointmentsFrom) query = query.gte("entry_appointments.appointment_date", options.appointmentsFrom);
  if (options.appointmentsTo) query = query.lte("entry_appointments.appointment_date", options.appointmentsTo);
  const result = await query.single();
  if (result.error) {
    if (legacySchemaCodes.has(result.error.code)) return null;
    throw new Error(result.error.message);
  }
  const row = result.data as unknown as Record<string, unknown>;
  if (!row || row.id !== shopId) throw new Error("매장 시작 정보를 확인하지 못했습니다.");
  const {
    entry_guardians: guardians, entry_pets: pets, entry_services: services,
    entry_staff: staff, entry_overrides: overrides, entry_appointments: appointments,
    entry_owner_profile: profile, entry_pending_deposits: pendingDeposits, ...shop
  } = row;
  if (!Array.isArray(guardians) || !Array.isArray(pets) || !Array.isArray(services)
    || !Array.isArray(staff) || !Array.isArray(overrides) || !Array.isArray(appointments) || !Array.isArray(pendingDeposits)) {
    throw new Error("매장 시작 정보를 확인하지 못했습니다.");
  }
  // The old maybeSingle profile read yields no profile on duplicate rows.
  const ownerProfile = !options.includeOwnerProfile ? null
    : Array.isArray(profile) ? profile.length === 1 ? profile[0] : null : profile ?? null;
  return { shop, guardians, pets, services, staff, overrides, appointments, ownerProfile,
    pendingDepositPreparationExists: pendingDeposits.length > 0 };
}
