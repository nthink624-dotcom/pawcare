"use client";

import { Fragment, type HTMLAttributes, type ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { serviceRows } from "@/components/owner-web/owner-web-data";
import type { OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import { CustomerPagePreviewLayout } from "@/components/owner-web/customer-page-phone-preview";
import CustomerServiceExposurePanel from "@/components/owner-web/customer-service-exposure-panel";
import {
  ServicePriceGuideEditor,
  buildDefaultServicePriceGuide,
  normalizeServicePriceGuide,
  type ServicePriceGuide,
} from "@/components/owner-web/service-price-guide";
import {
  GhostButton,
  SoftSelect,
  TableRow,
  TableShell,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceMenuConnectionOptions,
  buildCustomerServiceSourceOptions,
  normalizeCustomerServiceOverrides,
  type CustomerServiceDisplayOverrides,
  type CustomerServiceSourceOption,
} from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { OwnerProfile, Service, Shop } from "@/types/domain";

type BaseServiceRow = (typeof serviceRows)[number];

type ManagedService = BaseServiceRow & {
  id: string;
  category: string;
  visible: boolean;
  description: string;
  order: number;
  priceGuide: ServicePriceGuide;
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
  priceGuide: ServicePriceGuide;
};

const servicesStorageKey = "petmanager.ownerWeb.services";
const customerBookingSnapshotServicePrefix = "customer-booking-";

const categoryOptions = ["미용", "목욕", "위생", "옵션"];
const durationOptions = ["30", "45", "60", "90", "120", "150", "180"];

const emptyServiceForm: ServiceForm = {
  id: null,
  name: "",
  category: "미용",
  duration: "60",
  price: "",
  staff: "전체 직원",
  visible: true,
  description: "",
  priceGuide: buildDefaultServicePriceGuide(),
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

function formatPriceInput(value: string) {
  const numericValue = parsePrice(value);
  if (!numericValue) return "";
  return numericValue.toLocaleString("ko-KR");
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
      priceGuide: normalizeServicePriceGuide(row.priceGuide),
    };
  });
}

function normalizeBootstrapServices(rows: Service[]): ManagedService[] {
  if (rows.length === 0) return normalizeServices(serviceRows);

  return rows
    .filter((service) => !service.id.startsWith(customerBookingSnapshotServicePrefix))
    .map((service, index) => ({
      id: service.id,
      name: service.name,
      category: service.category || inferCategory(service.name),
      duration: `${service.duration_minutes || 60}분`,
      price: `${(service.price || 0).toLocaleString("ko-KR")}원`,
      capacity: service.capacity_label || "동일 시간 1건",
      staff:
        service.staff_selection_mode === "unassigned"
          ? "직원 미지정"
          : service.staff_selection_mode === "specific"
            ? "담당 지정"
            : "전체 직원",
      visible: service.is_active,
      description: service.description || "",
      order: service.sort_order || index + 1,
      priceGuide: normalizeServicePriceGuide(service.price_guide),
    }))
    .sort((left, right) => left.order - right.order);
}

function managedServicesToDomain(services: ManagedService[], shopId: string): Service[] {
  const now = new Date(0).toISOString();
  return services.map((service) => ({
    id: service.id,
    shop_id: shopId,
    name: service.name,
    price: parsePrice(service.price),
    price_type: "starting",
    duration_minutes: parseMinutes(service.duration),
    is_active: service.visible,
    category: service.category,
    description: service.description,
    sort_order: service.order,
    capacity_label: service.capacity,
    staff_selection_mode: staffLabelToSelectionMode(service.staff),
    price_guide: service.priceGuide,
    created_at: now,
    updated_at: now,
  }));
}

function getBootstrapServicesSignature(rows: Service[]) {
  return JSON.stringify(
    rows.map((service) => ({
      id: service.id,
      name: service.name,
      price: service.price,
      priceType: service.price_type,
      durationMinutes: service.duration_minutes,
      isActive: service.is_active,
      category: service.category ?? "",
      description: service.description ?? "",
      sortOrder: service.sort_order ?? 0,
      capacityLabel: service.capacity_label ?? "",
      staffSelectionMode: service.staff_selection_mode ?? "",
      priceGuide: normalizeServicePriceGuide(service.price_guide),
    })),
  );
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
    priceGuide: normalizeServicePriceGuide(service.priceGuide),
  };
}

function staffLabelToSelectionMode(staff: string): "all" | "unassigned" | "specific" {
  if (staff === "직원 미지정" || staff === "스태프 미지정") return "unassigned";
  if (staff === "전체 직원" || staff === "전체 스태프") return "all";
  return "specific";
}

function buildCustomerServiceOverrideBaseline(
  options: CustomerServiceSourceOption[],
  overrides: CustomerServiceDisplayOverrides,
) {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);

  const baseline = Object.fromEntries(
    options.map((option) => [
      option.id,
      {
        visible: true,
        order: option.order,
        displayName: option.sourceName,
        description: option.description,
        linkedOptionId: option.linkedOptionId ?? option.id,
      },
    ]),
  ) satisfies CustomerServiceDisplayOverrides;

  return {
    ...baseline,
    ...normalizedOverrides,
  };
}

function createCustomerServiceMenuRowId() {
  return `menu-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[16px] font-semibold text-[#334155]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  align?: "left" | "right";
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[16px] font-normal text-[#111827] outline-none placeholder:text-[#8a95a6] focus:border-[#2f7866] focus:bg-white",
        align === "right" && "text-right tabular-nums",
      )}
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
      className="w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5 text-[16px] font-normal leading-6 text-[#111827] outline-none placeholder:text-[#8a95a6] focus:border-[#2f7866] focus:bg-white"
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
      buttonClassName="h-11 bg-[#f8fafc] focus:bg-white [&>span:nth-child(2)]:text-[16px] [&>span:nth-child(2)]:font-normal [&>span:nth-child(2)]:text-[#111827]"
      menuClassName="[&_button]:text-[16px] [&_button]:font-normal"
    />
  );
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[46px] items-center justify-center whitespace-nowrap rounded-[8px] px-2.5 text-[16px] font-semibold leading-none",
        visible ? "bg-[#edf7f3] text-[#2f7866]" : "bg-[#f1f5f9] text-[#64748b]",
      )}
    >
      {visible ? "노출" : "숨김"}
    </span>
  );
}

export default function ServiceManagementScreen({
  shopId,
  shop,
  ownerProfile,
  initialServices = [],
  staffMembers = [],
  demoMode = false,
  embedded = false,
  onServicesChange,
  onShopChange,
}: {
  shopId: string;
  shop?: Shop;
  ownerProfile?: OwnerProfile | null;
  initialServices?: Service[];
  staffMembers?: OwnerWebStaffMember[];
  demoMode?: boolean;
  embedded?: boolean;
  onServicesChange?: (services: Service[]) => void;
  onShopChange?: (shop: Shop) => void;
}) {
  const initialManagedServices = useMemo(
    () => (demoMode ? normalizeServices(serviceRows) : normalizeBootstrapServices(initialServices)),
    [demoMode, initialServices],
  );
  const [services, setServices] = useState<ManagedService[]>(() => initialManagedServices);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [serviceForm, setServiceForm] = useState<ServiceForm>(() => buildForm(services[0] ?? normalizeServices(serviceRows)[0]));
  const [formError, setFormError] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "pending" | "saved" | "needs-info">("saved");
  const [customerServiceOverrides, setCustomerServiceOverrides] = useState<CustomerServiceDisplayOverrides>(() =>
    normalizeCustomerServiceOverrides(shop?.customer_page_settings.customer_service_overrides),
  );
  const [customerServiceActionId] = useState<string | null>(null);
  const [customerServiceSaveStatus, setCustomerServiceSaveStatus] = useState<"idle" | "pending" | "saved" | "error">("saved");
  const [storageReady, setStorageReady] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const customerServiceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef("");
  const latestServiceFormSignatureRef = useRef("");
  const lastExternalServicesSignatureRef = useRef(demoMode ? "" : getBootstrapServicesSignature(initialServices));

  const staffOptions = useMemo(() => staffMembers.map((member) => member.name), [staffMembers]);
  const onlyStaffName = staffOptions.length === 1 ? staffOptions[0] : "";
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;

  useEffect(() => {
    return () => {
      if (customerServiceSaveTimerRef.current) {
        clearTimeout(customerServiceSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextOverrides = normalizeCustomerServiceOverrides(shop?.customer_page_settings.customer_service_overrides);
    setCustomerServiceOverrides((currentOverrides) =>
      JSON.stringify(currentOverrides) === JSON.stringify(nextOverrides) ? currentOverrides : nextOverrides,
    );
    setCustomerServiceSaveStatus((currentStatus) => (currentStatus === "pending" ? currentStatus : "saved"));
  }, [shop?.id, shop?.customer_page_settings.customer_service_overrides]);

  useEffect(() => {
    if (!demoMode) {
      setStorageReady(true);
      return;
    }

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
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const externalSignature = getBootstrapServicesSignature(initialServices);
    if (externalSignature === lastExternalServicesSignatureRef.current) return;
    lastExternalServicesSignatureRef.current = externalSignature;
    const nextServices = normalizeBootstrapServices(initialServices);
    const nextSelectedId = nextServices.some((service) => service.id === selectedServiceId) ? selectedServiceId : (nextServices[0]?.id ?? "");
    const nextSelectedService = nextServices.find((service) => service.id === nextSelectedId) ?? nextServices[0];
    setServices(nextServices);
    setSelectedServiceId(nextSelectedId);
    if (nextSelectedService) {
      const nextForm = buildForm(nextSelectedService);
      const nextFormSignature = getServiceFormSignature(nextForm);
      const isEditingCurrentService =
        nextSelectedId === selectedServiceId &&
        latestServiceFormSignatureRef.current !== lastSavedSignatureRef.current &&
        latestServiceFormSignatureRef.current !== nextFormSignature;

      if (!isEditingCurrentService) {
        setServiceForm(nextForm);
        latestServiceFormSignatureRef.current = nextFormSignature;
        lastSavedSignatureRef.current = nextFormSignature;
      }
    }
  }, [demoMode, initialServices, selectedServiceId]);

  useEffect(() => {
    latestServiceFormSignatureRef.current = getServiceFormSignature(serviceForm);
  }, [serviceForm]);

  useEffect(() => {
    if (!storageReady || !demoMode) return;
    window.localStorage.setItem(servicesStorageKey, JSON.stringify(services));
  }, [demoMode, services, storageReady]);

  useEffect(() => {
    if (!onlyStaffName) return;
    setServiceForm((form) => (form.staff === onlyStaffName ? form : { ...form, staff: onlyStaffName }));
  }, [onlyStaffName]);

  useEffect(() => {
    if (!storageReady) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const draftError = getServiceDraftError(serviceForm);
    if (draftError) {
      setAutosaveStatus(serviceForm.name.trim() || serviceForm.price ? "needs-info" : "idle");
      return;
    }

    const signature = getServiceFormSignature(serviceForm);
    if (signature === lastSavedSignatureRef.current) {
      setAutosaveStatus("saved");
      return;
    }

    setAutosaveStatus("pending");
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveService({ showError: false });
      autosaveTimerRef.current = null;
    }, 500);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [serviceForm, storageReady]);

  function selectService(service: ManagedService) {
    setSelectedServiceId(service.id);
    setServiceForm(buildForm(service));
    setFormError("");
    setAutosaveStatus("saved");
    lastSavedSignatureRef.current = getServiceFormSignature(buildForm(service));
  }

  function startNewService() {
    setSelectedServiceId("");
    setServiceForm(emptyServiceForm);
    setFormError("");
    setAutosaveStatus("idle");
    lastSavedSignatureRef.current = "";
  }

  function getServiceDraftError(form: ServiceForm) {
    if (!form.name.trim()) return "서비스명을 입력해 주세요.";
    if (!formatPrice(form.price)) return "가격을 숫자로 입력해 주세요.";
    return "";
  }

  function getServiceFormSignature(form: ServiceForm) {
    return JSON.stringify({
      id: form.id,
      name: form.name.trim(),
      category: form.category,
      duration: String(Number(form.duration) || 60),
      price: String(parsePrice(form.price)),
      staff: form.staff,
      visible: form.visible,
      description: form.description.trim(),
      priceGuide: normalizeServicePriceGuide(form.priceGuide),
    });
  }

  async function saveService({ showError = true }: { showError?: boolean } = {}) {
    const draftError = getServiceDraftError(serviceForm);
    if (draftError) {
      if (showError) setFormError(draftError);
      setAutosaveStatus("needs-info");
      return false;
    }

    const saveSignature = getServiceFormSignature(serviceForm);
    const price = formatPrice(serviceForm.price);
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
      priceGuide: normalizeServicePriceGuide(serviceForm.priceGuide),
      order: serviceForm.id ? (selectedService?.order ?? services.length + 1) : services.length + 1,
    };

    const previousServices = services;
    setServices((current) => {
      const exists = current.some((service) => service.id === nextService.id);
      return exists
        ? current.map((service) => (service.id === nextService.id ? nextService : service))
        : [...current, nextService];
    });
    setSelectedServiceId(nextService.id);
    setServiceForm(buildForm(nextService));
    setFormError("");

    if (demoMode) {
      if (latestServiceFormSignatureRef.current === saveSignature) {
        setAutosaveStatus("saved");
        lastSavedSignatureRef.current = saveSignature;
      }
      return true;
    }

    try {
      const savedService = await fetchApiJsonWithAuth<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          serviceId: nextService.id,
          name: nextService.name,
          price: parsePrice(nextService.price),
          priceType: "starting",
          durationMinutes: parseMinutes(nextService.duration),
          isActive: nextService.visible,
          category: nextService.category,
          description: nextService.description,
          sortOrder: nextService.order,
          capacityLabel: nextService.capacity,
          staffSelectionMode: staffLabelToSelectionMode(nextService.staff),
          priceGuide: nextService.priceGuide,
        }),
      });
      const savedManaged = normalizeBootstrapServices([savedService])[0] ?? nextService;
      if (latestServiceFormSignatureRef.current !== saveSignature) {
        return true;
      }

      setServices((current) => current.map((service) => (service.id === savedManaged.id ? savedManaged : service)));
      const savedForm = buildForm(savedManaged);
      setServiceForm(savedForm);
      setAutosaveStatus("saved");
      const savedSignature = getServiceFormSignature(savedForm);
      latestServiceFormSignatureRef.current = savedSignature;
      lastSavedSignatureRef.current = savedSignature;
      onServicesChange?.(
        initialServices.some((service) => service.id === savedService.id)
          ? initialServices.map((service) => (service.id === savedService.id ? savedService : service))
          : [...initialServices, savedService],
      );
      return true;
    } catch (error) {
      if (latestServiceFormSignatureRef.current !== saveSignature) {
        return false;
      }

      setServices(previousServices);
      setFormError(error instanceof Error ? error.message : "서비스 저장 중 문제가 발생했습니다.");
      setAutosaveStatus("needs-info");
      return false;
    }
  }

  function updatePriceInput(value: string) {
    const numericValue = parsePrice(value);
    setServiceForm((form) => ({
      ...form,
      price: numericValue ? String(numericValue) : "",
    }));
  }

  function toggleVisibility(service: ManagedService) {
    const nextService = { ...service, visible: !service.visible };
    setServices((current) => current.map((item) => (item.id === service.id ? nextService : item)));
    if (selectedServiceId === service.id) {
      setServiceForm(buildForm(nextService));
      lastSavedSignatureRef.current = getServiceFormSignature(buildForm(nextService));
      setAutosaveStatus("saved");
    }
  }

  function updateServiceSummary(service: ManagedService, patch: Partial<Pick<ManagedService, "price" | "duration">>) {
    const nextService: ManagedService = {
      ...service,
      price: patch.price !== undefined ? formatPrice(patch.price) : service.price,
      duration: patch.duration !== undefined ? `${Number(parseMinutes(patch.duration)) || parseMinutes(service.duration)}분` : service.duration,
    };

    setServices((current) => current.map((item) => (item.id === service.id ? nextService : item)));
    if (selectedServiceId === service.id) {
      const nextForm = buildForm(nextService);
      setServiceForm(nextForm);
      lastSavedSignatureRef.current = getServiceFormSignature(nextForm);
      setAutosaveStatus("saved");
    }
  }

  const autosaveLabel =
    autosaveStatus === "pending"
      ? "자동 저장 중"
      : autosaveStatus === "saved"
        ? "자동 저장됨"
        : autosaveStatus === "needs-info"
          ? "서비스명과 가격 입력 시 자동 저장"
          : "입력하면 자동 저장됩니다";

  function updatePriceGuide(priceGuide: ServicePriceGuide, forceEnabled = false) {
    const nextPriceGuide = normalizeServicePriceGuide(forceEnabled ? { ...priceGuide, enabled: true } : priceGuide);
    setServiceForm((form) => ({ ...form, priceGuide: nextPriceGuide }));
    if (selectedServiceId) {
      setServices((current) =>
        current.map((service) => (service.id === selectedServiceId ? { ...service, priceGuide: nextPriceGuide } : service)),
      );
    }
  }

  function updateCustomerServiceOverrides(nextOverrides: CustomerServiceDisplayOverrides) {
    const normalizedOverrides = normalizeCustomerServiceOverrides(nextOverrides);
    setCustomerServiceOverrides(normalizedOverrides);

    if (customerServiceSaveTimerRef.current) {
      clearTimeout(customerServiceSaveTimerRef.current);
      customerServiceSaveTimerRef.current = null;
    }

    if (!shop) {
      setCustomerServiceSaveStatus("idle");
      return;
    }

    const optimisticShop: Shop = {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        customer_service_overrides: normalizedOverrides,
      },
    };
    onShopChange?.(optimisticShop);

    if (demoMode || shop.id === "demo-shop" || shop.id === "owner-demo") {
      setCustomerServiceSaveStatus("saved");
      return;
    }

    setCustomerServiceSaveStatus("pending");
    customerServiceSaveTimerRef.current = setTimeout(() => {
      void fetchApiJsonWithAuth<{ shop: Pick<Shop, "id" | "customer_page_settings"> }>("/api/owner/shops", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          customerServiceOverrides: normalizedOverrides,
        }),
      })
        .then((result) => {
          onShopChange?.({
            ...optimisticShop,
            customer_page_settings: {
              ...optimisticShop.customer_page_settings,
              ...result.shop.customer_page_settings,
            },
          });
          setCustomerServiceSaveStatus("saved");
        })
        .catch((error) => {
          console.error("[OWNER SERVICES] failed to save customer service exposure", error);
          setCustomerServiceSaveStatus("error");
        });
      customerServiceSaveTimerRef.current = null;
    }, 500);
  }

  function addCustomerServiceOption() {
    if (!shop || customerServiceActionId) return;

    const usedConnectionOptionIds = new Set(customerServiceOptions.map((option) => option.linkedOptionId ?? option.id));
    const defaultConnectionOption = customerServiceConnectionOptions.find((option) => !usedConnectionOptionIds.has(option.linkedOptionId ?? option.id));
    if (!defaultConnectionOption) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    const rowId = createCustomerServiceMenuRowId();
    const nextOrder =
      Math.max(
        0,
        ...customerServiceOptions.map((option) => baselineOverrides[option.id]?.order ?? option.order),
      ) + 1;
    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [rowId]: {
        visible: true,
        order: nextOrder,
        displayName: defaultConnectionOption.sourceName,
        description: defaultConnectionOption.description,
        linkedOptionId: defaultConnectionOption.linkedOptionId ?? defaultConnectionOption.id,
      },
    });
  }

  function deleteCustomerServiceOption(option: CustomerServiceSourceOption) {
    if (!shop || customerServiceActionId) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [option.id]: {
        ...(baselineOverrides[option.id] ?? {}),
        visible: false,
        order: baselineOverrides[option.id]?.order ?? option.order,
        displayName: baselineOverrides[option.id]?.displayName ?? option.sourceName,
        description: baselineOverrides[option.id]?.description ?? option.description,
      },
    });
  }

  function relinkCustomerServiceOption(option: CustomerServiceSourceOption, nextOptionId: string) {
    if (!nextOptionId) return;

    const nextOption = rawCustomerServiceConnectionOptions.find((item) => item.id === nextOptionId);
    if (!nextOption) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    const currentOverride = baselineOverrides[option.id] ?? {};

    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [option.id]: {
        ...currentOverride,
        visible: true,
        displayName: nextOption.sourceName,
        description: currentOverride.description ?? option.description,
        order: currentOverride.order ?? option.order,
        linkedOptionId: nextOption.id,
      },
    });
  }

  const previewServices = useMemo(() => {
    const draftName = serviceForm.name.trim();
    const draftService: ManagedService | null = draftName
      ? {
          id: serviceForm.id ?? "service-preview-draft",
          name: draftName,
          category: serviceForm.category,
          duration: `${Number(serviceForm.duration) || 60}분`,
          price: formatPrice(serviceForm.price) || "가격 상담",
          capacity: "동일 시간 1건",
          staff: serviceForm.staff,
          visible: serviceForm.visible,
          description: serviceForm.description.trim(),
          order: selectedService?.order ?? services.length + 1,
          priceGuide: normalizeServicePriceGuide(serviceForm.priceGuide),
        }
      : null;

    const nextServices = draftService
      ? services.some((service) => service.id === draftService.id)
        ? services.map((service) => (service.id === draftService.id ? draftService : service))
        : [draftService, ...services]
      : services;

    return managedServicesToDomain(nextServices, shopId);
  }, [selectedService?.order, serviceForm, services, shopId]);

  const rawCustomerServiceConnectionOptions = useMemo(
    () => buildCustomerServiceSourceOptions(previewServices, { priceGuideOnly: true }),
    [previewServices],
  );
  const customerServiceConnectionOptions = useMemo(
    () => buildCustomerServiceMenuConnectionOptions(rawCustomerServiceConnectionOptions),
    [rawCustomerServiceConnectionOptions],
  );
  const customerServiceOptions = useMemo(
    () => applyConfiguredCustomerServiceOverrides(rawCustomerServiceConnectionOptions, customerServiceOverrides),
    [rawCustomerServiceConnectionOptions, customerServiceOverrides],
  );
  const customerPagePreviewShop = useMemo<Shop | null>(() => {
    if (!shop) return null;
    return {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        customer_service_overrides: customerServiceOverrides,
      },
    };
  }, [customerServiceOverrides, shop]);

  const content = (
    <div className="space-y-5">
      <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#111827]">서비스/가격</h2>
          <button
            type="button"
            onClick={() => void addCustomerServiceOption()}
            disabled={customerServiceActionId === "__add__"}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#2f6bd4] bg-[#2f6bd4] px-4 text-[15px] font-semibold text-white transition hover:bg-[#285bb3] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-4 w-4" />
            서비스 추가
          </button>
        </div>

        <div className="mb-5">
          <CustomerServiceExposurePanel
            options={customerServiceOptions}
            overrides={customerServiceOverrides}
            embedded
            busyOptionId={customerServiceActionId}
            onChange={updateCustomerServiceOverrides}
            connectionOptions={customerServiceConnectionOptions}
            onAddOption={addCustomerServiceOption}
            hideHeader
            onDeleteOption={deleteCustomerServiceOption}
            onRelinkOption={relinkCustomerServiceOption}
          />
        </div>

        <ServicePriceGuideEditor
          value={{ ...serviceForm.priceGuide, enabled: true }}
          onChange={(priceGuide) => updatePriceGuide(priceGuide, true)}
          framed={false}
          showHeader={false}
          showEnabledToggle={false}
        />
      </section>

      {formError ? <p className="text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

      <div className="hidden justify-end">
        <span
          className={cn(
            "inline-flex h-9 min-w-[108px] items-center justify-center rounded-[8px] border px-3 text-[13px] font-semibold",
            autosaveStatus === "saved"
              ? "border-[#c8ded8] bg-[#edf7f3] text-[#2f7866]"
              : autosaveStatus === "pending"
                ? "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]"
                : "border-[#f0d7a8] bg-[#fff8e6] text-[#9f6f00]",
          )}
        >
          {autosaveLabel}
        </span>
      </div>

      <div className="hidden">
        <TableShell columns={["서비스", "카테고리", "소요시간", "담당", "예약 노출", "관리"]} align="center">
          {services.map((service) => (
            <Fragment key={service.id}>
              <TableRow
                active={selectedServiceId === service.id}
                onClick={() => selectService(service)}
                className="py-3"
                align="center"
                columns={[
                  <div key="name" className="min-w-0 text-center">
                    <p className="truncate text-[16px] font-normal text-[#111827]">{service.name}</p>
                    {service.description ? <p className="mt-1 truncate text-[16px] text-[#64748b]">{service.description}</p> : null}
                  </div>,
                  <p key="category" className="text-[16px] text-[#334155]">{service.category}</p>,
                  <p key="duration" className="text-[16px] text-[#334155]">{service.duration}</p>,
                  <p key="staff" className={cn("text-[16px]", service.staff === "직원 미지정" ? "font-medium text-[#b91c1c]" : "text-[#64748b]")}>
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
                      className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleVisibility(service);
                      }}
                      className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      {service.visible ? "숨김" : "노출"}
                    </button>
                  </div>,
                ]}
              />
              {selectedServiceId === service.id ? (
                <div className="border-b border-[#edf2f7] bg-[#fbfdff] px-5 py-4">
                  <ServicePriceGuideEditor
                    value={serviceForm.priceGuide}
                    onChange={(priceGuide) => updatePriceGuide(priceGuide)}
                  />
                </div>
              ) : null}
            </Fragment>
          ))}
          <div
            className="grid w-full items-center border-b-0 bg-white px-5 py-4 text-center"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            <div className="col-span-7 flex justify-center">
              <button
                type="button"
                onClick={startNewService}
                className="flex h-11 w-full max-w-[360px] items-center justify-center rounded-[8px] border border-[#1f6b5b] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1b604f]"
              >
                서비스 추가
              </button>
            </div>
          </div>
        </TableShell>

        <WebSurface className="p-5">
          <div className="space-y-4">
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
                  value={formatPriceInput(serviceForm.price)}
                  onChange={updatePriceInput}
                  placeholder="예: 80,000"
                  inputMode="numeric"
                  align="right"
                />
              </Field>
            </div>

            <Field label="담당 가능 직원">
              {onlyStaffName ? (
                <div className="flex h-11 w-full items-center justify-end rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal text-[#111827]">
                  {onlyStaffName}
                </div>
              ) : (
                <SelectInput
                  value={serviceForm.staff}
                  onChange={(staff) => setServiceForm((form) => ({ ...form, staff }))}
                  options={[
                    { value: "전체 직원", label: "전체 직원" },
                    { value: "직원 미지정", label: "직원 미지정" },
                    ...staffOptions.map((option) => ({ value: option, label: option })),
                  ]}
                />
              )}
            </Field>

            <Field label="예약 노출">
              <button
                type="button"
                onClick={() => setServiceForm((form) => ({ ...form, visible: !form.visible }))}
                className={cn(
                  "flex h-11 w-full items-center justify-between rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal text-[#334155] transition hover:bg-[#f8fafc]",
                )}
              >
                <span>{serviceForm.visible ? "노출 중" : "숨김"}</span>
                <span className={cn("h-5 w-9 translate-y-px rounded-full p-0.5 transition", serviceForm.visible ? "bg-[#2f7866]" : "bg-[#f1f5f9] ring-1 ring-inset ring-[#d6dee8]")}>
                  <span className={cn("block h-4 w-4 rounded-full bg-white transition", serviceForm.visible ? "translate-x-4" : "translate-x-0")} />
                </span>
              </button>
            </Field>

            <Field label="설명 문구">
              <TextArea
                value={serviceForm.description}
                onChange={(description) => setServiceForm((form) => ({ ...form, description }))}
                placeholder="예: 첫 방문 상담 포함, 털엉킴 추가요금 별도"
              />
            </Field>

          </div>

          {formError ? <p className="mt-4 text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

          <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-2">
            <GhostButton label="새 서비스 추가" onClick={startNewService} />
            <span
              className={cn(
                "inline-flex h-11 min-w-[108px] items-center justify-center rounded-[8px] border px-3 text-[13px] font-semibold",
                autosaveStatus === "saved"
                  ? "border-[#c8ded8] bg-[#edf7f3] text-[#2f7866]"
                  : autosaveStatus === "pending"
                    ? "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]"
                    : "border-[#f0d7a8] bg-[#fff8e6] text-[#9f6f00]",
              )}
            >
              {autosaveLabel}
            </span>
          </div>
        </WebSurface>
      </div>
      </div>
  );

  if (embedded) return content;

  return (
    <CustomerPagePreviewLayout shop={customerPagePreviewShop} services={previewServices} ownerProfile={ownerProfile}>
      {content}
    </CustomerPagePreviewLayout>
  );
}
