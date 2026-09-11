import { buildDemoBootstrap } from "@/lib/mock-data";
import type { BootstrapPayload, Guardian, Pet } from "@/types/domain";

const FIXTURE_CUSTOMER_COUNT = 36;
const FIXTURE_TIMESTAMP = "2026-09-07T00:00:00.000Z";

export function buildCustomerDeleteBottomActionPreviewFixture(): BootstrapPayload {
  const base = buildDemoBootstrap();
  const notificationSettings = base.guardians[0]?.notification_settings;
  if (!notificationSettings) {
    throw new Error("고객 선택 검수 fixture의 알림 설정을 준비하지 못했습니다.");
  }

  const guardians: Guardian[] = Array.from({ length: FIXTURE_CUSTOMER_COUNT }, (_, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    return {
      id: `customer-delete-preview-guardian-${sequence}`,
      shop_id: base.shop.id,
      name: `검수 고객 ${sequence}`,
      phone: `000-0000-${String(index + 1).padStart(4, "0")}`,
      memo: "비식별 화면 검수 fixture",
      customer_grade_override: index % 5 === 0 ? "loyal" : "normal",
      notification_settings: { ...notificationSettings },
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    };
  });
  const pets: Pet[] = guardians.map((guardian, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    return {
      id: `customer-delete-preview-pet-${sequence}`,
      shop_id: base.shop.id,
      guardian_id: guardian.id,
      name: `검수 반려동물 ${sequence}`,
      breed: "검수용 품종",
      weight: null,
      age: null,
      notes: "",
      birthday: null,
      grooming_cycle_weeks: 4,
      avatar_seed: sequence,
      created_at: FIXTURE_TIMESTAMP,
      updated_at: FIXTURE_TIMESTAMP,
    };
  });

  return {
    ...base,
    shop: {
      ...base.shop,
      name: "고객 선택 검수 매장",
      customer_page_settings: {
        ...base.shop.customer_page_settings,
        hero_image_url: "",
      },
    },
    guardians,
    deletedGuardians: [],
    pets,
    appointments: [],
    groomingRecords: [],
    notifications: [],
    landingInterests: [],
    landingFeedback: [],
  };
}
