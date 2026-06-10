import { buildDefaultOwnerServices, buildDefaultOwnerStaffMembers } from "@/lib/owner-default-setup";
import { getOwnerPlanIncludedAlimtalkCredits } from "@/lib/billing/owner-plans";
import { OWNER_TRIAL_DAYS } from "@/lib/billing/owner-subscription";
import { resetShopAlimtalkIncludedCredits } from "@/server/alimtalk-credit-service";

type SupabaseWriter = {
  from: (table: string) => any;
};

type SupabaseWriteResult = {
  error: { code?: string; message: string } | null;
};

function isMissingStaffMembersTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42P01" || /staff_members|schema cache|does not exist|Could not find the table/i.test(message);
}

function isMissingStaffProfileColumnsError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "PGRST204" &&
    message.includes("staff_members") &&
    (message.includes("display_name") || message.includes("title_prefix") || message.includes("position") || message.includes("schema cache"))
  );
}

export async function insertOwnerDefaultSetup(
  supabase: SupabaseWriter,
  params: {
    shopId: string;
    ownerName: string;
    ownerPhone?: string | null;
    now: string;
    planCode?: string | null;
  },
) {
  const servicesInsert = (await supabase
    .from("services")
    .insert(buildDefaultOwnerServices(params.shopId, params.now))) as SupabaseWriteResult;
  if (servicesInsert.error) {
    throw new Error(servicesInsert.error.message);
  }

  const staffInsert = (await supabase
    .from("staff_members")
    .insert(buildDefaultOwnerStaffMembers(params))) as SupabaseWriteResult;
  if (staffInsert.error) {
    let staffSetupHandled = false;

    if (isMissingStaffProfileColumnsError(staffInsert.error)) {
      const legacyStaffMembers = buildDefaultOwnerStaffMembers(params).map(
        ({ display_name: _displayName, title_prefix: _titlePrefix, position: _position, ...staffMember }) => staffMember,
      );
      const legacyStaffInsert = (await supabase.from("staff_members").insert(legacyStaffMembers)) as SupabaseWriteResult;
      if (legacyStaffInsert.error) {
        throw new Error(legacyStaffInsert.error.message);
      }
      staffSetupHandled = true;
    }

    if (isMissingStaffMembersTableError(staffInsert.error)) {
      console.error("[owner-signup] staff-members-table-missing", staffInsert.error.message);
      staffSetupHandled = true;
    }

    if (!staffSetupHandled) {
      throw new Error(staffInsert.error.message);
    }
  }

  const trialPeriodEndsAt = new Date(params.now);
  trialPeriodEndsAt.setDate(trialPeriodEndsAt.getDate() + OWNER_TRIAL_DAYS);

  await resetShopAlimtalkIncludedCredits({
    shopId: params.shopId,
    includedAmount: getOwnerPlanIncludedAlimtalkCredits(params.planCode ?? "free"),
    periodStartedAt: params.now,
    periodEndsAt: trialPeriodEndsAt.toISOString(),
    reason: "owner_default_setup",
    metadata: {
      source: "owner_default_setup",
      planCode: params.planCode ?? "free",
    },
  });
}
