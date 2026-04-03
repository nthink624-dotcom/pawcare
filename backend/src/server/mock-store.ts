import { buildDemoBootstrap } from "@/lib/mock-data";
import type { BootstrapPayload } from "@/types/domain";

declare global {
  var __pawcareStore: BootstrapPayload | undefined;
}

export function getMockStore() {
  if (!global.__pawcareStore) {
    global.__pawcareStore = buildDemoBootstrap();
  }
  return global.__pawcareStore;
}

export function setMockStore(next: BootstrapPayload) {
  global.__pawcareStore = next;
  return global.__pawcareStore;
}
