"use client";

import { ImagePlus } from "lucide-react";
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
  shopProfileImage: string;
  onProfileImageChange: (file: File) => void;
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
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit?.(event.target.value)}
      className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#6D4AFF] focus:ring-2 focus:ring-[#6D4AFF]/10"
    />
  );
}

function SelectInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-22px)_16px,calc(100%-17px)_16px] bg-no-repeat px-3 pr-10 text-[14px] font-medium text-[#111827] outline-none transition focus:border-[#6D4AFF] focus:ring-2 focus:ring-[#6D4AFF]/10"
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
    <span className="text-[14px] font-medium text-[#111827]">
      {children}
      {required ? <span className="ml-1 text-[#6D4AFF]">*</span> : null}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#e5e7eb] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-3 text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">{title}</h3>
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

export default function ShopInfoSettingsPanel({
  rows,
  shopProfileImage,
  onProfileImageChange,
  onRowChange,
  onRowCommit,
  onOpenAddressSearch,
}: ShopInfoSettingsPanelProps) {
  const shopName = rowValue(rows, "shopName");
  const description = rowValue(rows, "description");
  const phone = rowValue(rows, "phone");
  const additionalContact = rowValue(rows, "additionalContact");
  const postalCode = rowValue(rows, "postalCode");
  const address = rowValue(rows, "address");
  const addressDetail = rowValue(rows, "addressDetail");
  const approvalMode = rowValue(rows, "approvalMode");
  const cancelWindow = rowValue(rows, "cancelWindow");

  return (
    <div>
      <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
          <div>
            <Section title="매장 프로필">
              <SettingRow label="매장 사진" alignTop>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative block h-[108px] w-[108px] cursor-pointer overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc] text-[#6D4AFF]">
                    {shopProfileImage ? (
                      <Image src={shopProfileImage} alt="매장 사진" width={108} height={108} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <ImagePlus className="h-7 w-7" />
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onProfileImageChange(file);
                      }}
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => document.getElementById("shop-profile-image-input")?.click()}
                      className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-bold text-[#111827] transition hover:border-[#6D4AFF] hover:text-[#6D4AFF]"
                    >
                      사진 변경
                    </button>
                    <input
                      id="shop-profile-image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onProfileImageChange(file);
                      }}
                    />
                    <p className="mt-2 text-[12px] leading-5 text-[#64748b]">권장 사이즈 800x800px<br />JPG/PNG, 최대 5MB</p>
                  </div>
                </div>
              </SettingRow>

              <SettingRow label="매장명" required>
                <TextInput value={shopName} onChange={(value) => onRowChange("shopName", value)} onCommit={(value) => onRowCommit("shopName", value)} />
              </SettingRow>

              <SettingRow label="매장 소개" alignTop>
                <div>
                  <textarea
                    value={description}
                    maxLength={100}
                    onChange={(event) => onRowChange("description", event.target.value)}
                    onBlur={(event) => onRowCommit("description", event.target.value)}
                    className="min-h-[70px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] font-medium leading-5 text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#6D4AFF] focus:ring-2 focus:ring-[#6D4AFF]/10"
                    placeholder="매장을 짧게 소개해 주세요."
                  />
                  <p className="mt-1 text-right text-[12px] font-semibold text-[#64748b]">{description.length} / 100</p>
                </div>
              </SettingRow>

            </Section>

            <Section title="대표 연락처">
              <SettingRow label="대표 전화번호" required>
                <TextInput value={phone} onChange={(value) => onRowChange("phone", value)} onCommit={(value) => onRowCommit("phone", value)} />
              </SettingRow>

              <SettingRow label="추가 연락처">
                <TextInput
                  value={additionalContact}
                  placeholder="추가 연락처를 입력하세요."
                  onChange={(value) => onRowChange("additionalContact", value)}
                  onCommit={(value) => onRowCommit("additionalContact", value)}
                />
              </SettingRow>

            </Section>

            <Section title="주소">
              <div>
                <div className="space-y-3">
                  <SettingRow label="우편번호">
                    <div className="flex max-w-[360px] gap-2">
                      <TextInput
                        value={postalCode}
                        onChange={(value) => onRowChange("postalCode", value)}
                        onCommit={(value) => onRowCommit("postalCode", value)}
                      />
                      <button
                        type="button"
                        onClick={onOpenAddressSearch}
                        className="h-10 shrink-0 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-bold text-[#111827] transition hover:border-[#6D4AFF] hover:text-[#6D4AFF]"
                      >
                        우편번호 찾기
                      </button>
                    </div>
                  </SettingRow>

                  <SettingRow label="주소" required>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onOpenAddressSearch}
                        className="flex h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-left text-[14px] font-medium text-[#111827] transition hover:border-[#6D4AFF]"
                      >
                        <span className="truncate">{address || "주소 검색으로 매장 주소를 선택해 주세요."}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenAddressSearch}
                        className="hidden h-10 shrink-0 rounded-[8px] border border-transparent px-3 text-[13px] font-bold text-[#6D4AFF] sm:inline-flex sm:items-center"
                      >
                        주소 검색
                      </button>
                    </div>
                  </SettingRow>

                  <SettingRow label="상세주소">
                    <TextInput
                      value={addressDetail}
                      placeholder="층, 호수 등 상세 주소"
                      onChange={(value) => onRowChange("addressDetail", value)}
                      onCommit={(value) => onRowCommit("addressDetail", value)}
                    />
                  </SettingRow>

                </div>
              </div>
            </Section>

            <Section title="예약 정책">
              <SettingRow label="동일 시간 예약 규칙" alignTop>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      label: "바로 승인",
                      mode: "바로 승인",
                      description: "고객의 예약 접수 요청시 예약이 바로 확정됩니다.",
                    },
                    {
                      label: "직접 승인",
                      mode: "직접 승인",
                      description: "모든 예약을 직접 승인 후 확정합니다.",
                    },
                  ].map((option) => {
                    const selected = approvalMode === option.mode;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => onRowChange("approvalMode", option.mode)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition",
                          selected ? "border-[#6D4AFF] bg-[#f7f4ff]" : "border-[#dbe2ea] bg-white hover:border-[#cfc5ff]",
                        )}
                      >
                        <span className={cn("mt-0.5 h-3.5 w-3.5 rounded-full border", selected ? "border-[#6D4AFF] bg-[#6D4AFF] shadow-[inset_0_0_0_3.5px_white]" : "border-[#cbd5e1]")} />
                        <span>
                          <span className="block text-[13px] font-bold text-[#111827]">{option.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-[#64748b]">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SettingRow>

              <SettingRow label="승인 방식">
                <div className="max-w-[320px]">
                  <SelectInput value={approvalMode} options={rowOptions(rows, "approvalMode")} onChange={(value) => onRowChange("approvalMode", value)} />
                </div>
              </SettingRow>

              <SettingRow label="취소 허용 시간">
                <div className="max-w-[320px]">
                  <SelectInput value={cancelWindow} options={rowOptions(rows, "cancelWindow")} onChange={(value) => onRowChange("cancelWindow", value)} />
                </div>
              </SettingRow>

            </Section>
          </div>

          <p className="mt-4 text-[12px] font-medium text-[#64748b]">* 필수 입력 항목입니다.</p>
      </section>
    </div>
  );
}
