export type StaffDisplaySource = {
  name: string;
  displayName?: string | null;
  titlePrefix?: string | null;
  position?: string | null;
  role?: string | null;
};

export function getStaffCustomerName(staff: StaffDisplaySource) {
  return staff.displayName?.trim() || staff.name.trim();
}

export function getStaffPositionName(staff: StaffDisplaySource) {
  return staff.position?.trim() || staff.role?.split(/[/.|]/)[0]?.trim() || "";
}

export function getStaffCustomerTitle(staff: StaffDisplaySource) {
  const prefix = staff.titlePrefix?.trim();
  const position = getStaffPositionName(staff);
  return [prefix, position].filter(Boolean).join(" ");
}

export function getStaffCustomerInitial(staff: StaffDisplaySource) {
  return getStaffCustomerName(staff).slice(0, 1) || "스";
}
