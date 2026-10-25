import { normalizeImportPhone } from "@/server/data-import-parser";
export function guardianImportKey(name: string, phone: string) {
  return JSON.stringify([normalizeImportPhone(phone), name.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase()]);
}
