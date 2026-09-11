import type { AppointmentStatus, BootstrapPayload, Guardian, Pet } from "@/types/domain";

type ShopScopedEntity = Pick<Guardian | Pet, "id" | "shop_id">;

export type OwnerMutationRequest = <T>(
  input: string,
  init: RequestInit,
) => Promise<T>;

function requireCurrentShopId(shopId: string) {
  const normalized = shopId.trim();
  if (!normalized) throw new Error("현재 매장 정보를 확인할 수 없습니다. 다시 불러온 뒤 시도해 주세요.");
  return normalized;
}

export function assertCurrentShopEntity(
  entities: readonly ShopScopedEntity[],
  entityId: string,
  shopId: string,
  label: "고객" | "반려동물",
) {
  const currentShopId = requireCurrentShopId(shopId);
  const entity = entities.find((item) => item.id === entityId);
  if (!entity || entity.shop_id !== currentShopId) {
    throw new Error(`${label} 정보를 현재 매장에서 확인할 수 없습니다. 다시 불러온 뒤 시도해 주세요.`);
  }
  return entity;
}

export function assertCurrentShopEntities(
  entities: readonly ShopScopedEntity[],
  entityIds: readonly string[],
  shopId: string,
  label: "고객" | "반려동물",
) {
  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  if (uniqueIds.length !== entityIds.length || uniqueIds.length === 0) {
    throw new Error(`${label} 선택 정보를 다시 확인해 주세요.`);
  }
  uniqueIds.forEach((entityId) => assertCurrentShopEntity(entities, entityId, shopId, label));
  return uniqueIds;
}

function parseCreatedGuardian(value: unknown, shopId: string): Pick<Guardian, "id" | "shop_id"> {
  if (!value || typeof value !== "object") {
    throw new Error("저장된 고객 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim() || record.shop_id !== shopId) {
    throw new Error("저장된 고객의 매장 정보를 확인하지 못했습니다. 다시 불러온 뒤 시도해 주세요.");
  }
  return { id: record.id, shop_id: shopId };
}

export async function createGuardianAndPets(params: {
  shopId: string;
  guardianPayload: Record<string, unknown>;
  petPayloads: ReadonlyArray<Record<string, unknown>>;
  request: OwnerMutationRequest;
}) {
  const shopId = requireCurrentShopId(params.shopId);
  const createdValue = await params.request<unknown>("/api/guardians", {
    method: "POST",
    body: JSON.stringify({ ...params.guardianPayload, shopId }),
  });
  const guardian = parseCreatedGuardian(createdValue, shopId);

  for (const petPayload of params.petPayloads) {
    await params.request<unknown>("/api/pets", {
      method: "POST",
      body: JSON.stringify({ ...petPayload, shopId, guardianId: guardian.id }),
    });
  }

  return guardian;
}

const appointmentStatuses = new Set<AppointmentStatus>([
  "pending",
  "confirmed",
  "in_progress",
  "almost_done",
  "completed",
  "cancelled",
  "rejected",
  "noshow",
]);

export function assertOwnerBootstrapPayload(
  value: BootstrapPayload,
  expectedShopId: string,
  options: { allowMock: boolean },
) {
  const shopId = requireCurrentShopId(expectedShopId);
  if (!value || value.shop?.id !== shopId) {
    throw new Error("선택한 매장의 데이터를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  if (value.mode === "mock" && !options.allowMock) {
    throw new Error("운영 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const collections = [
    value.guardians,
    value.pets,
    value.services,
    value.staffMembers,
    value.appointments,
    value.groomingRecords,
    value.notifications,
    value.landingInterests,
    value.landingFeedback,
  ];
  if (collections.some((items) => !Array.isArray(items))) {
    throw new Error("매장 데이터 형식이 올바르지 않습니다. 다시 불러와 주세요.");
  }
  if (
    value.guardians.some((item) => item.shop_id !== shopId) ||
    value.pets.some((item) => item.shop_id !== shopId) ||
    value.services.some((item) => item.shop_id !== shopId)
  ) {
    throw new Error("다른 매장의 고객·반려동물·서비스 정보가 포함되어 있어 불러오기를 중단했습니다.");
  }
  if (value.appointments.some((item) => item.shop_id !== shopId || !appointmentStatuses.has(item.status))) {
    throw new Error("예약 데이터 형식이 올바르지 않습니다. 다시 불러와 주세요.");
  }

  const guardianById = new Map(value.guardians.map((guardian) => [guardian.id, guardian]));
  const petById = new Map(value.pets.map((pet) => [pet.id, pet]));
  const serviceIds = new Set(value.services.map((service) => service.id));
  if (value.pets.some((pet) => !guardianById.has(pet.guardian_id))) {
    throw new Error("반려동물과 고객의 연결 정보를 확인하지 못했습니다. 다시 불러와 주세요.");
  }
  for (const appointment of value.appointments) {
    const guardian = guardianById.get(appointment.guardian_id);
    const pet = petById.get(appointment.pet_id);
    if (!guardian || !pet || !serviceIds.has(appointment.service_id)) {
      throw new Error("예약의 고객·반려동물·서비스 연결 정보를 확인하지 못했습니다. 다시 불러와 주세요.");
    }
    if (pet.guardian_id !== guardian.id) {
      throw new Error("예약의 고객과 반려동물 연결이 일치하지 않습니다. 다시 불러와 주세요.");
    }
  }
  return value;
}
