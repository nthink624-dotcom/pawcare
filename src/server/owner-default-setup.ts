import { buildDefaultOwnerServices, buildDefaultOwnerStaffMembers } from "@/lib/owner-default-setup";

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

export async function insertOwnerDefaultSetup(
  supabase: SupabaseWriter,
  params: {
    shopId: string;
    ownerName: string;
    ownerPhone?: string | null;
    now: string;
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
    if (isMissingStaffMembersTableError(staffInsert.error)) {
      console.error("[owner-signup] staff-members-table-missing", staffInsert.error.message);
      return;
    }

    throw new Error(staffInsert.error.message);
  }
}
