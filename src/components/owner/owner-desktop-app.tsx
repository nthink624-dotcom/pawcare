"use client";

import { CalendarDays, CheckCircle2, Clock3, PawPrint, Settings, Store, Users, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { formatClockTime, shortDate } from "@/lib/utils";
import type { Appointment, BootstrapPayload } from "@/types/domain";

type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

type OwnerDesktopAppProps = {
  initialData: BootstrapPayload;
  ownedShops: OwnedShopSummary[];
  selectedShopId: string | null;
  subscriptionSummary: OwnerSubscriptionSummary | null;
  userEmail: string | null;
  onSwitchShop?: (shopId: string) => Promise<void>;
};

const statusLabels: Record<Appointment["status"], string> = {
  pending: "승인 대기",
  confirmed: "예약 확정",
  in_progress: "미용 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};

const statusClassNames: Record<Appointment["status"], string> = {
  pending: "border-[#ead5c5] bg-[#fff8f1] text-[#9a664b]",
  confirmed: "border-[#d8e6df] bg-[#f4fbf8] text-[#2f7866]",
  in_progress: "border-[#d8e6df] bg-[#f4fbf8] text-[#2f7866]",
  almost_done: "border-[#e6dfd7] bg-[#fbf8f3] text-[#6d665f]",
  completed: "border-[#d9e6e0] bg-[#f2f7f4] text-[#456b61]",
  cancelled: "border-[#ead8d2] bg-[#fff6f3] text-[#b06550]",
  rejected: "border-[#ead8d2] bg-[#fff6f3] text-[#b06550]",
  noshow: "border-[#ead8d2] bg-[#fff6f3] text-[#b06550]",
};

function getTodayInSeoul() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function DesktopSurface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[8px] border border-[#e5ded6] bg-white shadow-[0_10px_28px_rgba(34,30,24,0.05)] ${className}`.trim()}>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CalendarDays;
}) {
  return (
    <DesktopSurface className="px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-[#847c72]">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#17211f]">{value}</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-[#eef7f3] text-[#2f7866]">
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
      </div>
    </DesktopSurface>
  );
}

function StatusPill({ status }: { status: Appointment["status"] }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium ${statusClassNames[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export default function OwnerDesktopApp({
  initialData,
  ownedShops,
  selectedShopId,
  subscriptionSummary,
  userEmail,
  onSwitchShop,
}: OwnerDesktopAppProps) {
  const [activeView, setActiveView] = useState<"reservations" | "customers" | "operations">("reservations");
  const [switching, setSwitching] = useState(false);
  const data = initialData;
  const today = getTodayInSeoul();

  const serviceMap = useMemo(() => Object.fromEntries(data.services.map((service) => [service.id, service])), [data.services]);
  const petMap = useMemo(() => Object.fromEntries(data.pets.map((pet) => [pet.id, pet])), [data.pets]);
  const guardianMap = useMemo(() => Object.fromEntries(data.guardians.map((guardian) => [guardian.id, guardian])), [data.guardians]);
  const todayAppointments = useMemo(
    () =>
      data.appointments
        .filter((appointment) => appointment.appointment_date === today)
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
    [data.appointments, today],
  );
  const pendingCount = todayAppointments.filter((appointment) => appointment.status === "pending").length;
  const activeCount = todayAppointments.filter((appointment) => ["confirmed", "in_progress", "almost_done"].includes(appointment.status)).length;
  const completedCount = todayAppointments.filter((appointment) => appointment.status === "completed").length;
  const cancelledCount = todayAppointments.filter((appointment) => ["cancelled", "rejected", "noshow"].includes(appointment.status)).length;
  const recentNotifications = data.notifications.slice(0, 5);

  const navItems = [
    { key: "reservations" as const, label: "예약", icon: CalendarDays },
    { key: "customers" as const, label: "고객", icon: Users },
    { key: "operations" as const, label: "운영", icon: Settings },
  ];

  const handleShopChange = async (shopId: string) => {
    if (!onSwitchShop || shopId === selectedShopId) return;
    setSwitching(true);
    try {
      await onSwitchShop(shopId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="owner-font min-h-screen bg-[#f6f2ec] text-[#17211f]">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-[#e1d8ce] bg-[#173b33] px-4 py-5 text-white">
          <div className="flex items-center gap-3 rounded-[8px] bg-white/10 px-3 py-3">
            <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-white/12">
              <PawPrint className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-white/65">PETMANAGER</p>
              <p className="truncate text-[16px] font-semibold">{data.shop.name}</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveView(item.key)}
                  className={`flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-medium transition ${
                    active ? "bg-white text-[#173b33]" : "text-white/78 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[8px] border border-white/12 bg-white/8 px-3 py-3">
            <p className="text-[12px] font-medium text-white/60">계정</p>
            <p className="mt-1 truncate text-[13px] text-white/86">{userEmail ?? "-"}</p>
            <p className="mt-3 text-[12px] font-medium text-white/60">플랜</p>
            <p className="mt-1 text-[13px] text-white/86">{subscriptionSummary?.currentPlanCode ?? "확인 중"}</p>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-5">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-[#81786f]">{shortDate(today)}</p>
              <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-[#17211f]">오너 대시보드</h1>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedShopId ?? data.shop.id}
                disabled={switching || ownedShops.length <= 1}
                onChange={(event) => void handleShopChange(event.target.value)}
                className="h-11 min-w-[220px] rounded-[8px] border border-[#ded6cd] bg-white px-3 text-[14px] font-medium text-[#263430] outline-none"
              >
                {(ownedShops.length ? ownedShops : [{ id: data.shop.id, name: data.shop.name, address: data.shop.address, heroImageUrl: "" }]).map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
              <a
                href="/owner/billing"
                className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#d9e5df] bg-white px-4 text-[14px] font-medium text-[#2f7866]"
              >
                결제 관리
              </a>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-4 gap-3">
            <MetricTile label="승인 대기" value={`${pendingCount}`} icon={Clock3} />
            <MetricTile label="진행 예약" value={`${activeCount}`} icon={CalendarDays} />
            <MetricTile label="완료" value={`${completedCount}`} icon={CheckCircle2} />
            <MetricTile label="취소/거절" value={`${cancelledCount}`} icon={XCircle} />
          </div>

          {activeView === "reservations" ? (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_360px] gap-4">
              <DesktopSurface className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#eee6de] px-5 py-4">
                  <h2 className="text-[18px] font-semibold tracking-[-0.02em]">오늘 예약</h2>
                  <span className="text-[13px] font-medium text-[#81786f]">{todayAppointments.length}건</span>
                </div>
                <div className="grid grid-cols-[90px_1.1fr_1fr_120px_110px] border-b border-[#eee6de] bg-[#fbfaf8] px-5 py-3 text-[12px] font-semibold text-[#81786f]">
                  <span>시간</span>
                  <span>고객</span>
                  <span>서비스</span>
                  <span>상태</span>
                  <span>연락처</span>
                </div>
                <div>
                  {todayAppointments.length === 0 ? (
                    <div className="px-5 py-12 text-center text-[14px] text-[#81786f]">오늘 등록된 예약이 없어요.</div>
                  ) : (
                    todayAppointments.map((appointment) => {
                      const pet = petMap[appointment.pet_id];
                      const guardian = guardianMap[appointment.guardian_id];
                      const service = serviceMap[appointment.service_id];
                      return (
                        <div key={appointment.id} className="grid min-h-[64px] grid-cols-[90px_1.1fr_1fr_120px_110px] items-center border-b border-[#f1e9e2] px-5 py-3 text-[14px] last:border-b-0">
                          <span className="font-semibold text-[#17211f]">{formatClockTime(appointment.appointment_time)}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[#17211f]">{pet?.name ?? "반려동물"}</span>
                            <span className="mt-1 block truncate text-[12px] text-[#81786f]">{guardian?.name ?? "보호자"}</span>
                          </span>
                          <span className="truncate text-[#4b5652]">{service?.name ?? "서비스"}</span>
                          <StatusPill status={appointment.status} />
                          <span className="truncate text-[#81786f]">{guardian?.phone ?? "-"}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </DesktopSurface>

              <DesktopSurface className="px-5 py-4">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em]">최근 알림</h2>
                <div className="mt-4 space-y-3">
                  {recentNotifications.length === 0 ? (
                    <p className="rounded-[8px] bg-[#fbfaf8] px-3 py-4 text-[14px] text-[#81786f]">최근 알림이 없어요.</p>
                  ) : (
                    recentNotifications.map((notification) => (
                      <div key={notification.id} className="rounded-[8px] border border-[#eee6de] px-3 py-3">
                        <p className="truncate text-[14px] font-medium text-[#17211f]">{notification.message}</p>
                        <p className="mt-1 text-[12px] text-[#81786f]">{(notification.sent_at ?? notification.created_at).slice(0, 16).replace("T", " ")}</p>
                      </div>
                    ))
                  )}
                </div>
              </DesktopSurface>
            </div>
          ) : null}

          {activeView === "customers" ? (
            <DesktopSurface className="mt-5 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eee6de] px-5 py-4">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em]">고객 목록</h2>
                <span className="text-[13px] font-medium text-[#81786f]">{data.guardians.length}명</span>
              </div>
              <div className="grid grid-cols-[1fr_150px_1.4fr_160px] border-b border-[#eee6de] bg-[#fbfaf8] px-5 py-3 text-[12px] font-semibold text-[#81786f]">
                <span>고객</span>
                <span>연락처</span>
                <span>반려동물</span>
                <span>알림</span>
              </div>
              {data.guardians.map((guardian) => {
                const pets = data.pets.filter((pet) => pet.guardian_id === guardian.id);
                return (
                  <div key={guardian.id} className="grid min-h-[62px] grid-cols-[1fr_150px_1.4fr_160px] items-center border-b border-[#f1e9e2] px-5 py-3 text-[14px] last:border-b-0">
                    <span className="font-medium text-[#17211f]">{guardian.name}</span>
                    <span className="text-[#81786f]">{guardian.phone}</span>
                    <span className="truncate text-[#4b5652]">{pets.map((pet) => pet.name).join(", ") || "-"}</span>
                    <span className="text-[#81786f]">{guardian.notification_settings.enabled ? "수신" : "중지"}</span>
                  </div>
                );
              })}
            </DesktopSurface>
          ) : null}

          {activeView === "operations" ? (
            <div className="mt-5 grid grid-cols-2 gap-4">
              <DesktopSurface className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#2f7866]" />
                  <h2 className="text-[18px] font-semibold tracking-[-0.02em]">매장 정보</h2>
                </div>
                <div className="mt-4 space-y-3 text-[14px]">
                  <p><span className="text-[#81786f]">매장명</span><span className="ml-3 font-medium text-[#17211f]">{data.shop.name}</span></p>
                  <p><span className="text-[#81786f]">주소</span><span className="ml-3 font-medium text-[#17211f]">{data.shop.address}</span></p>
                  <p><span className="text-[#81786f]">동일 시간 예약</span><span className="ml-3 font-medium text-[#17211f]">{data.shop.approval_mode === "manual" ? "승인 대기 2건" : "확정 1건"}</span></p>
                </div>
              </DesktopSurface>
              <DesktopSurface className="px-5 py-4">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em]">운영 상태</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[8px] border border-[#e9e1d9] bg-[#fbfaf8] px-4 py-4">
                    <p className="text-[13px] font-medium text-[#81786f]">활성 서비스</p>
                    <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-[#17211f]">{data.services.filter((service) => service.is_active).length}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#e9e1d9] bg-[#fbfaf8] px-4 py-4">
                    <p className="text-[13px] font-medium text-[#81786f]">전체 고객</p>
                    <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-[#17211f]">{data.guardians.length}</p>
                  </div>
                </div>
              </DesktopSurface>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
