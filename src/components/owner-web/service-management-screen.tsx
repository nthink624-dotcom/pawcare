"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { serviceRows } from "@/components/owner-web/owner-web-data";
import type { OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import {
  GhostButton,
  PrimaryButton,
  SoftSelect,
  TableRow,
  TableShell,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";

type BaseServiceRow = (typeof serviceRows)[number];

type ManagedService = BaseServiceRow & {
  id: string;
  category: string;
  visible: boolean;
  description: string;
  order: number;
};

type ServiceForm = {
  id: string | null;
  name: string;
  category: string;
  duration: string;
  price: string;
  staff: string;
  visible: boolean;
  description: string;
};

const servicesStorageKey = "petmanager.ownerWeb.services";

const categoryOptions = ["미용", "목욕", "위생", "옵션"];
const durationOptions = ["30", "45", "60", "90", "120", "150", "180"];

const emptyServiceForm: ServiceForm = {
  id: null,
  name: "",
  category: "미용",
  duration: "60",
  price: "",
  staff: "전체 스태프",
  visible: true,
  description: "",
};

function createServiceId() {
  return `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseMinutes(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) || 60;
}

function parsePrice(value: string) {
  return Number(value.replace(/[^0-9]/g, ""));
}

function formatPrice(value: string) {
  const numericValue = parsePrice(value);
  if (!numericValue) return "";
  return `${numericValue.toLocaleString("ko-KR")}원`;
}

function inferCategory(serviceName: string) {
  if (serviceName.includes("목욕")) return "목욕";
  if (serviceName.includes("위생")) return "위생";
  if (serviceName.includes("부분")) return "옵션";
  return "미용";
}

function normalizeServices(rows: unknown): ManagedService[] {
  const source = Array.isArray(rows) ? rows : serviceRows;

  return source.map((item, index) => {
    const row = item as Partial<ManagedService>;
    const name = typeof row.name === "string" && row.name.trim() ? row.name : `서비스 ${index + 1}`;

    return {
      id: typeof row.id === "string" && row.id ? row.id : `service-${index + 1}`,
      name,
      category: typeof row.category === "string" && row.category ? row.category : inferCategory(name),
      duration: typeof row.duration === "string" && row.duration ? row.duration : "60분",
      price: typeof row.price === "string" && row.price ? row.price : "0원",
      capacity: typeof row.capacity === "string" && row.capacity ? row.capacity : "동일 시간 1건",
      staff: typeof row.staff === "string" && row.staff ? row.staff : "직원 미지정",
      visible: typeof row.visible === "boolean" ? row.visible : true,
      description: typeof row.description === "string" ? row.description : "",
      order: typeof row.order === "number" ? row.order : index + 1,
    };
  });
}

function buildForm(service: ManagedService): ServiceForm {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    duration: String(parseMinutes(service.duration)),
    price: String(parsePrice(service.price) || ""),
    staff: service.staff,
    visible: service.visible,
    description: service.description,
  };
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

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5 text-[14px] leading-6 text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
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
  options: Array<{ value: string; label: string; meta?: string }>;
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

function VisibilityBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[46px] items-center justify-center whitespace-nowrap rounded-[8px] px-2.5 text-[12px] font-semibold leading-none",
        visible ? "bg-[#edf7f3] text-[#2f7866]" : "bg-[#f1f5f9] text-[#64748b]",
      )}
    >
      {visible ? "노출" : "숨김"}
    </span>
  );
}

export default function ServiceManagementScreen({ staffMembers = [] }: { staffMembers?: OwnerWebStaffMember[] }) {
  const [services, setServices] = useState<ManagedService[]>(() => normalizeServices(serviceRows));
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [serviceForm, setServiceForm] = useState<ServiceForm>(() => buildForm(services[0] ?? normalizeServices(serviceRows)[0]));
  const [formError, setFormError] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  const staffOptions = useMemo(() => staffMembers.map((member) => member.name), [staffMembers]);
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(servicesStorageKey);
      if (storedServices) {
        const nextServices = normalizeServices(JSON.parse(storedServices));
        setServices(nextServices);
        setSelectedServiceId(nextServices[0]?.id ?? "");
        setServiceForm(nextServices[0] ? buildForm(nextServices[0]) : emptyServiceForm);
      }
    } catch {
      window.localStorage.removeItem(servicesStorageKey);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(servicesStorageKey, JSON.stringify(services));
  }, [services, storageReady]);

  function selectService(service: ManagedService) {
    setSelectedServiceId(service.id);
    setServiceForm(buildForm(service));
    setFormError("");
  }

  function startNewService() {
    setSelectedServiceId("");
    setServiceForm(emptyServiceForm);
    setFormError("");
  }

  function saveService() {
    if (!serviceForm.name.trim()) {
      setFormError("서비스명을 입력해 주세요.");
      return;
    }

    const price = formatPrice(serviceForm.price);
    if (!price) {
      setFormError("가격을 숫자로 입력해 주세요.");
      return;
    }

    const nextService: ManagedService = {
      id: serviceForm.id ?? createServiceId(),
      name: serviceForm.name.trim(),
      category: serviceForm.category,
      duration: `${Number(serviceForm.duration) || 60}분`,
      price,
      capacity: "동일 시간 1건",
      staff: serviceForm.staff,
      visible: serviceForm.visible,
      description: serviceForm.description.trim(),
      order: serviceForm.id ? (selectedService?.order ?? services.length + 1) : services.length + 1,
    };

    setServices((current) => {
      const exists = current.some((service) => service.id === nextService.id);
      return exists
        ? current.map((service) => (service.id === nextService.id ? nextService : service))
        : [...current, nextService];
    });
    setSelectedServiceId(nextService.id);
    setServiceForm(buildForm(nextService));
    setFormError("");
  }

  function duplicateService(service: ManagedService) {
    const duplicated = {
      ...service,
      id: createServiceId(),
      name: `${service.name} 복사본`,
      order: services.length + 1,
    };
    setServices((current) => [...current, duplicated]);
    selectService(duplicated);
  }

  function toggleVisibility(service: ManagedService) {
    const nextService = { ...service, visible: !service.visible };
    setServices((current) => current.map((item) => (item.id === service.id ? nextService : item)));
    if (selectedServiceId === service.id) {
      setServiceForm(buildForm(nextService));
    }
  }

  return (
    <div className="space-y-5">
      <WebSectionTitle
        title="서비스"
        description="고객 예약 화면에 노출되는 서비스, 가격, 소요시간을 관리합니다."
        action={<PrimaryButton label="서비스 추가" onClick={startNewService} />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <TableShell columns={["서비스", "카테고리", "소요시간", "가격", "담당", "예약 노출", "관리"]} align="center">
          {services.map((service) => (
            <TableRow
              key={service.id}
              active={selectedServiceId === service.id}
              onClick={() => selectService(service)}
              className="py-3"
              align="center"
              columns={[
                <div key="name" className="min-w-0 text-center">
                  <p className="truncate text-[18px] font-normal text-[#111827]">{service.name}</p>
                  {service.description ? <p className="mt-1 truncate text-[12px] text-[#64748b]">{service.description}</p> : null}
                </div>,
                <p key="category" className="text-[14px] text-[#334155]">{service.category}</p>,
                <p key="duration" className="text-[14px] text-[#334155]">{service.duration}</p>,
                <p key="price" className="text-[14px] font-medium text-[#111827]">{service.price}</p>,
                <p key="staff" className={cn("text-[14px]", service.staff === "직원 미지정" ? "font-medium text-[#b91c1c]" : "text-[#64748b]")}>
                  {service.staff}
                </p>,
                <VisibilityBadge key="visible" visible={service.visible} />,
                <div key="actions" className="flex flex-wrap justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectService(service);
                    }}
                    className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleVisibility(service);
                    }}
                    className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    {service.visible ? "숨김" : "노출"}
                  </button>
                </div>,
              ]}
            />
          ))}
        </TableShell>

        <WebSurface className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] pb-4">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">SERVICE</p>
              <h3 className="mt-2 text-[22px] font-semibold text-[#111827]">
                {serviceForm.id ? "서비스 수정" : "서비스 추가"}
              </h3>
              <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
                가격과 소요시간은 고객 예약 화면과 예약 가능 시간 계산에 함께 사용됩니다.
              </p>
            </div>
            {serviceForm.id ? <VisibilityBadge visible={serviceForm.visible} /> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Field label="서비스명">
              <TextInput
                value={serviceForm.name}
                onChange={(name) => setServiceForm((form) => ({ ...form, name }))}
                placeholder="예: 전체 미용"
              />
            </Field>

            <Field label="카테고리">
              <SelectInput
                value={serviceForm.category}
                onChange={(category) => setServiceForm((form) => ({ ...form, category }))}
                options={categoryOptions.map((option) => ({ value: option, label: option }))}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="소요시간">
                <SelectInput
                  value={serviceForm.duration}
                  onChange={(duration) => setServiceForm((form) => ({ ...form, duration }))}
                  options={durationOptions.map((option) => ({ value: option, label: `${option}분` }))}
                />
              </Field>
              <Field label="가격">
                <TextInput
                  value={serviceForm.price}
                  onChange={(price) => setServiceForm((form) => ({ ...form, price }))}
                  placeholder="예: 65000"
                  inputMode="numeric"
                />
              </Field>
            </div>

            <Field label="담당 가능 직원">
              <SelectInput
                value={serviceForm.staff}
                onChange={(staff) => setServiceForm((form) => ({ ...form, staff }))}
                options={[
                  { value: "전체 스태프", label: "전체 스태프" },
                  { value: "직원 미지정", label: "직원 미지정" },
                  ...staffOptions.map((option) => ({ value: option, label: option })),
                ]}
              />
            </Field>

            <Field label="고객 예약 화면 노출">
              <button
                type="button"
                onClick={() => setServiceForm((form) => ({ ...form, visible: !form.visible }))}
                className={cn(
                  "flex h-11 w-full items-center justify-between rounded-[8px] border px-3 text-[14px] font-semibold transition",
                  serviceForm.visible
                    ? "border-[#b8d8cf] bg-[#edf7f3] text-[#2f7866]"
                    : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]",
                )}
              >
                <span>{serviceForm.visible ? "예약 화면에 노출" : "예약 화면에서 숨김"}</span>
                <span className={cn("h-5 w-9 rounded-full p-0.5 transition", serviceForm.visible ? "bg-[#2f7866]" : "bg-[#cbd5e1]")}>
                  <span className={cn("block h-4 w-4 rounded-full bg-white transition", serviceForm.visible ? "translate-x-4" : "translate-x-0")} />
                </span>
              </button>
            </Field>

            <Field label="설명 문구">
              <TextArea
                value={serviceForm.description}
                onChange={(description) => setServiceForm((form) => ({ ...form, description }))}
                placeholder="고객 예약 화면에 보여줄 짧은 안내를 입력해 주세요."
              />
            </Field>
          </div>

          {formError ? <p className="mt-4 text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

          <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
            {serviceForm.id && selectedService ? (
              <GhostButton label="복제" onClick={() => duplicateService(selectedService)} />
            ) : (
              <GhostButton label="초기화" onClick={startNewService} />
            )}
            <PrimaryButton label={serviceForm.id ? "수정 저장" : "서비스 저장"} onClick={saveService} />
          </div>
        </WebSurface>
      </div>
    </div>
  );
}
