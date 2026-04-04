import { buildDemoBootstrap } from "@/lib/mock-data";
import { normalizeBootstrapNotifications } from "@/lib/notification-settings";
import type { BootstrapPayload } from "@/types/domain";

let mockStore: BootstrapPayload = normalizeBootstrapNotifications(buildDemoBootstrap());

export function getMockStore() {
  return structuredClone(mockStore);
}

export function setMockStore(nextStore: BootstrapPayload) {
  mockStore = structuredClone(nextStore);
}
