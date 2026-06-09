export type OwnerWebWeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type OwnerWebStaffMember = {
  id: string;
  name: string;
  displayName?: string;
  profileImageUrl?: string;
  phone: string;
  role: string;
  titlePrefix?: string;
  position?: string;
  defaultDays: OwnerWebWeekdayKey[];
  startTime: string;
  endTime: string;
  regularOff: string;
  annualRemain: number;
  todayBookings: number;
  weekBookings: number;
};

export type OwnerWebStaffColumn = {
  key: string;
  name: string;
  role: string;
  displayName?: string;
  titlePrefix?: string;
  position?: string;
  profileImageUrl?: string;
};

export const ownerWebStaffStorageKey = "petmanager.ownerWeb.staffMembers";
export const demoOwnerWebStaffStorageKey = "petmanager.demo.ownerWeb.staffMembers";

export const defaultOwnerWebStaff: OwnerWebStaffMember[] = [
  {
    id: "staff-1",
    name: "정우진",
    displayName: "정우진",
    titlePrefix: "대표",
    phone: "010-8498-2077",
    role: "대표 디자이너 / 전체 미용",
    position: "디자이너",
    defaultDays: ["mon", "tue", "thu", "fri", "sat"],
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "수, 일",
    annualRemain: 8,
    todayBookings: 4,
    weekBookings: 18,
  },
  {
    id: "staff-2",
    name: "서하늘",
    displayName: "서현",
    phone: "010-1234-5678",
    role: "디자이너 / 목욕",
    position: "디자이너",
    defaultDays: ["mon", "wed", "thu", "fri", "sat"],
    startTime: "11:00",
    endTime: "20:00",
    regularOff: "화, 일",
    annualRemain: 5,
    todayBookings: 3,
    weekBookings: 14,
  },
  {
    id: "staff-3",
    name: "민서윤",
    displayName: "서윤",
    phone: "010-3333-4411",
    role: "디자이너 / 위생 미용",
    position: "디자이너",
    defaultDays: ["tue", "wed", "thu", "fri", "sat"],
    startTime: "10:00",
    endTime: "18:00",
    regularOff: "월, 일",
    annualRemain: 6,
    todayBookings: 2,
    weekBookings: 11,
  },
  {
    id: "staff-4",
    name: "강리오",
    displayName: "리오",
    phone: "010-5555-9081",
    role: "목욕 / 부분 미용",
    position: "목욕 담당",
    defaultDays: ["mon", "tue", "wed", "fri", "sat"],
    startTime: "10:00",
    endTime: "17:00",
    regularOff: "목, 일",
    annualRemain: 4,
    todayBookings: 3,
    weekBookings: 13,
  },
  {
    id: "staff-5",
    name: "오다운",
    displayName: "다운",
    phone: "010-7777-1102",
    role: "파트타임 / 목욕",
    position: "파트타임",
    defaultDays: ["wed", "thu", "fri", "sat"],
    startTime: "13:00",
    endTime: "19:00",
    regularOff: "월, 화, 일",
    annualRemain: 3,
    todayBookings: 1,
    weekBookings: 7,
  },
  {
    id: "staff-6",
    name: "한지우",
    displayName: "지우",
    phone: "010-9090-1024",
    role: "파트타임 / 보조",
    position: "파트타임",
    defaultDays: ["mon", "tue", "sat"],
    startTime: "12:00",
    endTime: "18:00",
    regularOff: "수, 목, 금, 일",
    annualRemain: 2,
    todayBookings: 0,
    weekBookings: 4,
  },
  {
    id: "staff-7",
    name: "윤하나",
    displayName: "하나",
    phone: "010-2323-1188",
    role: "미용 보조 / 목욕",
    position: "미용 보조",
    defaultDays: ["mon", "wed", "thu", "sat"],
    startTime: "11:00",
    endTime: "18:00",
    regularOff: "화, 금, 일",
    annualRemain: 2,
    todayBookings: 1,
    weekBookings: 5,
  },
];

export function toOwnerWebStaffColumn(staff: OwnerWebStaffMember): OwnerWebStaffColumn {
  const title = [staff.titlePrefix?.trim(), staff.position?.trim()].filter(Boolean).join(" ");

  return {
    key: staff.id,
    name: staff.displayName?.trim() || staff.name,
    role: title || staff.role,
    displayName: staff.displayName,
    titlePrefix: staff.titlePrefix,
    position: staff.position,
    profileImageUrl: staff.profileImageUrl,
  };
}

export function parseStoredOwnerWebStaff(value: string | null): OwnerWebStaffMember[] | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;

    const staff = parsed.filter((item): item is OwnerWebStaffMember => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<OwnerWebStaffMember>;
      return typeof row.id === "string" && typeof row.name === "string" && typeof row.role === "string";
    });

    return staff.length > 0
      ? staff.map((item) => ({
          ...item,
          displayName: item.displayName ?? "",
          profileImageUrl: item.profileImageUrl ?? "",
          titlePrefix: item.titlePrefix ?? "",
          position: item.position?.trim() || item.role.split(/[/.|]/)[0]?.trim() || "스태프",
        }))
      : null;
  } catch {
    return null;
  }
}
