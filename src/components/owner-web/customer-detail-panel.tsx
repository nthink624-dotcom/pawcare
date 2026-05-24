"use client";

import { CalendarPlus, Copy, Edit3, MoreVertical, Pencil, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPhoneNumber,
  getAppointmentStatusMeta,
  getNotificationStatusMeta,
  getServiceDuration,
  getServiceName,
  splitNotes,
  type CustomerDetailModel,
} from "@/components/owner-web/customer-detail-helpers";
import { cn } from "@/lib/utils";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { GuardianNotificationSettings, MediaAsset, MediaKind } from "@/types/domain";

type CustomerDetailPanelProps = {
  detail: CustomerDetailModel;
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
  onClose: () => void;
};

type DetailAction = "reservation" | "guardianEdit" | "petEdit" | "petAdd" | "notificationSettings" | "appointments" | "notifications" | null;

type MediaAssetListResponse = {
  items: Array<{ mediaAsset: MediaAsset }>;
};

type GroomingPhotoSummary = {
  before: MediaAsset | null;
  after: MediaAsset | null;
};

const primaryButtonClass = "border-[#2f7866] bg-[#2f7866] text-white shadow-[0_8px_18px_rgba(47,120,102,0.16)] hover:bg-[#286a5a]";

export default function CustomerDetailPanel({ detail, selectedPetId, onSelectPet, onClose }: CustomerDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeAction, setActiveAction] = useState<DetailAction>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [photoSummaries, setPhotoSummaries] = useState<Record<string, GroomingPhotoSummary>>({});
  const selectedPet = detail.selectedPet;
  const petNotes = splitNotes(selectedPet?.notes);
  const profileInitial = selectedPet?.name.slice(0, 1) || "P";
  const phone = formatPhoneNumber(detail.guardian.phone);

  useEffect(() => {
    let cancelled = false;
    const records = detail.recentGroomingRecords;
    if (records.length === 0) {
      void Promise.resolve().then(() => {
        if (!cancelled) setPhotoSummaries({});
      });
      return;
    }

    async function loadPhotos() {
      const entries = await Promise.all(
        records.map(async (record) => {
          try {
            const params = new URLSearchParams({
              groomingRecordId: record.id,
              limit: "10",
              includeVariants: "false",
            });
            const result = await fetchApiJsonWithAuth<MediaAssetListResponse>(`/api/owner/media/assets?${params.toString()}`);
            const assets = result.items.map((item) => item.mediaAsset);
            return [
              record.id,
              {
                before: getMediaByKind(assets, "grooming_before"),
                after: getMediaByKind(assets, "grooming_after"),
              },
            ] as const;
          } catch {
            return [record.id, { before: null, after: null }] as const;
          }
        }),
      );
      if (!cancelled) setPhotoSummaries(Object.fromEntries(entries));
    }

    void loadPhotos();
    return () => {
      cancelled = true;
    };
  }, [detail.recentGroomingRecords]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20 p-4" onClick={onClose}>
      <section
        className="relative mx-auto flex h-full max-w-[1440px] flex-col overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e1e7ef] bg-white px-6 py-5">
          <div className="min-w-0">
            <button type="button" onClick={onClose} className="text-[15px] font-normal text-[#2f7866] hover:underline">
              ← 고객관리
              <span className="mx-2 text-[#94a3b8]">›</span>
              <span className="text-[#334155]">고객 상세</span>
            </button>
            <div className="mt-5 flex min-w-0 items-end gap-3">
              <h2 className="truncate text-[28px] font-semibold tracking-[-0.01em] text-[#111827]">{detail.guardian.name}</h2>
              <span className="mb-1 rounded-[6px] bg-[#eef7f4] px-2 py-1 text-[13px] font-normal text-[#2f7866]">보호자</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActionButton icon={CalendarPlus} label="예약 추가" onClick={() => setActiveAction("reservation")} />
            <ActionButton icon={Edit3} label="정보 수정" onClick={() => setActiveAction("guardianEdit")} />
            <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]"
              aria-label="더보기"
              aria-expanded={moreOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-12 z-10 w-[188px] rounded-[8px] border border-[#dbe2ea] bg-white p-1.5 shadow-[0_14px_32px_rgba(15,23,42,0.16)]">
                <MenuButton label="전화번호 복사" onClick={() => void copyPhone()} />
                <MenuButton label="반려동물 추가" onClick={() => setActiveAction("petAdd")} />
                <MenuButton label="알림 설정 보기" onClick={() => setActiveAction("notificationSettings")} />
              </div>
            ) : null}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-r border-[#e1e7ef] bg-white px-5 py-5">
            <SummaryCard detail={detail} phone={phone} onCopyPhone={copyPhone} copied={copied} onEdit={() => setActiveAction("guardianEdit")} />
            <PetListCard detail={detail} selectedPetId={selectedPetId ?? selectedPet?.id ?? null} onSelectPet={onSelectPet} onAdd={() => setActiveAction("petAdd")} />
            <NotificationSettingsCard settings={detail.guardian.notification_settings} onEdit={() => setActiveAction("notificationSettings")} />
          </aside>

          <main className="min-h-0 overflow-y-auto px-5 py-5">
            {selectedPet ? (
              <div className="space-y-4">
                <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-5">
                  <div className="flex items-start gap-5">
                    <div className="flex h-[128px] w-[128px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#eef7f4] to-[#f6f8f7] text-[48px] font-semibold text-[#2f7866]">
                      {profileInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[30px] font-semibold tracking-[-0.01em] text-[#111827]">{selectedPet.name}</h3>
                            <Pencil className="h-4 w-4 text-[#2f7866]" />
                          </div>
                          <p className="mt-1 text-[16px] text-[#475569]">
                            {selectedPet.breed || "견종 미입력"} · 성별 미입력 · 중성화 미입력
                          </p>
                        </div>
                        <button type="button" onClick={() => setActiveAction("petEdit")} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#334155] hover:bg-[#f8fafc]">
                          반려동물 정보 수정
                        </button>
                      </div>
                      <div className="mt-5 grid grid-cols-4 gap-3 border-t border-[#edf2f7] pt-4">
                        <Metric label="몸무게" value={typeof selectedPet.weight === "number" ? `${selectedPet.weight} kg` : "미입력"} />
                        <Metric label="나이" value={selectedPet.age ? `${selectedPet.age}세` : "미입력"} />
                        <Metric label="생년월일" value={selectedPet.birthday ? formatDate(selectedPet.birthday) : "미입력"} />
                        <Metric label="미용 주기" value={`${selectedPet.grooming_cycle_weeks || 4}주 간격`} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 rounded-[8px] bg-[#f3f7f5] px-4 py-3">
                        <Metric label="최근 미용" value={selectedPet.recentGroomingLabel} />
                        <Metric label="최근 스타일" value={selectedPet.recentStyleLabel} />
                        <Metric label="다음 추천 방문" value={selectedPet.nextVisitWindowLabel} />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
                  <NotesCard notes={petNotes} />
                  <UpcomingAppointmentCard detail={detail} onViewAll={() => setActiveAction("appointments")} />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
                  <RecentAppointmentsCard detail={detail} onViewAll={() => setActiveAction("appointments")} />
                  <NotificationHistoryCard detail={detail} onViewAll={() => setActiveAction("notifications")} />
                </div>

                <GroomingRecordsCard detail={detail} photoSummaries={photoSummaries} />
              </div>
            ) : (
              <EmptyState title="반려동물이 없습니다" description="이 보호자에게 등록된 반려동물 정보가 아직 없습니다." />
            )}
          </main>
        </div>
        {activeAction ? (
          <ActionPanel
            action={activeAction}
            detail={detail}
            onClose={() => {
              setActiveAction(null);
              setMoreOpen(false);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function ActionButton({ icon: Icon, label, primary = false, onClick }: { icon: typeof CalendarPlus; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-11 items-center gap-2 rounded-[8px] border px-4 text-[15px] font-medium transition", primary ? primaryButtonClass : "border-[#cfd8e3] bg-white text-[#334155] hover:bg-[#f8fafc]")}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-[6px] px-3 py-2 text-left text-[14px] text-[#334155] hover:bg-[#f8fafc]">
      {label}
    </button>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#dbe2ea] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
        <h3 className="text-[16px] font-semibold text-[#111827]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({ detail, phone, onCopyPhone, copied, onEdit }: { detail: CustomerDetailModel; phone: string; onCopyPhone: () => void; copied: boolean; onEdit: () => void }) {
  return (
    <SectionCard title="보호자 정보" action={<SmallButton label="수정" onClick={onEdit} />}>
      <div className="space-y-3 px-4 py-4">
        <InfoRow label="이름" value={detail.guardian.name} />
        <InfoRow
          label="전화번호"
          value={
            <span className="inline-flex items-center gap-2">
              <span>{phone}</span>
              <button type="button" onClick={onCopyPhone} className="rounded-[6px] border border-[#dbe2ea] px-2 py-0.5 text-[12px] text-[#475569] hover:bg-[#f8fafc]">
                {copied ? "복사됨" : "복사"}
              </button>
            </span>
          }
        />
        <InfoRow label="메모" value={detail.guardian.memo || "보호자 메모 없음"} alignTop />
        <div className="h-px bg-[#edf2f7]" />
        <InfoRow label="재방문 알림" value={<ToggleState enabled={detail.guardian.notification_settings?.revisit_enabled !== false && detail.guardian.notification_settings?.enabled !== false} />} />
        <InfoRow label="최근 방문일" value={detail.recentVisitLabel} />
        <InfoRow label="누적 예약 수" value={`${detail.totalAppointments}건`} />
        <InfoRow label="누적 미용 기록 수" value={`${detail.totalGroomingRecords}건`} />
        <InfoRow label="마지막 예약 상태" value={detail.lastAppointmentStatusLabel} />
      </div>
    </SectionCard>
  );
}

function PetListCard({ detail, selectedPetId, onSelectPet, onAdd }: { detail: CustomerDetailModel; selectedPetId: string | null; onSelectPet: (petId: string) => void; onAdd: () => void }) {
  return (
    <div className="mt-4">
      <SectionCard title="반려동물 목록" action={<SmallButton label="+ 추가" onClick={onAdd} />}>
        {detail.pets.length > 0 ? (
          <div className="space-y-2 p-3">
            {detail.pets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                onClick={() => onSelectPet(pet.id)}
                className={cn(
                  "w-full rounded-[8px] border px-3 py-3 text-left transition",
                  selectedPetId === pet.id ? "border-[#8bbcaf] bg-[#f5faf8]" : "border-[#edf2f7] bg-white hover:border-[#dbe2ea] hover:bg-[#fbfcfd]",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[18px] font-semibold text-[#2f7866]">{pet.name.slice(0, 1)}</div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-[#111827]">{pet.name}</p>
                    <p className="mt-1 truncate text-[14px] text-[#64748b]">
                      {[pet.breed, typeof pet.weight === "number" ? `${pet.weight}kg` : "", pet.age ? `${pet.age}세` : ""].filter(Boolean).join(" · ") || "프로필 미입력"}
                    </p>
                    <p className="mt-1 truncate text-[13px] text-[#64748b]">최근 미용 {pet.recentGroomingLabel}</p>
                    <p className="mt-1 truncate text-[13px] text-[#8a5b11]">{splitNotes(pet.notes)[0] ?? "주의사항 없음"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="반려동물 없음" description="등록된 반려동물이 없습니다." compact />
        )}
      </SectionCard>
    </div>
  );
}

function NotificationSettingsCard({ settings, onEdit }: { settings: GuardianNotificationSettings; onEdit: () => void }) {
  const enabled = settings.enabled !== false;
  const items = [
    ["예약 알림", enabled && settings.booking_confirmed_enabled !== false],
    ["미용 시작 알림", enabled && settings.grooming_started_enabled !== false],
    ["미용 완료 알림", enabled && settings.grooming_completed_enabled !== false],
    ["재방문 알림", enabled && settings.revisit_enabled !== false],
  ] as const;

  return (
    <div className="mt-4">
      <SectionCard title="알림 설정" action={<SmallButton label="수정" onClick={onEdit} />}>
        <div className="space-y-3 px-4 py-4">
          {items.map(([label, itemEnabled]) => (
            <InfoRow key={label} label={label} value={<ToggleState enabled={itemEnabled} />} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function NotesCard({ notes }: { notes: string[] }) {
  return (
    <SectionCard title="주의사항 / 미용 메모">
      {notes.length > 0 ? (
        <ul className="space-y-2 px-4 py-4">
          {notes.map((note) => (
            <li key={note} className="flex gap-2 text-[15px] leading-6 text-[#334155]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b98121]" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="주의사항 없음" description="등록된 반려동물 주의사항이나 미용 메모가 없습니다." compact />
      )}
    </SectionCard>
  );
}

function UpcomingAppointmentCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  const appointment = detail.upcomingAppointment;
  if (!appointment) {
    return (
      <SectionCard title="다가오는 예약">
        <EmptyState title="예약 없음" description="예정된 예약이 없습니다." compact />
      </SectionCard>
    );
  }
  const meta = getAppointmentStatusMeta(appointment.status);
  return (
    <SectionCard title="다가오는 예약" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-semibold text-[#111827]">{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</p>
            <p className="mt-2 text-[15px] text-[#334155]">{getServiceName(detail.servicesById, appointment.service_id)}</p>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[14px] text-[#64748b]">
          <span>예상 소요시간: {formatDuration(getServiceDuration(detail.servicesById, appointment.service_id))}</span>
          <span>담당자: 미지정</span>
        </div>
      </div>
    </SectionCard>
  );
}

function RecentAppointmentsCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  return (
    <SectionCard title="최근 예약" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      {detail.recentAppointments.length > 0 ? (
        <div className="divide-y divide-[#edf2f7]">
          {detail.recentAppointments.map((appointment) => {
            const meta = getAppointmentStatusMeta(appointment.status);
            return (
              <div key={appointment.id} className="grid grid-cols-[1fr_110px_auto] items-center gap-3 px-4 py-3 text-[14px]">
                <span className="tabular-nums text-[#334155]">{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</span>
                <span className="truncate text-[#334155]">{getServiceName(detail.servicesById, appointment.service_id)}</span>
                <Badge className={meta.className}>{meta.label}</Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="예약 없음" description="최근 예약이 없습니다." compact />
      )}
    </SectionCard>
  );
}

function GroomingRecordsCard({ detail, photoSummaries }: { detail: CustomerDetailModel; photoSummaries: Record<string, GroomingPhotoSummary> }) {
  return (
    <SectionCard title="미용 기록">
      {detail.recentGroomingRecords.length > 0 ? (
        <div className="overflow-hidden">
          <div className="grid grid-cols-[106px_116px_minmax(0,1fr)_minmax(0,0.9fr)_150px_94px_86px] border-b border-[#edf2f7] bg-[#fbfcfd] px-4 py-3 text-[13px] font-medium text-[#64748b]">
            <span>날짜</span>
            <span>서비스</span>
            <span>스타일</span>
            <span>메모</span>
            <span>전후 사진</span>
            <span>금액</span>
            <span>소요시간</span>
          </div>
          {detail.recentGroomingRecords.map((record) => {
            const photoSummary = photoSummaries[record.id] ?? { before: null, after: null };
            return (
              <div key={record.id} className="grid grid-cols-[106px_116px_minmax(0,1fr)_minmax(0,0.9fr)_150px_94px_86px] items-center border-b border-[#edf2f7] px-4 py-3 text-[14px] last:border-b-0">
                <span className="tabular-nums text-[#334155]">{formatDate(record.groomed_at)}</span>
                <span className="truncate text-[#334155]">{getServiceName(detail.servicesById, record.service_id)}</span>
                <span className="truncate text-[#334155]">{record.style_notes || "-"}</span>
                <span className="truncate text-[#64748b]">{record.memo || "-"}</span>
                <GroomingPhotoCell summary={photoSummary} />
                <span className="tabular-nums text-[#334155]">{formatMoney(record.price_paid)}</span>
                <span className="text-[#64748b]">{formatDuration(getServiceDuration(detail.servicesById, record.service_id))}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="미용 기록 없음" description="아직 등록된 미용 기록이 없습니다." compact />
      )}
    </SectionCard>
  );
}

function GroomingPhotoCell({ summary }: { summary: GroomingPhotoSummary }) {
  const hasBefore = Boolean(summary.before);
  const hasAfter = Boolean(summary.after);
  const expiresAt = summary.before?.expires_at ?? summary.after?.expires_at ?? null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        <PhotoBadge label="전" active={hasBefore} />
        <PhotoBadge label="후" active={hasAfter} />
      </div>
      <p className="mt-1 truncate text-[12px] text-[#64748b]">
        {hasBefore || hasAfter ? `${expiresAt ? `${formatDate(expiresAt)}까지` : "업로드 후 30일"} 보관` : "전후 사진 없음"}
      </p>
    </div>
  );
}

function PhotoBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[6px] px-2 text-[12px] font-medium", active ? "bg-[#eef7f4] text-[#2f7866]" : "bg-[#f1f5f9] text-[#94a3b8]")}>
      {label} 사진
    </span>
  );
}

function NotificationHistoryCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  return (
    <SectionCard title="알림/소통 이력" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      {detail.recentNotifications.length > 0 ? (
        <div className="divide-y divide-[#edf2f7]">
          {detail.recentNotifications.map((notification) => {
            const meta = getNotificationStatusMeta(notification.status);
            return (
              <div key={notification.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[#111827]">{notification.template_key ?? notification.type}</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">
                      {formatDate(notification.sent_at ?? notification.created_at)} · {notification.provider ?? notification.channel}
                    </p>
                    {notification.fail_reason ? <p className="mt-1 text-[13px] text-[#a04455]">{notification.fail_reason}</p> : null}
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="알림 이력 없음" description="이 고객에게 발송된 알림 이력이 없습니다." compact />
      )}
    </SectionCard>
  );
}

function ActionPanel({ action, detail, onClose }: { action: Exclude<DetailAction, null>; detail: CustomerDetailModel; onClose: () => void }) {
  const selectedPet = detail.selectedPet;
  const titleMap: Record<Exclude<DetailAction, null>, string> = {
    reservation: "예약 추가",
    guardianEdit: "보호자 정보 수정",
    petEdit: "반려동물 정보 수정",
    petAdd: "반려동물 추가",
    notificationSettings: "알림 설정",
    appointments: "예약 전체보기",
    notifications: "알림/소통 이력 전체보기",
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/20 px-6" onClick={onClose}>
      <section className="w-full max-w-[520px] rounded-[10px] border border-[#dbe2ea] bg-white shadow-[0_22px_58px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
          <div>
            <p className="text-[13px] text-[#64748b]">{detail.guardian.name}{selectedPet ? ` · ${selectedPet.name}` : ""}</p>
            <h3 className="mt-1 text-[22px] font-semibold text-[#111827]">{titleMap[action]}</h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 rounded-[7px] border border-[#dbe2ea] px-3 text-[13px] text-[#475569] hover:bg-[#f8fafc]">
            닫기
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {action === "reservation" ? (
            <PanelNotice title="예약 생성 흐름" lines={["보호자와 반려동물 정보가 선택된 상태입니다.", "스케줄 화면의 시간 선택 예약 생성 흐름과 연결해서 사용할 수 있습니다."]} />
          ) : null}
          {action === "guardianEdit" ? (
            <PanelNotice title="수정 대상" lines={[`이름: ${detail.guardian.name}`, `전화번호: ${formatPhoneNumber(detail.guardian.phone)}`, `메모: ${detail.guardian.memo || "없음"}`]} />
          ) : null}
          {action === "petEdit" ? (
            <PanelNotice title="반려동물 정보" lines={[`이름: ${selectedPet?.name ?? "-"}`, `견종: ${selectedPet?.breed || "미입력"}`, `미용 주기: ${selectedPet?.grooming_cycle_weeks ?? 4}주`]} />
          ) : null}
          {action === "petAdd" ? (
            <PanelNotice title="반려동물 추가" lines={["새 반려동물을 이 보호자 아래에 추가하는 흐름입니다.", "저장 버튼 연결 전까지는 현재 상세 데이터가 변경되지 않습니다."]} />
          ) : null}
          {action === "notificationSettings" ? (
            <PanelNotice title="알림 상태" lines={[`전체 알림: ${detail.guardian.notification_settings.enabled !== false ? "ON" : "OFF"}`, `재방문 알림: ${detail.guardian.notification_settings.revisit_enabled !== false ? "ON" : "OFF"}`]} />
          ) : null}
          {action === "appointments" ? (
            <PanelNotice title="예약" lines={detail.recentAppointments.map((appointment) => `${formatDateTime(appointment.appointment_date, appointment.appointment_time)} · ${getServiceName(detail.servicesById, appointment.service_id)} · ${getAppointmentStatusMeta(appointment.status).label}`)} />
          ) : null}
          {action === "notifications" ? (
            <PanelNotice title="알림/소통 이력" lines={detail.recentNotifications.map((notification) => `${formatDate(notification.sent_at ?? notification.created_at)} · ${notification.template_key ?? notification.type} · ${getNotificationStatusMeta(notification.status).label}`)} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PanelNotice({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-[8px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
      <p className="text-[15px] font-semibold text-[#111827]">{title}</p>
      <div className="mt-3 space-y-2">
        {(lines.length > 0 ? lines : ["표시할 내용이 없습니다."]).map((line) => (
          <p key={line} className="text-[14px] leading-5 text-[#475569]">{line}</p>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value, alignTop = false }: { label: string; value: React.ReactNode; alignTop?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[92px_minmax(0,1fr)] gap-3 text-[14px]", alignTop ? "items-start" : "items-center")}>
      <span className="text-[#64748b]">{label}</span>
      <span className="min-w-0 text-[#111827]">{value}</span>
    </div>
  );
}

function getMediaByKind(assets: MediaAsset[], mediaKind: MediaKind) {
  return assets.find((asset) => asset.media_kind === mediaKind) ?? null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={cn("inline-flex h-7 shrink-0 items-center rounded-[6px] border px-2.5 text-[13px] font-medium", className)}>{children}</span>;
}

function ToggleState({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-[12px] font-medium", enabled ? "bg-[#eef7f4] text-[#2f7866]" : "bg-[#f1f5f9] text-[#64748b]")}>
      {enabled ? "ON" : "OFF"}
    </span>
  );
}

function SmallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="h-8 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] text-[#475569] hover:bg-[#f8fafc]">{label}</button>;
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-6" : "min-h-[320px] px-6")}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]">
        <Sparkles className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[15px] font-medium text-[#111827]">{title}</p>
      <p className="mt-1 text-[14px] leading-5 text-[#64748b]">{description}</p>
    </div>
  );
}
