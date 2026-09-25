export type StaffDisplaySource = {
  name: string;
  displayName?: string | null;
  profileMessage?: string | null;
  profile_message?: string | null;
  titlePrefix?: string | null;
  position?: string | null;
  role?: string | null;
};

export const defaultStaffProfileMessage = "아이 성향에 맞춰 차분하게 미용해드려요.";

export function getStaffCustomerName(staff: StaffDisplaySource) {
  return staff.displayName?.trim() || staff.name.trim();
}

export function getStaffProfileMessage(staff: StaffDisplaySource) {
  return staff.profileMessage?.trim() || staff.profile_message?.trim() || defaultStaffProfileMessage;
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
