"use client";

import { useEffect, useMemo, useState } from "react";

import { serviceRows, staffRows } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  MiniSection,
  PrimaryButton,
  SoftSelect,
  TableRow,
  TableShell,
  WebSectionTitle,
} from "@/components/owner-web/owner-web-ui";

type ServiceRow = (typeof serviceRows)[number];
type StaffRow = (typeof staffRows)[number];
type DialogMode = "service" | "staff" | null;

const serviceInitialState = {
  name: "",
  duration: "60",
  price: "",
  capacity: "1",
  staff: "전체 직원",
};

const servicesStorageKey = "petmanager.ownerWeb.services";
const staffStorageKey = "petmanager.ownerWeb.staff";

const staffInitialState = {
  name: "",
  role: "",
  start: "10:00",
  end: "19:00",
};

function formatPrice(value: string) {
  const numericValue = Number(value.replace(/[^0-9]/g, ""));
  if (!numericValue) return "";
  return `${numericValue.toLocaleString("ko-KR")}원`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
}) {
  return (
    <input
      type={type}
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
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <SoftSelect
      value={value}
      onChange={onChange}
      options={options}
      align="left"
      buttonClassName="h-11 bg-[#f8fafc] focus:bg-white"
    />
  );
}

export default function ServiceStaffManagementScreen() {
  const [services, setServices] = useState<ServiceRow[]>(serviceRows);
  const [staff, setStaff] = useState<StaffRow[]>(staffRows);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [serviceForm, setServiceForm] = useState(serviceInitialState);
  const [staffForm, setStaffForm] = useState(staffInitialState);
  const [formError, setFormError] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  const staffOptions = useMemo(() => staff.map((member) => member.name.replace(/\s원장$/, "")), [staff]);

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(servicesStorageKey);
      const storedStaff = window.localStorage.getItem(staffStorageKey);

      if (storedServices) setServices(JSON.parse(storedServices) as ServiceRow[]);
      if (storedStaff) setStaff(JSON.parse(storedStaff) as StaffRow[]);
    } catch {
      window.localStorage.removeItem(servicesStorageKey);
      window.localStorage.removeItem(staffStorageKey);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(servicesStorageKey, JSON.stringify(services));
  }, [services, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(staffStorageKey, JSON.stringify(staff));
  }, [staff, storageReady]);

  function openDialog(mode: Exclude<DialogMode, null>) {
    setDialogMode(mode);
    setFormError("");
  }

  function closeDialog() {
    setDialogMode(null);
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
        capacity: `동시 ${Number(serviceForm.capacity) || 1}건`,
        staff: serviceForm.staff,
      },
    ]);
    setServiceForm(serviceInitialState);
    closeDialog();
  }

  function addStaff() {
    if (!staffForm.name.trim()) {
      setFormError("직원 이름을 입력해 주세요.");
      return;
    }

    if (!staffForm.role.trim()) {
      setFormError("담당 가능한 서비스를 입력해 주세요.");
      return;
    }

    setStaff((current) => [
      ...current,
      {
        name: staffForm.name.trim(),
        role: staffForm.role.trim(),
        hours: `${staffForm.start} - ${staffForm.end}`,
        today: "예약 0건",
      },
    ]);
    setStaffForm(staffInitialState);
    closeDialog();
  }

  return (
    <div className="space-y-5">
      <WebSectionTitle
        title="서비스/직원"
        description="서비스 소요시간, 가격, 동시 수용 수, 담당자 근무 정보를 예약 가능 시간 계산과 연결합니다."
        action={<PrimaryButton label="서비스 추가" onClick={() => openDialog("service")} />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <TableShell columns={["서비스", "소요시간", "가격", "수용", "담당"]}>
          {services.map((service) => (
            <TableRow
              key={service.name}
              columns={[
                <p key="name" className="text-[15px] font-semibold text-[#111827]">{service.name}</p>,
                <p key="duration" className="text-[14px] text-[#334155]">{service.duration}</p>,
                <p key="price" className="text-[14px] font-medium text-[#111827]">{service.price}</p>,
                <p key="capacity" className="text-[14px] text-[#334155]">{service.capacity}</p>,
                <p key="staff" className="text-[14px] text-[#64748b]">{service.staff}</p>,
              ]}
            />
          ))}
        </TableShell>

        <MiniSection title="직원 근무" action={<PrimaryButton label="직원 추가" onClick={() => openDialog("staff")} />}>
          <div className="space-y-3">
            {staff.map((staffMember) => (
              <div key={staffMember.name} className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#111827]">{staffMember.name}</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">{staffMember.role}</p>
                  </div>
                  <span className="rounded-[8px] bg-white px-2.5 py-1 text-[12px] font-medium text-[#2f7866]">{staffMember.today}</span>
                </div>
                <p className="mt-3 text-[13px] text-[#334155]">근무 {staffMember.hours}</p>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-2">
              <GhostButton label="근무표 수정" />
              <GhostButton label="담당 가능 서비스" />
            </div>
          </div>
        </MiniSection>
      </div>

      {dialogMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={closeDialog}>
          <div className="w-full max-w-[460px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-[20px] font-semibold text-[#111827]">
                {dialogMode === "service" ? "서비스 추가" : "직원 추가"}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                {dialogMode === "service"
                  ? "가격표에 표시되고 예약 가능 시간 계산에 사용할 서비스 정보를 입력합니다."
                  : "직원 카드에 표시할 담당 서비스와 오늘 근무 시간을 입력합니다."}
              </p>
            </div>

            {dialogMode === "service" ? (
              <div className="mt-5 space-y-4">
                <Field label="서비스명">
                  <TextInput value={serviceForm.name} onChange={(name) => setServiceForm((form) => ({ ...form, name }))} placeholder="예: 스포팅" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="소요시간">
                    <SelectInput
                      value={serviceForm.duration}
                      onChange={(duration) => setServiceForm((form) => ({ ...form, duration }))}
                      options={[
                        { value: "45", label: "45분" },
                        { value: "60", label: "60분" },
                        { value: "90", label: "90분" },
                        { value: "120", label: "120분" },
                        { value: "150", label: "150분" },
                      ]}
                    />
                  </Field>
                  <Field label="동시 수용">
                    <SelectInput
                      value={serviceForm.capacity}
                      onChange={(capacity) => setServiceForm((form) => ({ ...form, capacity }))}
                      options={[
                        { value: "1", label: "동시 1건" },
                        { value: "2", label: "동시 2건" },
                        { value: "3", label: "동시 3건" },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="가격">
                  <TextInput value={serviceForm.price} onChange={(price) => setServiceForm((form) => ({ ...form, price }))} placeholder="예: 65000" inputMode="numeric" />
                </Field>
                <Field label="담당 직원">
                  <SelectInput
                    value={serviceForm.staff}
                    onChange={(nextStaff) => setServiceForm((form) => ({ ...form, staff: nextStaff }))}
                    options={[
                      { value: "전체 직원", label: "전체 직원" },
                      ...staffOptions.map((option) => ({ value: option, label: option })),
                    ]}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <Field label="직원 이름">
                  <TextInput value={staffForm.name} onChange={(name) => setStaffForm((form) => ({ ...form, name }))} placeholder="예: 민서윤" />
                </Field>
                <Field label="담당 가능 서비스">
                  <TextInput value={staffForm.role} onChange={(role) => setStaffForm((form) => ({ ...form, role }))} placeholder="예: 목욕 / 위생 미용" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="출근 시간">
                    <TextInput value={staffForm.start} onChange={(start) => setStaffForm((form) => ({ ...form, start }))} type="time" />
                  </Field>
                  <Field label="퇴근 시간">
                    <TextInput value={staffForm.end} onChange={(end) => setStaffForm((form) => ({ ...form, end }))} type="time" />
                  </Field>
                </div>
              </div>
            )}

            {formError ? <p className="mt-4 text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <GhostButton label="취소" onClick={closeDialog} />
              <PrimaryButton label={dialogMode === "service" ? "서비스 저장" : "직원 저장"} onClick={dialogMode === "service" ? addService : addStaff} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
