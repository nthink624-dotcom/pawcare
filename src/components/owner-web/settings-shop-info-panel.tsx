"use client";

import { ImagePlus, Info } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ShopInfoSettingRow = {
  id: string;
  label: string;
  value: string | boolean | number;
  options?: string[];
};

type ShopInfoSettingsPanelProps = {
  rows: ShopInfoSettingRow[];
  shopProfileImages: string[];
  editable?: boolean;
  saving?: boolean;
  onSave?: () => void | Promise<void>;
  onProfileImagesAdd: (files: FileList | File[]) => void;
  onProfileImageRemove: (index: number) => void;
  onRowChange: (rowId: string, value: ShopInfoSettingRow["value"]) => void;
  onRowCommit: (rowId: string, value: ShopInfoSettingRow["value"]) => void;
  onOpenAddressSearch: () => void;
};

function rowValue(rows: ShopInfoSettingRow[], rowId: string) {
  return String(rows.find((row) => row.id === rowId)?.value ?? "");
}

function rowOptions(rows: ShopInfoSettingRow[], rowId: string) {
  return rows.find((row) => row.id === rowId)?.options ?? [];
}

function TextInput({
  value,
  placeholder,
  onChange,
  onCommit,
  maxLength,
  disabled = false,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit?.(event.target.value)}
      className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#111827] outline-none transition placeholder:text-[#9ca3af] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
    />
  );
}

function SelectInput({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-22px)_16px,calc(100%-17px)_16px] bg-no-repeat px-3 pr-10 text-[16px] font-medium text-[#111827] outline-none transition disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-[16px] font-normal text-[#111827]">
      {children}
      {required ? <span className="ml-1 text-[#2f7866]">*</span> : null}
    </span>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#e5e7eb] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  required,
  children,
  alignTop = false,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-[148px_minmax(0,1fr)]", alignTop ? "sm:items-start" : "sm:items-center")}>
      <div className={cn(alignTop && "pt-2")}>
        <FieldLabel required={required}>{label}</FieldLabel>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OptionCard({
  selected,
  disabled,
  title,
  description,
  helpText,
  tone = "default",
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description?: string;
  helpText?: string;
  tone?: "default" | "success" | "warning" | "danger";
  onClick: () => void;
}) {
  const selectedToneClass =
    tone === "danger"
      ? "border-[#a04455] bg-[#fff5f7]"
      : tone === "warning"
        ? "border-[#b98121] bg-[#fffaf0]"
        : tone === "success"
          ? "border-[#2f7866] bg-[#f3fbf7]"
          : "border-[#2f7866] bg-white";
  const dotToneClass =
    tone === "danger"
      ? "border-[#a04455] bg-[#a04455]"
      : tone === "warning"
        ? "border-[#b98121] bg-[#b98121]"
        : "border-[#2f7866] bg-[#2f7866]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition",
        selected ? selectedToneClass : "border-[#dbe2ea] bg-white hover:border-[#bad8cd]",
        disabled && "cursor-wait",
      )}
    >
      <span
        className={cn(
          "h-3.5 w-3.5 shrink-0 rounded-full border",
          selected ? `${dotToneClass} shadow-[inset_0_0_0_3.5px_white]` : "border-[#cbd5e1]",
        )}
      />
      <span className="min-w-0">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[16px] font-normal leading-6 text-[#111827]">
          <span className="truncate">{title}</span>
          {helpText ? (
            <span className="group relative inline-flex h-6 w-4 shrink-0 items-center justify-center">
              <Info className="block h-4 w-4 translate-y-[0.5px] text-[#94a3b8]" aria-hidden="true" />
              <span className="pointer-events-none absolute left-1/2 top-6 z-30 w-[240px] -translate-x-1/2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                {helpText}
              </span>
            </span>
          ) : null}
        </span>
        {description ? <span className="mt-0.5 block text-[11px] leading-4 text-[#64748b]">{description}</span> : null}
      </span>
    </button>
  );
}

export default function ShopInfoSettingsPanel({
  rows,
  shopProfileImages,
  editable = true,
  saving = false,
  onSave,
  onProfileImagesAdd,
  onProfileImageRemove,
  onRowChange,
  onRowCommit,
  onOpenAddressSearch,
}: ShopInfoSettingsPanelProps) {
  const shopName = rowValue(rows, "shopName");
  const description = rowValue(rows, "description");
  const phone = rowValue(rows, "phone");
  const additionalContact = rowValue(rows, "additionalContact");
  const address = rowValue(rows, "address");
  const addressDetail = rowValue(rows, "addressDetail");
  const approvalMode = rowValue(rows, "approvalMode");
  const pendingHoldLimit = rowValue(rows, "pendingHoldLimit") || "1건만 받기";
  const cancelWindow = rowValue(rows, "cancelWindow");
  const autoApproval = approvalMode === "바로 승인" || approvalMode === "auto";
  const manualApproval = !autoApproval;
  const profileImages = shopProfileImages.slice(0, 10);
  const canAddProfileImages = editable && profileImages.length < 10;

  const profileAction = (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="h-10 rounded-[8px] bg-[#2f7866] px-5 text-[16px] font-semibold text-white transition hover:bg-[#276756] disabled:bg-[#cbd5e1] disabled:text-white"
    >
      {saving ? "저장 중" : "저장"}
    </button>
  );

  return (
    <div>
      <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
        <div>
          <Section title="매장 프로필" action={profileAction}>
            <SettingRow label="매장 사진" alignTop>
              <div className="space-y-3">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
                  {profileImages.map((imageUrl, index) => (
                    <div key={`${imageUrl}-${index}`} className="group relative h-[92px] overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-white">
                      <Image src={imageUrl} alt={`매장 사진 ${index + 1}`} width={92} height={92} unoptimized className="h-full w-full object-cover" />
                      {index === 0 ? (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2f7866] px-2 py-0.5 text-[11px] font-semibold text-white">대표</span>
                      ) : null}
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => onProfileImageRemove(index)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[#64748b] shadow-sm transition hover:text-[#a04455]"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canAddProfileImages ? (
                    <button
                      type="button"
                      onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                      className="flex h-[92px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-[#bad8cd] bg-white text-[#2f7866] transition hover:border-[#2f7866] hover:bg-[#f6fbf8]"
                    >
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[12px] font-semibold">사진 추가</span>
                    </button>
                  ) : null}
                </div>
                <input
                  id="shop-profile-images-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={!editable}
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      onProfileImagesAdd(event.target.files);
                    }
                    event.currentTarget.value = "";
                  }}
                />
                <p className="text-[12px] leading-5 text-[#64748b]">첫 번째 사진이 대표 이미지로 사용됩니다. 최대 10장, JPG/PNG, 각 5MB 권장</p>
              </div>
            </SettingRow>

            <SettingRow label="매장명" required>
              <TextInput value={shopName} disabled={!editable} onChange={(value) => onRowChange("shopName", value)} onCommit={(value) => onRowCommit("shopName", value)} />
            </SettingRow>

            <SettingRow label="매장 소개" alignTop>
              <div>
                <textarea
                  value={description}
                  maxLength={100}
                  disabled={!editable}
                  onChange={(event) => onRowChange("description", event.target.value)}
                  onBlur={(event) => onRowCommit("description", event.target.value)}
                  className="min-h-[70px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] font-medium leading-5 text-[#111827] outline-none transition placeholder:text-[#9ca3af] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
                  placeholder="매장을 짧게 소개해 주세요."
                />
                <p className="mt-1 text-right text-[12px] font-semibold text-[#64748b]">{description.length} / 100</p>
              </div>
            </SettingRow>
          </Section>

          <Section title="대표 연락처">
            <SettingRow label="대표 전화번호" required>
              <TextInput value={phone} disabled={!editable} onChange={(value) => onRowChange("phone", value)} onCommit={(value) => onRowCommit("phone", value)} />
            </SettingRow>

            <SettingRow label="추가 연락처">
              <TextInput
                value={additionalContact}
                placeholder="추가 연락처를 입력하세요."
                disabled={!editable}
                onChange={(value) => onRowChange("additionalContact", value)}
                onCommit={(value) => onRowCommit("additionalContact", value)}
              />
            </SettingRow>
          </Section>

          <Section title="매장 주소">
            <SettingRow label="주소" required>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!editable}
                  onClick={onOpenAddressSearch}
                  className="flex h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-left text-[16px] font-medium text-[#111827] transition hover:border-[#2f7866] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827]"
                >
                  <span className="truncate">{address || "주소 검색으로 매장 주소를 선택해 주세요."}</span>
                </button>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={onOpenAddressSearch}
                  className="hidden h-10 shrink-0 rounded-[8px] border border-transparent px-3 text-[13px] font-bold text-[#2f7866] disabled:text-[#111827] sm:inline-flex sm:items-center"
                >
                  주소 검색
                </button>
              </div>
            </SettingRow>

            <SettingRow label="상세주소">
              <TextInput
                value={addressDetail}
                placeholder="층, 호수 등 상세 주소"
                disabled={!editable}
                onChange={(value) => onRowChange("addressDetail", value)}
                onCommit={(value) => onRowCommit("addressDetail", value)}
              />
            </SettingRow>
          </Section>

          <Section title="예약 정책">
            <SettingRow label="승인 방식" alignTop>
              <div className="grid gap-2 sm:grid-cols-2">
                <OptionCard
                  selected={autoApproval}
                  disabled={saving}
                  title="바로 승인"
                  helpText="고객이 가능한 시간을 선택하면 예약이 즉시 확정됩니다."
                  onClick={() => onRowCommit("approvalMode", "바로 승인")}
                />
                <OptionCard
                  selected={manualApproval}
                  disabled={saving}
                  title="직접 승인"
                  helpText="고객 예약은 승인 대기로 들어오고, 오너가 확인 후 확정하거나 거절합니다."
                  onClick={() => onRowCommit("approvalMode", "직접 승인")}
                />
              </div>
            </SettingRow>

            {manualApproval ? (
              <div className="grid gap-2 sm:grid-cols-[148px_minmax(0,1fr)]">
                <span className="hidden sm:block" />
                <div className="rounded-[10px] border border-[#dbe2ea] bg-[#fbfcfd] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-[13px] font-normal text-[#334155]">겹치는 예약 설정</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <OptionCard
                      selected={pendingHoldLimit === "1건만 받기" || pendingHoldLimit === "1건 홀드"}
                      disabled={saving}
                      title="1건만 받기"
                      helpText="예약 요청 1건이 들어오면 해당 시간은 다른 고객에게 보이지 않습니다."
                      tone="warning"
                      onClick={() => onRowCommit("pendingHoldLimit", "1건만 받기")}
                    />
                    <OptionCard
                      selected={pendingHoldLimit === "2건까지 받아두기" || pendingHoldLimit === "2건까지 받기"}
                      disabled={saving}
                      title="2건까지 받아두기"
                      helpText="같은 시간대에 승인 대기 요청을 최대 2건까지 받을 수 있습니다."
                      tone="success"
                      onClick={() => onRowCommit("pendingHoldLimit", "2건까지 받아두기")}
                    />
                    <OptionCard
                      selected={pendingHoldLimit === "3건 이상 받아두기"}
                      disabled={saving}
                      title="3건 이상 받아두기"
                      helpText="한 시간대에 승인 대기 요청을 3건까지 받을 수 있습니다. 오너가 비교하고 안내해야 할 예약이 많아져 관리하기 힘들 수 있어 추천하지 않습니다."
                      tone="danger"
                      onClick={() => onRowCommit("pendingHoldLimit", "3건 이상 받아두기")}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <SettingRow label="취소 허용 시간">
              <div className="max-w-[320px]">
                <SelectInput value={cancelWindow} options={rowOptions(rows, "cancelWindow")} disabled={!editable} onChange={(value) => onRowChange("cancelWindow", value)} />
              </div>
            </SettingRow>
          </Section>
        </div>

        <p className="mt-4 text-[12px] font-medium text-[#64748b]">* 필수 입력 항목입니다.</p>
      </section>
    </div>
  );
}
