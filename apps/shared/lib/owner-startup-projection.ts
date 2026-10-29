/** Keep canonical row IDs and booking inputs; omit identity, messages, photos and report bodies. */
export function isOwnerStartupPresentation(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("ownerStartupProjection" in value)) return false;
  const marker = value.ownerStartupProjection;
  return Boolean(marker && typeof marker === "object" && "coverage" in marker && marker.coverage === "booking_inputs");
}

export function projectOwnerStartupBootstrap<T extends { mode: string; shop: { id: string }; actor?: { shopId: string; userId?: string; role?: string; staffId?: string | null } }>(input: T): T {
  const value = input as unknown as Record<string, unknown>;
  const rows = (name: string) => Array.isArray(value[name]) ? value[name] as Record<string, unknown>[] : [];
  const shopId = input.shop.id;
  for (const name of ["guardians", "pets", "services", "staffMembers", "appointments", "groomingRecords"]) {
    if (!Array.isArray(value[name])) throw new Error("Startup snapshot requires a complete canonical booking projection");
  }
  if (input.mode !== "supabase" || input.actor?.shopId !== shopId || !input.actor.userId) throw new Error("Startup snapshot requires a canonical scoped response");
  if (!["owner", "manager", "staff"].includes(input.actor.role ?? "")) throw new Error("Startup snapshot requires a canonical scoped response");
  if (input.actor.role === "staff" && (!input.actor.staffId || rows("appointments").some(row => row.staff_id !== input.actor?.staffId))) {
    throw new Error("Startup snapshot exceeds the assigned staff scope");
  }
  for (const name of ["guardians", "pets", "services", "appointments", "groomingRecords", "staffScheduleOverrides"]) {
    if (rows(name).some(row => row.shop_id !== shopId)) throw new Error("Startup snapshot contains another shop");
  }
  const pick = (row: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));
  const guardianFields = ["id", "shop_id", "name", "phone", "notification_settings", "customer_grade_override", "customer_member_type", "created_at", "updated_at"];
  const petFields = ["id", "shop_id", "guardian_id", "name", "breed", "pricing_group", "weight", "age", "age_reference_year", "birthday", "bite_level", "grooming_cycle_weeks", "avatar_seed", "created_at", "updated_at"];
  const staffFields = ["id", "name", "displayName", "chipColorIndex", "role", "titlePrefix", "position", "defaultDays", "startTime", "endTime", "regularOff", "annualRemain", "created_at", "updated_at"];
  const appointmentFields = ["id", "shop_id", "guardian_id", "pet_id", "service_id", "staff_id", "appointment_date", "appointment_time", "status", "start_at", "end_at", "actual_start_at", "actual_end_at", "source", "visit_type", "created_at", "updated_at"];
  const recordFields = ["id", "shop_id", "guardian_id", "pet_id", "service_id", "appointment_id", "price_paid", "actual_duration_minutes", "expected_duration_minutes", "pet_weight_snapshot", "groomed_at", "created_at", "updated_at"];
  return {
    ownerStartupProjection: { version: 1, coverage: "booking_inputs" },
    actor: input.actor,
    mode: "supabase",
    shop: input.shop,
    initialSetupReadiness: value.initialSetupReadiness,
    guardians: rows("guardians").map(row => ({ ...pick(row, guardianFields), memo: "" })),
    pets: rows("pets").map(row => ({ ...pick(row, petFields), notes: "" })),
    staffMembers: rows("staffMembers").map(row => pick(row, staffFields)),
    services: rows("services"),
    appointments: rows("appointments").map(row => ({ ...pick(row, appointmentFields), memo: "", staff_memo: "", rejection_reason: "" })),
    staffScheduleOverrides: rows("staffScheduleOverrides").map(row => ({ ...row, reason: null })),
    groomingRecords: rows("groomingRecords").map(row => ({ ...pick(row, recordFields), memo: "", style_notes: "" })),
    notifications: [],
    landingInterests: [],
    landingFeedback: [],
  } as unknown as T;
}
