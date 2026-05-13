"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useMemo, useState } from "react";

import { serviceRows, staffRows } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  PrimaryButton,
  TableRow,
  TableShell,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";

type ServiceRow = (typeof serviceRows)[number];

const serviceInitialState = {
  name: "",
  duration: "60",
  price: "",
  staff: "전체 스태프",
};

function formatPrice(value: string) {
  const numericValue = Number(value.replace(/[^0-9]/g, ""));
  if (!numericValue) return "";
  return `${numericValue.toLocaleString("ko-KR")}원`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-[#334155]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
    >
      {children}
    </select>
  );
}

export default function ServiceManagementScreen() {
  const [services, setServices] = useState<ServiceRow[]>(serviceRows);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState(serviceInitialState);
  const [formError, setFormError] = useState("");
  const staffOptions = useMemo(() => staffRows.map((member) => member.name.replace(/\s?원장$/, "")), []);

  function closeDialog() {
    setDialogOpen(false);
    setFormError("");
  }

  function addService() {
    if (!serviceForm.name.trim()) {
      setFormError("서비스명을 입력해 주세요.");
      return;
    }

    const price = formatPrice(serviceForm.price);
    if (!price) {
      setFormError("가격을 숫자로 입력해 주세요.");
      return;
    }

    setServices((current) => [
      ...current,
      {
        name: serviceForm.name.trim(),
        duration: `${Number(serviceForm.duration) || 60}분`,
        price,
        capacity: "동일 시간 1건",
        staff: serviceForm.staff,
      },
    ]);
    setServiceForm(serviceInitialState);
    closeDialog();
  }

  return (
    <div className="space-y-5">
      <WebSectionTitle
        title="서비스"
        description="가격과 소요시간을 예약 가능 시간 계산 기준으로 관리합니다."
        action={<PrimaryButton label="서비스 추가" onClick={() => setDialogOpen(true)} />}
      />

      <TableShell columns={["서비스", "소요시간", "가격", "담당"]}>
        {services.map((service) => (
          <TableRow
            key={service.name}
            columns={[
              <p key="name" className="text-[15px] font-semibold text-[#111827]">{service.name}</p>,
              <p key="duration" className="text-[14px] text-[#334155]">{service.duration}</p>,
              <p key="price" className="text-[14px] font-medium text-[#111827]">{service.price}</p>,
              <p key="staff" className="text-[14px] text-[#64748b]">{service.staff}</p>,
            ]}
          />
        ))}
      </TableShell>

      <div className="grid gap-3 lg:grid-cols-3">
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">예약 기준</p>
          <p className="mt-2 text-[22px] font-semibold text-[#111827]">소요시간</p>
          <p className="mt-1 text-[13px] text-[#64748b]">서비스별 기본 예약 길이로 시간표를 계산합니다.</p>
        </WebSurface>
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">동일 시간</p>
          <p className="mt-2 text-[22px] font-semibold text-[#111827]">1건 확정</p>
          <p className="mt-1 text-[13px] text-[#64748b]">서비스 종류와 관계없이 확정 예약은 한 시간대에 1건만 받습니다.</p>
        </WebSurface>
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">담당 가능</p>
          <p className="mt-2 text-[22px] font-semibold text-[#111827]">스태프 연결</p>
          <p className="mt-1 text-[13px] text-[#64748b]">예약 배정 시 가능한 스태프만 선택되도록 확장합니다.</p>
        </WebSurface>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={closeDialog}>
          <div className="w-full max-w-[460px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-[20px] font-semibold text-[#111827]">서비스 추가</h3>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">가격표와 예약 가능 시간 계산에 사용할 서비스 정보를 입력합니다.</p>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="서비스명">
                <TextInput value={serviceForm.name} onChange={(name) => setServiceForm((form) => ({ ...form, name }))} placeholder="예: 전체 미용" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="소요시간">
                  <SelectInput value={serviceForm.duration} onChange={(duration) => setServiceForm((form) => ({ ...form, duration }))}>
                    <option value="45">45분</option>
                    <option value="60">60분</option>
                    <option value="90">90분</option>
                    <option value="120">120분</option>
                    <option value="150">150분</option>
                  </SelectInput>
                </Field>
              </div>
              <Field label="가격">
                <TextInput value={serviceForm.price} onChange={(price) => setServiceForm((form) => ({ ...form, price }))} placeholder="예: 65000" inputMode="numeric" />
              </Field>
              <Field label="담당 스태프">
                <SelectInput value={serviceForm.staff} onChange={(staff) => setServiceForm((form) => ({ ...form, staff }))}>
                  <option value="전체 스태프">전체 스태프</option>
                  {staffOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {formError ? <p className="mt-4 text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <GhostButton label="취소" onClick={closeDialog} />
              <PrimaryButton label="서비스 저장" onClick={addService} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
