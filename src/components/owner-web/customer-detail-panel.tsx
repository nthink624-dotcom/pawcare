"use client";

import { CalendarPlus, Check, Copy, ImagePlus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatTimestampTime,
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
import { getPetBiteLevelLabel, normalizePetBiteLevel, petBiteLevelOptions } from "@/lib/pet-bite-level";
import type { GuardianNotificationSettings, MediaAsset, MediaKind, PetBiteLevel } from "@/types/domain";

type CustomerDetailPanelProps = {
  detail: CustomerDetailModel;
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
  onUpdatePetBiteLevel: (guardianId: string, petId: string, biteLevel: PetBiteLevel) => void;
  onUpdateGuardian: (guardianId: string, patch: { name: string; phone: string; memo: string }) => void | Promise<void>;
  onUpdatePet: (
    guardianId: string,
    petId: string,
    patch: { name: string; breed: string; birthday: string; weight: string; notes: string; groomingCycleWeeks: string },
  ) => void | Promise<void>;
  onAddPet: (guardianId: string, payload: PetAddPayload) => void | Promise<void>;
  onDeletePet: (guardianId: string, petId: string) => void | Promise<void>;
  onToggleGuardianNotifications: (guardianId: string) => void | Promise<void>;
  onCreateReservation: (params: { guardianId: string; petId: string | null }) => void;
  onClose: () => void;
};

type PetAddPayload = {
  name: string;
  breed: string;
  birthday: string;
  weight: string;
  biteLevel: PetBiteLevel;
  profilePhoto?: File | null;
};

type DetailAction = "guardianEdit" | "petEdit" | "petAdd" | "notificationSettings" | "appointments" | "notifications" | null;

type MediaAssetListResponse = {
  items: Array<{ mediaAsset: MediaAsset }>;
};

type GroomingPhotoSummary = {
  after: MediaAsset | null;
};

const primaryButtonClass = "border-[#2f7866] bg-[#2f7866] text-white shadow-[0_8px_18px_rgba(47,120,102,0.16)] hover:bg-[#286a5a]";

export default function CustomerDetailPanel({
  detail,
  selectedPetId,
  onSelectPet,
  onUpdatePetBiteLevel,
  onUpdateGuardian,
  onUpdatePet,
  onAddPet,
  onDeletePet,
  onToggleGuardianNotifications,
  onCreateReservation,
  onClose,
}: CustomerDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeAction, setActiveAction] = useState<DetailAction>(null);
  const [photoSummaries, setPhotoSummaries] = useState<Record<string, GroomingPhotoSummary>>({});
  const selectedPet = detail.selectedPet;
  const profileInitial = selectedPet?.name.slice(0, 1) || "P";
  const phone = formatPhoneNumber(detail.guardian.phone);
  const petWeightLabel = typeof selectedPet?.weight === "number" ? `${selectedPet.weight} kg` : "몸무게 미입력";
  const petBirthdayLabel = selectedPet?.birthday ? formatDate(selectedPet.birthday) : "생일 미입력";

  function buildPetPatch(patch: Partial<{ name: string; breed: string; birthday: string; weight: string; notes: string; groomingCycleWeeks: string }>) {
    if (!selectedPet) return null;
    return {
      name: selectedPet.name,
      breed: selectedPet.breed ?? "",
      birthday: selectedPet.birthday ?? "",
      weight: typeof selectedPet.weight === "number" ? String(selectedPet.weight) : "",
      notes: selectedPet.notes ?? "",
      groomingCycleWeeks: String(selectedPet.grooming_cycle_weeks ?? 4),
      ...patch,
    };
  }

  async function savePetPatch(patch: Partial<{ name: string; breed: string; birthday: string; weight: string; notes: string; groomingCycleWeeks: string }>) {
    const nextPatch = buildPetPatch(patch);
    if (!selectedPet || !nextPatch) return;
    await onUpdatePet(detail.guardian.id, selectedPet.id, nextPatch);
  }

  async function saveGuardianPatch(patch: Partial<{ name: string; phone: string; memo: string }>) {
    await onUpdateGuardian(detail.guardian.id, {
      name: detail.guardian.name,
      phone,
      memo: detail.guardian.memo ?? "",
      ...patch,
    });
  }

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
                after: getMediaByKind(assets, "grooming_after"),
              },
            ] as const;
          } catch {
            return [record.id, { after: null }] as const;
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
        className="relative mx-auto flex h-full max-w-[1520px] flex-col overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e1e7ef] bg-white px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-[#111827]">
              {detail.guardian.name}
              {selectedPet ? ` · ${selectedPet.name}` : ""}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActionButton icon={CalendarPlus} label="예약 추가" onClick={() => onCreateReservation({ guardianId: detail.guardian.id, petId: selectedPet?.id ?? null })} />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[310px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-r border-[#e1e7ef] bg-white px-4 py-4">
            <SummaryCard
              detail={detail}
              phone={phone}
              onCopyPhone={copyPhone}
              copied={copied}
              onEdit={() => setActiveAction("guardianEdit")}
              onUpdateGuardian={saveGuardianPatch}
            />
            <NotificationSettingsCard settings={detail.guardian.notification_settings} onEdit={() => setActiveAction("notificationSettings")} />
          </aside>

          <main className="min-h-0 overflow-y-auto px-4 py-4">
            {selectedPet ? (
              <div className="space-y-3">
                <PetOverviewSection
                  detail={detail}
                  selectedPet={selectedPet}
                  selectedPetId={selectedPetId ?? selectedPet.id}
                  profileInitial={profileInitial}
                  phone={phone}
                  onSelectPet={onSelectPet}
                  onAddPet={() => setActiveAction("petAdd")}
                  onEditPet={() => setActiveAction("petEdit")}
                  onDeletePet={() => void onDeletePet(detail.guardian.id, selectedPet.id)}
                  onUpdatePetBiteLevel={(biteLevel) => onUpdatePetBiteLevel(detail.guardian.id, selectedPet.id, biteLevel)}
                />

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
            onUpdateGuardian={onUpdateGuardian}
            onUpdatePet={onUpdatePet}
            onAddPet={onAddPet}
            onToggleGuardianNotifications={onToggleGuardianNotifications}
            onClose={() => {
              setActiveAction(null);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function ActionButton({ icon: Icon, label, primary = false, onClick }: { icon: typeof CalendarPlus; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-10 items-center gap-2 rounded-[8px] border px-3.5 text-[16px] font-medium transition", primary ? primaryButtonClass : "border-[#cfd8e3] bg-white text-[#334155] hover:bg-[#f8fafc]")}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#dbe2ea] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] px-3.5 py-2.5">
        <h3 className="text-[16px] font-semibold text-[#111827]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  detail,
  phone,
  onCopyPhone,
  copied,
  onEdit,
  onUpdateGuardian,
}: {
  detail: CustomerDetailModel;
  phone: string;
  onCopyPhone: () => void;
  copied: boolean;
  onEdit: () => void;
  onUpdateGuardian: (patch: Partial<{ name: string; phone: string; memo: string }>) => void | Promise<void>;
}) {
  return (
    <SectionCard title="보호자 정보" action={<SmallButton label="수정" onClick={onEdit} />}>
      <div className="space-y-4 px-4 py-4">
        <div className="space-y-3">
          <SummaryField label="이름">
            <InlineEditableText
              value={detail.guardian.name}
              ariaLabel="보호자명 수정"
              className="truncate text-[16px] leading-6 text-[#111827]"
              onCommit={(value) => onUpdateGuardian({ name: value })}
            />
          </SummaryField>
          <SummaryField label="전화번호">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <InlineEditableText
                value={phone}
                ariaLabel="연락처 수정"
                className="min-w-0 truncate text-[16px] leading-6 tabular-nums text-[#111827]"
                onCommit={(value) => onUpdateGuardian({ phone: value })}
              />
              <button
                type="button"
                onClick={onCopyPhone}
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border text-[#475569] hover:bg-[#f8fafc]",
                  copied ? "border-[#2f7866] bg-[#eef7f4] text-[#2f7866]" : "border-[#dbe2ea] bg-white",
                )}
                aria-label={copied ? "전화번호 복사됨" : "전화번호 복사"}
                title={copied ? "복사됨" : "복사"}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </SummaryField>
          <SummaryField label="메모">
            <InlineEditableText
              value={detail.guardian.memo ?? ""}
              placeholder="보호자 메모를 입력할 수 있습니다."
              ariaLabel="보호자 메모 수정"
              className="rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] px-3 py-2 text-left text-[16px] leading-6 text-[#334155]"
              inputClassName="min-h-[84px]"
              multiline
              onCommit={(value) => onUpdateGuardian({ memo: value })}
            />
          </SummaryField>
        </div>
        <div className="h-px bg-[#edf2f7]" />
        <div className="space-y-2">
          <SummaryStatRow label="재방문 알림" value={<ToggleState enabled={detail.guardian.notification_settings?.revisit_enabled !== false && detail.guardian.notification_settings?.enabled !== false} />} />
          <SummaryStatRow label="최근 방문일" value={detail.recentVisitLabel} />
          <SummaryStatRow label="누적 예약 수" value={`${detail.totalAppointments}건`} />
          <SummaryStatRow label="누적 미용 기록" value={`${detail.totalGroomingRecords}건`} />
          <SummaryStatRow label="마지막 예약 상태" value={detail.lastAppointmentStatusLabel} />
        </div>
      </div>
    </SectionCard>
  );
}

function SummaryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[16px] leading-5 text-[#64748b]">{label}</p>
      {children}
    </div>
  );
}

function SummaryStatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-[16px] leading-6">
      <span className="shrink-0 text-[#64748b]">{label}</span>
      <span className="min-w-0 truncate text-right text-[#111827]">{value}</span>
    </div>
  );
}

function PetOverviewSection({
  detail,
  selectedPet,
  selectedPetId,
  profileInitial,
  phone,
  onSelectPet,
  onAddPet,
  onEditPet,
  onDeletePet,
  onUpdatePetBiteLevel,
}: {
  detail: CustomerDetailModel;
  selectedPet: NonNullable<CustomerDetailModel["selectedPet"]>;
  selectedPetId: string;
  profileInitial: string;
  phone: string;
  onSelectPet: (petId: string) => void;
  onAddPet: () => void;
  onEditPet: () => void;
  onDeletePet: () => void;
  onUpdatePetBiteLevel: (biteLevel: PetBiteLevel) => void;
}) {
  const hasMultiplePets = detail.pets.length > 1;
  const birthdayLabel = selectedPet.birthday ? formatDate(selectedPet.birthday) : "미입력";
  const fullAgeLabel = selectedPet.birthday ? calculateFullAgeLabel(selectedPet.birthday) : "";
  const weightLabel = typeof selectedPet.weight === "number" ? `${selectedPet.weight}kg` : "미입력";
  const cautionItems = buildPetInfoItems(splitNotes(selectedPet.notes), "주의사항을 입력해 주세요.");
  const styleItems = buildPetInfoItems(
    splitNotes(selectedPet.latestGroomingRecord?.style_notes || selectedPet.recentStyleLabel).filter((item) => !item.includes("최근 스타일 없음")),
    "미용 스타일을 입력해 주세요.",
  );
  const memoItems = buildPetInfoItems(splitNotes(selectedPet.latestGroomingRecord?.memo || detail.guardian.memo || ""), "메모를 입력해 주세요.");

  return (
    <section className="relative rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-[#111827]">반려동물 정보</h3>
        <div className="flex items-center gap-2">
          <SmallButton label="반려동물 추가" onClick={onAddPet} />
          <SmallButton label="편집" onClick={onEditPet} />
          <SmallButton label="삭제" onClick={onDeletePet} />
        </div>
      </div>

      {hasMultiplePets ? (
        <div className="grid grid-cols-2 gap-2">
          {detail.pets.map((pet) => {
            const selected = pet.id === selectedPetId;
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => onSelectPet(pet.id)}
                className={cn(
                  "relative flex min-w-0 items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition",
                  selected ? "border-[#2f7866] bg-[#f5fbf8]" : "border-[#dbe2ea] bg-white hover:border-[#b8c8d6] hover:bg-[#fbfcfd]",
                )}
              >
                <PetAvatar name={pet.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold leading-5 text-[#111827]">{pet.name}</p>
                  <p className="mt-0.5 truncate text-[15px] leading-5 text-[#475569]">{buildPetSummary(pet)}</p>
                </div>
                {selected ? (
                  <span className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f7866] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={cn("grid grid-cols-[108px_220px_minmax(0,1fr)] gap-3 border-t border-[#edf2f7] pt-3", hasMultiplePets ? "mt-3" : "mt-2")}>
        <PetAvatar name={selectedPet.name} size="lg" initial={profileInitial} />

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[22px] font-semibold tracking-[-0.01em] text-[#111827]">{selectedPet.name}</p>
            {selectedPet.breed ? (
              <>
                <span className="h-5 w-px shrink-0 bg-[#cbd5e1]" aria-hidden="true" />
                <p className="truncate text-[18px] leading-6 text-[#475569]">{selectedPet.breed}</p>
              </>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[15px] leading-6">
            <span className="text-[#64748b]">중성화</span>
            <span className="truncate text-[#111827]">미입력</span>
            <span className="text-[#64748b]">생년월일</span>
            <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[#111827]">
              <span>{birthdayLabel}</span>
              {fullAgeLabel ? (
                <>
                  <span className="h-4 w-px shrink-0 bg-[#cbd5e1]" aria-hidden="true" />
                  <span className="shrink-0">{fullAgeLabel}</span>
                </>
              ) : null}
            </span>
            <span className="text-[#64748b]">몸무게</span>
            <span className="truncate text-[#111827]">{weightLabel}</span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-3 divide-x divide-[#e5e7eb] border-l border-[#e5e7eb]">
          <PetInfoColumn title="특징 / 주의사항" items={cautionItems} />
          <PetInfoColumn title="미용 스타일 선호" items={styleItems} />
          <PetInfoColumn title="메모" items={memoItems} />
        </div>

      </div>

      <div className="mt-3">
        <BiteLevelSelector value={normalizePetBiteLevel(selectedPet.bite_level)} onChange={onUpdatePetBiteLevel} />
        <CustomerQuickFacts detail={detail} selectedPet={selectedPet} />
      </div>
    </section>
  );
}

function PetAvatar({ name, size, initial }: { name: string; size: "sm" | "lg"; initial?: string }) {
  const letter = initial || name.slice(0, 1) || "우";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]",
        size === "lg" ? "h-[108px] w-[108px] text-[42px] font-semibold" : "h-11 w-11 text-[19px] font-semibold",
      )}
    >
      {letter}
    </div>
  );
}

function PetInfoColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0 px-4">
      <p className="mb-2 text-[15px] font-semibold leading-5 text-[#111827]">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[15px] leading-6 text-[#334155]">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#334155]" />
            <span className="line-clamp-2">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildPetInfoItems(items: string[], fallback: string) {
  const filtered = items.map((item) => item.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.slice(0, 3) : [fallback];
}

function buildPetSummary(pet: Pick<NonNullable<CustomerDetailModel["selectedPet"]>, "breed" | "age" | "weight">) {
  const parts = [
    pet.breed || "품종 미입력",
    typeof pet.age === "number" ? `${pet.age}살` : "",
    typeof pet.weight === "number" ? `${pet.weight}kg` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function calculateFullAgeLabel(birthday: string) {
  const birthDate = new Date(birthday.includes("T") ? birthday : `${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthdayThisYear = today.getMonth() > birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return `만 ${Math.max(age, 0)}세`;
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
                    <div className="flex min-w-0 items-baseline gap-3">
                      <p className="shrink-0 truncate text-[16px] font-semibold leading-5 text-[#111827]">{pet.name}</p>
                      <p className="min-w-0 truncate text-[16px] leading-5 text-[#64748b]">
                        {[pet.breed, typeof pet.weight === "number" ? `${pet.weight}kg` : "", pet.age ? `${pet.age}세` : ""].filter(Boolean).join(" · ") || "프로필 미입력"}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-[16px] text-[#64748b]">최근 미용 {pet.recentGroomingLabel}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <BiteLevelMiniScale value={normalizePetBiteLevel(pet.bite_level)} />
                      {splitNotes(pet.notes)[0] ? <span className="truncate text-[16px] text-[#8a5b11]">{splitNotes(pet.notes)[0]}</span> : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="반려동물을 등록해 주세요" description="보호자 아래에 반려동물을 추가할 수 있습니다." compact />
        )}
      </SectionCard>
    </div>
  );
}

function BiteLevelSelector({ value, onChange }: { value: PetBiteLevel; onChange: (value: PetBiteLevel) => void }) {
  return (
    <div className="w-full border-t border-[#edf2f7] pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[16px] font-normal text-[#111827]">입질 정도</p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {petBiteLevelOptions.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "h-9 rounded-[8px] border px-2 text-center text-[16px] transition",
                selected ? "border-[#2f7866] bg-[#f7fbf9] text-[#111827]" : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#b8c8d6]",
              )}
            >
              <span className="block truncate leading-9">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getBiteLevelIndex(value: PetBiteLevel) {
  const indexByLevel: Record<PetBiteLevel, number> = {
    none: 0,
    mild: 1,
    watch: 2,
    bite: 3,
    strong: 4,
  };
  return indexByLevel[value];
}

function getBiteLevelColorClass(index: number) {
  if (index <= 1) return "bg-[#2f7866]";
  if (index === 2) return "bg-[#d29a2f]";
  if (index === 3) return "bg-[#c66a43]";
  return "bg-[#a04455]";
}

function BiteLevelBar({ value, active = true }: { value: PetBiteLevel; active?: boolean }) {
  const activeIndex = getBiteLevelIndex(value);
  const activeColor = getBiteLevelColorClass(activeIndex);
  return (
    <div className="grid min-w-0 grid-cols-5 gap-1.5" aria-label={`입질 ${getPetBiteLevelLabel(value)}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={cn("h-2.5 rounded-full bg-[#e5eaf0]", active && index === activeIndex && activeColor)} />
      ))}
    </div>
  );
}

function BiteLevelMiniScale({ value }: { value: PetBiteLevel }) {
  return (
    <div className="flex min-w-[104px] items-center gap-1.5">
      <span className="shrink-0 text-[16px] text-[#64748b]">입질</span>
      <div className="min-w-0 flex-1">
        <BiteLevelBar value={value} />
      </div>
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

function CustomerQuickFacts({ detail, selectedPet }: { detail: CustomerDetailModel; selectedPet: NonNullable<CustomerDetailModel["selectedPet"]> }) {
  const appointment = detail.upcomingAppointment;
  const nextAppointmentLabel = appointment ? formatDateTime(appointment.appointment_date, appointment.appointment_time) : "예정 없음";
  const biteLevel = getPetBiteLevelLabel(normalizePetBiteLevel(selectedPet.bite_level));
  const items: Array<readonly [string, string]> = [
    ["최근 방문", detail.recentVisitLabel],
    ["다가오는 예약", nextAppointmentLabel],
  ];
  if (normalizePetBiteLevel(selectedPet.bite_level) !== "none") items.push(["입질", biteLevel]);
  items.push(["누적 예약", `${detail.totalAppointments}건`]);

  return (
    <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[#edf2f7] pt-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] px-3 py-2">
          <p className="text-[16px] leading-5 text-[#64748b]">{label}</p>
          <p className="mt-1 truncate text-[16px] leading-5 text-[#111827]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function NotesCard({ notes, rawNotes, onCommit }: { notes: string[]; rawNotes: string; onCommit: (notes: string) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) setDraft(rawNotes);
  }, [editing, rawNotes]);

  async function commitNotes() {
    const nextNotes = draft.trim();
    if (nextNotes === rawNotes.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCommit(nextNotes);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "메모 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("rounded-[8px] border bg-white", notes.length > 0 ? "border-[#e8c989]" : "border-[#dbe2ea]")}>
      <div className={cn("flex items-center justify-between gap-3 border-b px-3.5 py-2.5", notes.length > 0 ? "border-[#f0ddb4] bg-[#fffaf0]" : "border-[#edf2f7]")}>
        <h3 className="text-[16px] font-semibold text-[#111827]">주의사항 / 미용 메모</h3>
        <button type="button" onClick={() => setEditing(true)} className="text-[16px] text-[#2f7866] hover:underline">
          {notes.length > 0 ? `${notes.length}건` : "작성"}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2 px-3.5 py-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commitNotes()}
            autoFocus
            placeholder="주의사항이나 미용 메모를 입력해 주세요."
            className="min-h-[128px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none focus:border-[#2f7866]"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[16px] text-[#64748b]">{saving ? "저장 중" : "다른 곳을 클릭하면 저장됩니다."}</p>
            {error ? <p className="text-[16px] text-[#a04455]">{error}</p> : null}
          </div>
        </div>
      ) : notes.length > 0 ? (
        <ul className="space-y-1.5 px-3.5 py-3">
          {notes.slice(0, 3).map((note) => (
            <li key={note} className="flex cursor-text gap-2 text-[16px] leading-6 text-[#334155]" onClick={() => setEditing(true)}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b98121]" />
              <span>{note}</span>
            </li>
          ))}
          {notes.length > 3 ? <li className="text-[16px] leading-6 text-[#64748b]">외 {notes.length - 3}건은 반려동물 수정에서 확인</li> : null}
        </ul>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full">
          <EmptyState title="등록된 메모가 없습니다" description="여기를 클릭해서 주의사항이나 미용 메모를 바로 남길 수 있습니다." compact />
        </button>
      )}
    </section>
  );
}

function UpcomingAppointmentCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  const appointment = detail.upcomingAppointment;
  if (!appointment) {
    return (
      <SectionCard title="다가오는 예약">
        <EmptyState title="예정된 예약이 없습니다" description="예약 추가 버튼으로 새 예약을 등록할 수 있습니다." compact />
      </SectionCard>
    );
  }
  const meta = getAppointmentStatusMeta(appointment.status);
  const customerRequest = appointment.memo?.trim() ?? "";
  return (
    <SectionCard title="다가오는 예약" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      <div className="px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[18px] font-semibold text-[#111827]">{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</p>
            <p className="mt-1 text-[16px] text-[#334155]">{getServiceName(detail.servicesById, appointment.service_id)}</p>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[16px] text-[#64748b]">
          <span>예상 소요시간: {formatDuration(getServiceDuration(detail.servicesById, appointment.service_id))}</span>
          <span>담당자: 미지정</span>
        </div>
        <AppointmentActualTimes appointment={appointment} className="mt-2" />
        {customerRequest ? (
          <div className="mt-2 line-clamp-2 rounded-[8px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2 text-[16px] leading-6 text-[#334155]">
            <span className="text-[#64748b]">고객 요청사항</span>
            <span className="mx-2 text-[#cbd5e1]">|</span>
            {customerRequest}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function RecentAppointmentsCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  const visibleAppointments = detail.recentAppointments.slice(0, 4);
  return (
    <SectionCard title="최근 예약" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      {detail.recentAppointments.length > 0 ? (
        <div className="divide-y divide-[#edf2f7]">
          {visibleAppointments.map((appointment) => {
            const meta = getAppointmentStatusMeta(appointment.status);
            const customerRequest = appointment.memo?.trim() ?? "";
            return (
              <div key={appointment.id} className="px-3.5 py-2 text-[16px]">
                <div className="grid grid-cols-[1fr_110px_auto] items-center gap-3">
                  <span className="tabular-nums text-[#334155]">{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</span>
                  <span className="truncate text-[#334155]">{getServiceName(detail.servicesById, appointment.service_id)}</span>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </div>
                {customerRequest ? (
                  <p className="mt-1 line-clamp-2 text-[16px] leading-6 text-[#64748b]">
                    고객 요청사항 <span className="mx-1 text-[#cbd5e1]">|</span> {customerRequest}
                  </p>
                ) : null}
                <AppointmentActualTimes appointment={appointment} className="mt-1" compact />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="최근 예약 내역이 없습니다" description="예약이 등록되면 여기에 표시됩니다." compact />
      )}
    </SectionCard>
  );
}

function GroomingRecordsCard({ detail, photoSummaries }: { detail: CustomerDetailModel; photoSummaries: Record<string, GroomingPhotoSummary> }) {
  return (
    <SectionCard title="미용 기록">
      {detail.recentGroomingRecords.length > 0 ? (
        <div className="overflow-hidden">
          <div className="grid grid-cols-[92px_96px_110px_minmax(0,1fr)_minmax(0,0.9fr)_140px_86px_110px] border-b border-[#edf2f7] bg-[#fbfcfd] px-4 py-3 text-[16px] font-medium text-[#64748b]">
            <span>날짜</span>
            <span>반려동물</span>
            <span>서비스</span>
            <span>스타일</span>
            <span>메모</span>
            <span>완료 사진</span>
            <span>금액</span>
            <span>실제 진행</span>
          </div>
          {detail.recentGroomingRecords.map((record) => {
            const photoSummary = photoSummaries[record.id] ?? { after: null };
            const linkedAppointment = record.appointment_id
              ? (detail.appointments.find((appointment) => appointment.id === record.appointment_id) ?? null)
              : null;
            const petName = detail.pets.find((pet) => pet.id === record.pet_id)?.name ?? "-";
            return (
              <div key={record.id} className="grid grid-cols-[92px_96px_110px_minmax(0,1fr)_minmax(0,0.9fr)_140px_86px_110px] items-center border-b border-[#edf2f7] px-4 py-3 text-[16px] last:border-b-0">
                <span className="tabular-nums text-[#334155]">{formatDate(record.groomed_at)}</span>
                <span className="truncate text-[#334155]">{petName}</span>
                <span className="truncate text-[#334155]">{getServiceName(detail.servicesById, record.service_id)}</span>
                <span className="truncate text-[#334155]">{record.style_notes || "-"}</span>
                <span className="truncate text-[#64748b]">{record.memo || "-"}</span>
                <GroomingPhotoCell summary={photoSummary} />
                <span className="tabular-nums text-[#334155]">{formatMoney(record.price_paid)}</span>
                <ActualGroomingTimeCell appointment={linkedAppointment} fallbackDuration={formatDuration(getServiceDuration(detail.servicesById, record.service_id))} />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="미용 기록이 없습니다" description="완료된 미용 기록이 생기면 여기에 표시됩니다." compact />
      )}
    </SectionCard>
  );
}

function AppointmentActualTimes({
  appointment,
  className,
  compact = false,
}: {
  appointment: CustomerDetailModel["appointments"][number];
  className?: string;
  compact?: boolean;
}) {
  if (!appointment.actual_started_at && !appointment.actual_completed_at) return null;

  const startedAt = formatTimestampTime(appointment.actual_started_at);
  const completedAt = formatTimestampTime(appointment.actual_completed_at);
  const content = `실제 시작 ${startedAt}${appointment.actual_completed_at ? ` · 실제 완료 ${completedAt}` : ""}`;

  return (
    <p className={cn(className, compact ? "text-[16px]" : "rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[16px]", "tabular-nums text-[#475569]")}>
      {content}
    </p>
  );
}

function ActualGroomingTimeCell({
  appointment,
  fallbackDuration,
}: {
  appointment: CustomerDetailModel["appointments"][number] | null;
  fallbackDuration: string;
}) {
  const startedAt = formatTimestampTime(appointment?.actual_started_at);
  const completedAt = formatTimestampTime(appointment?.actual_completed_at);

  if (startedAt === "-" && completedAt === "-") {
    return <span className="text-[#64748b]">{fallbackDuration}</span>;
  }

  return (
    <span className="space-y-0.5 text-[16px] leading-[1.35] text-[#64748b]">
      <span className="block tabular-nums">시작 {startedAt}</span>
      <span className="block tabular-nums">완료 {completedAt}</span>
    </span>
  );
}

function GroomingPhotoCell({ summary }: { summary: GroomingPhotoSummary }) {
  const hasAfter = Boolean(summary.after);
  const expiresAt = summary.after?.expires_at ?? null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        <PhotoBadge label="완료" active={hasAfter} />
      </div>
      <p className="mt-1 truncate text-[16px] text-[#64748b]">
        {hasAfter ? `${expiresAt ? `${formatDate(expiresAt)}까지` : "업로드 후 30일"} 보관` : "완료 사진 대기"}
      </p>
    </div>
  );
}

function PhotoBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[6px] px-2 text-[16px] font-medium", active ? "bg-[#eef7f4] text-[#2f7866]" : "bg-[#f1f5f9] text-[#94a3b8]")}>
      {label} 사진
    </span>
  );
}

function NotificationHistoryCard({ detail, onViewAll }: { detail: CustomerDetailModel; onViewAll: () => void }) {
  const visibleNotifications = detail.recentNotifications.slice(0, 4);
  return (
    <SectionCard title="알림/소통 이력" action={<SmallButton label="전체보기" onClick={onViewAll} />}>
      {detail.recentNotifications.length > 0 ? (
        <div className="divide-y divide-[#edf2f7]">
          {visibleNotifications.map((notification) => {
            const meta = getNotificationStatusMeta(notification.status);
            return (
              <div key={notification.id} className="px-3.5 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-medium text-[#111827]">{notification.template_key ?? notification.type}</p>
                    <p className="text-[16px] text-[#64748b]">
                      {formatDate(notification.sent_at ?? notification.created_at)} · {notification.provider ?? notification.channel}
                    </p>
                    {notification.fail_reason ? <p className="mt-0.5 line-clamp-1 text-[16px] text-[#a04455]">{notification.fail_reason}</p> : null}
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="알림 이력이 없습니다" description="발송된 알림이 생기면 여기에 표시됩니다." compact />
      )}
    </SectionCard>
  );
}

function ActionPanel({
  action,
  detail,
  onUpdateGuardian,
  onUpdatePet,
  onAddPet,
  onToggleGuardianNotifications,
  onClose,
}: {
  action: Exclude<DetailAction, null>;
  detail: CustomerDetailModel;
  onUpdateGuardian: CustomerDetailPanelProps["onUpdateGuardian"];
  onUpdatePet: CustomerDetailPanelProps["onUpdatePet"];
  onAddPet: CustomerDetailPanelProps["onAddPet"];
  onToggleGuardianNotifications: CustomerDetailPanelProps["onToggleGuardianNotifications"];
  onClose: () => void;
}) {
  const selectedPet = detail.selectedPet;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [guardianDraft, setGuardianDraft] = useState({
    name: detail.guardian.name,
    phone: formatPhoneNumber(detail.guardian.phone),
    memo: detail.guardian.memo ?? "",
  });
  const [petDraft, setPetDraft] = useState({
    name: selectedPet?.name ?? "",
    breed: selectedPet?.breed ?? "",
    birthday: selectedPet?.birthday ?? "",
    weight: typeof selectedPet?.weight === "number" ? String(selectedPet.weight) : "",
    notes: selectedPet?.notes ?? "",
    groomingCycleWeeks: String(selectedPet?.grooming_cycle_weeks ?? 4),
  });
  const [newPetDraft, setNewPetDraft] = useState<PetAddPayload>({
    name: "",
    breed: "",
    birthday: "",
    weight: "",
    biteLevel: "none",
    profilePhoto: null,
  });
  const [newPetPhotoPreviewUrl, setNewPetPhotoPreviewUrl] = useState("");
  const titleMap: Record<Exclude<DetailAction, null>, string> = {
    guardianEdit: "보호자 정보 수정",
    petEdit: "반려동물 정보 수정",
    petAdd: "반려동물 추가",
    notificationSettings: "알림 설정",
    appointments: "예약 전체보기",
    notifications: "알림/소통 이력 전체보기",
  };

  async function runSave(task: () => void | Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await task();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (action !== "petAdd" || !newPetDraft.profilePhoto) {
      setNewPetPhotoPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(newPetDraft.profilePhoto);
    setNewPetPhotoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [action, newPetDraft.profilePhoto]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/20 px-6" onClick={onClose}>
      <section className="w-full max-w-[520px] rounded-[10px] border border-[#dbe2ea] bg-white shadow-[0_22px_58px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
          <div>
            <p className="text-[16px] text-[#64748b]">{detail.guardian.name}{selectedPet ? ` · ${selectedPet.name}` : ""}</p>
            <h3 className="mt-1 text-[22px] font-semibold text-[#111827]">{titleMap[action]}</h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 rounded-[7px] border border-[#dbe2ea] px-3 text-[16px] text-[#475569] hover:bg-[#f8fafc]">
            닫기
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {action === "guardianEdit" ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void runSave(() => onUpdateGuardian(detail.guardian.id, guardianDraft));
              }}
            >
              <FormField label="보호자명" value={guardianDraft.name} onChange={(value) => setGuardianDraft((current) => ({ ...current, name: value }))} />
              <FormField label="연락처" value={guardianDraft.phone} onChange={(value) => setGuardianDraft((current) => ({ ...current, phone: value }))} />
              <FormField label="메모" value={guardianDraft.memo} onChange={(value) => setGuardianDraft((current) => ({ ...current, memo: value }))} multiline />
              <ActionPanelFooter saving={saving} error={error} />
            </form>
          ) : null}
          {action === "petEdit" ? (
            selectedPet ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSave(() => onUpdatePet(detail.guardian.id, selectedPet.id, petDraft));
                }}
              >
                <FormField label="이름" value={petDraft.name} onChange={(value) => setPetDraft((current) => ({ ...current, name: value }))} />
                <FormField label="품종" value={petDraft.breed} onChange={(value) => setPetDraft((current) => ({ ...current, breed: value }))} />
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="생년월일" value={petDraft.birthday} onChange={(value) => setPetDraft((current) => ({ ...current, birthday: value }))} placeholder="YYYY-MM-DD" />
                  <FormField label="몸무게" value={petDraft.weight} onChange={(value) => setPetDraft((current) => ({ ...current, weight: value }))} placeholder="kg" />
                  <FormField label="미용 주기" value={petDraft.groomingCycleWeeks} onChange={(value) => setPetDraft((current) => ({ ...current, groomingCycleWeeks: value }))} placeholder="주" />
                </div>
                <FormField label="주의사항 / 메모" value={petDraft.notes} onChange={(value) => setPetDraft((current) => ({ ...current, notes: value }))} multiline />
                <ActionPanelFooter saving={saving} error={error} />
              </form>
            ) : null
          ) : null}
          {action === "petAdd" ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void runSave(() => onAddPet(detail.guardian.id, newPetDraft));
              }}
            >
              <PetProfilePhotoField
                previewUrl={newPetPhotoPreviewUrl}
                fileName={newPetDraft.profilePhoto?.name ?? ""}
                onChange={(file) => setNewPetDraft((current) => ({ ...current, profilePhoto: file }))}
              />
              <FormField label="반려동물 이름" value={newPetDraft.name} onChange={(value) => setNewPetDraft((current) => ({ ...current, name: value }))} />
              <FormField label="품종" value={newPetDraft.breed} onChange={(value) => setNewPetDraft((current) => ({ ...current, breed: value }))} placeholder="예: 푸들, 말티즈" />
              <div className="grid grid-cols-2 gap-2">
                <FormField label="생년월일" value={newPetDraft.birthday} onChange={(value) => setNewPetDraft((current) => ({ ...current, birthday: value }))} placeholder="YYYY-MM-DD" />
                <FormField label="몸무게" value={newPetDraft.weight} onChange={(value) => setNewPetDraft((current) => ({ ...current, weight: value }))} placeholder="kg" />
              </div>
              <BiteLevelFormField value={newPetDraft.biteLevel} onChange={(biteLevel) => setNewPetDraft((current) => ({ ...current, biteLevel }))} />
              <ActionPanelFooter saving={saving} error={error} />
            </form>
          ) : null}
          {action === "notificationSettings" ? (
            <div className="space-y-3">
              <PanelNotice title="알림 상태" lines={[`전체 알림: ${detail.guardian.notification_settings.enabled !== false ? "ON" : "OFF"}`, `재방문 알림: ${detail.guardian.notification_settings.revisit_enabled !== false ? "ON" : "OFF"}`]} />
              <button
                type="button"
                onClick={() => void runSave(() => onToggleGuardianNotifications(detail.guardian.id))}
                className="h-10 w-full rounded-[8px] bg-[#2f7866] px-4 text-[16px] font-medium text-white hover:bg-[#286a5a] disabled:bg-[#94a3b8]"
                disabled={saving}
              >
                {detail.guardian.notification_settings.enabled !== false ? "알림 끄기" : "알림 켜기"}
              </button>
              {error ? <p className="text-[16px] text-[#a04455]">{error}</p> : null}
            </div>
          ) : null}
          {action === "appointments" ? (
            <PanelNotice title="예약" lines={detail.recentAppointments.map((appointment) => {
              const request = appointment.memo?.trim();
              return `${formatDateTime(appointment.appointment_date, appointment.appointment_time)} · ${getServiceName(detail.servicesById, appointment.service_id)} · ${getAppointmentStatusMeta(appointment.status).label}${request ? ` · 요청: ${request}` : ""}`;
            })} />
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
      <p className="text-[16px] font-semibold text-[#111827]">{title}</p>
      <div className="mt-3 space-y-2">
        {(lines.length > 0 ? lines : ["표시할 내용이 없습니다."]).map((line) => (
          <p key={line} className="text-[16px] leading-5 text-[#475569]">{line}</p>
        ))}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[16px] text-[#64748b]">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[96px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none focus:border-[#2f7866]"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
        />
      )}
    </label>
  );
}

function PetProfilePhotoField({ previewUrl, fileName, onChange }: { previewUrl: string; fileName: string; onChange: (file: File | null) => void }) {
  return (
    <div className="bg-transparent">
      <p className="mb-2 text-[16px] text-[#64748b]">프로필 사진</p>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white text-[#94a3b8]">
          {previewUrl ? <img src={previewUrl} alt="반려동물 프로필 미리보기" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#334155] hover:bg-[#f8fafc]">
            사진 선택
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                onChange(file);
              }}
            />
          </label>
          {fileName ? (
            <button type="button" onClick={() => onChange(null)} className="ml-2 h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#64748b] hover:bg-[#f8fafc]">
              삭제
            </button>
          ) : null}
          <p className="mt-1 truncate text-[15px] text-[#64748b]">{fileName || "JPG, PNG, WebP 이미지를 등록할 수 있습니다."}</p>
        </div>
      </div>
    </div>
  );
}

function BiteLevelFormField({ value, onChange }: { value: PetBiteLevel; onChange: (value: PetBiteLevel) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[16px] text-[#64748b]">입질 정도</span>
      <select
        value={value}
        onChange={(event) => onChange(normalizePetBiteLevel(event.target.value))}
        className="h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
      >
        {petBiteLevelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineEditableText({
  value,
  placeholder = "입력",
  ariaLabel,
  className,
  inputClassName,
  multiline = false,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  onCommit: (value: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  async function commit() {
    const nextValue = draft.trim();
    if (nextValue === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(nextValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    const commonClassName = cn(
      "w-full rounded-[7px] border border-[#2f7866] bg-white px-2 text-[#111827] outline-none",
      multiline ? "min-h-[84px] py-2 leading-6" : "h-8",
      inputClassName,
    );

    if (multiline) {
      return (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          disabled={saving}
          autoFocus
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={commonClassName}
        />
      );
    }

    return (
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void commit();
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={saving}
        autoFocus
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={commonClassName}
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className={cn("block max-w-full rounded-[6px] text-left hover:bg-[#f8fafc]", className)} aria-label={ariaLabel}>
      {value.trim() || placeholder}
    </button>
  );
}

function ActionPanelFooter({ saving, error }: { saving: boolean; error: string }) {
  return (
    <div className="space-y-2 pt-1">
      {error ? <p className="text-[16px] text-[#a04455]">{error}</p> : null}
      <button
        type="submit"
        className="h-10 w-full rounded-[8px] bg-[#2f7866] px-4 text-[16px] font-medium text-white hover:bg-[#286a5a] disabled:bg-[#94a3b8]"
        disabled={saving}
      >
        {saving ? "저장 중" : "저장"}
      </button>
    </div>
  );
}

function InfoRow({ label, value, alignTop = false }: { label: string; value: React.ReactNode; alignTop?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[92px_minmax(0,1fr)] gap-3 text-[16px]", alignTop ? "items-start" : "items-center")}>
      <span className="text-[#64748b]">{label}</span>
      <span className="min-w-0 text-[#111827]">{value}</span>
    </div>
  );
}

function getMediaByKind(assets: MediaAsset[], mediaKind: MediaKind) {
  return assets.find((asset) => asset.media_kind === mediaKind) ?? null;
}

function InlinePetInfo({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[16px] leading-6">
      <span className="text-[#64748b]">{label}</span>
      <span className="min-w-0 truncate text-[#111827]">{value}</span>
    </span>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={cn("inline-flex h-7 shrink-0 items-center rounded-[6px] border px-2.5 text-[16px] font-medium", className)}>{children}</span>;
}

function ToggleState({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-[16px] font-medium", enabled ? "bg-[#eef7f4] text-[#2f7866]" : "bg-[#f1f5f9] text-[#64748b]")}>
      {enabled ? "ON" : "OFF"}
    </span>
  );
}

function SmallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="h-8 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] text-[#475569] hover:bg-[#f8fafc]">{label}</button>;
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-3 py-4" : "min-h-[320px] px-6")}>
      <div className={cn("flex items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]", compact ? "h-8 w-8" : "h-10 w-10")}>
        <Sparkles className="h-4 w-4" />
      </div>
      <p className={cn("text-[16px] font-medium text-[#111827]", compact ? "mt-2" : "mt-3")}>{title}</p>
      <p className="mt-1 text-[16px] leading-5 text-[#64748b]">{description}</p>
    </div>
  );
}
