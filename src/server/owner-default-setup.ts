import { buildDefaultOwnerServices, buildDefaultOwnerStaffMembers } from "@/lib/owner-default-setup";

type SupabaseWriter = {
  from: (table: string) => any;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

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
    throw new Error(staffInsert.error.message);
  }
}
