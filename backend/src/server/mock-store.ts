import { buildDemoBootstrap } from "@/lib/mock-data";
import type { BootstrapPayload } from "@/types/domain";

declare global {
  var __petmanagerStore: BootstrapPayload | undefined;
}

export function getMockStore() {
  if (!global.__petmanagerStore) {
    global.__petmanagerStore = buildDemoBootstrap();
  }
  return global.__petmanagerStore;
}

export function setMockStore(next: BootstrapPayload) {
  global.__petmanagerStore = next;
  return global.__petmanagerStore;
}
