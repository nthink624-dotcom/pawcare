import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizeImportPhone,
  parseDataImportFile,
  type ParsedCustomerRow,
  type ParsedDataImport,
  type ParsedVisitRow,
} from "@/server/data-import-parser";
import type { DataImportAction, DataImportPreview, DataImportSource } from "@/types/data-import";

type ExistingGuardian = {
  id: string;
  name: string;
  phone: string;
  deleted_at: string | null;
};

type ExistingPet = {
  id: string;
  guardian_id: string;
  name: string;
  breed: string;
};

function normalizedName(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

export function dataImportFileSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function dataImportRowKey(fileSha256: string, sheetName: string, rowNumber: number) {
  return `${fileSha256}:${sheetName}:${rowNumber}`;
}

function uniqueCustomers(rows: ParsedCustomerRow[]) {
  const byKey = new Map<string, ParsedCustomerRow>();
  for (const row of rows) {
    const key = `${normalizeImportPhone(row.phone)}|${normalizedName(row.petName)}`;
    const previous = byKey.get(key);
    byKey.set(key, previous ? {
      ...previous,
      guardianMemo: previous.guardianMemo || row.guardianMemo,
      petMemo: previous.petMemo || row.petMemo,
      breed: previous.breed === "미입력" ? row.breed : previous.breed,
      weightKg: previous.weightKg ?? row.weightKg,
      birthday: previous.birthday ?? row.birthday,
    } : row);
  }
  return Array.from(byKey.values());
}

function uniqueVisits(rows: ParsedVisitRow[]) {
  const byKey = new Map<string, ParsedVisitRow>();
  for (const row of rows) {
    const key = [normalizeImportPhone(row.phone), normalizedName(row.petName), row.visitDate, normalizedName(row.serviceName)].join("|");
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function visitCountByCustomer(rows: ParsedVisitRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${normalizeImportPhone(row.phone)}|${normalizedName(row.petName)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function loadExistingData(shopId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 서버 연결을 확인할 수 없습니다.");
  const [guardiansResult, petsResult] = await Promise.all([
    supabase.from("guardians").select("id,name,phone,deleted_at").eq("shop_id", shopId).limit(10000),
    supabase.from("pets").select("id,guardian_id,name,breed").eq("shop_id", shopId).limit(20000),
  ]);
  if (guardiansResult.error) throw new Error(guardiansResult.error.message);
  if (petsResult.error) throw new Error(petsResult.error.message);
  return {
    guardians: (guardiansResult.data ?? []) as ExistingGuardian[],
    pets: (petsResult.data ?? []) as ExistingPet[],
  };
}

export async function buildDataImportPreview(params: {
  shopId: string;
  source: DataImportSource;
  fileName: string;
  buffer: Buffer;
}): Promise<{ preview: DataImportPreview; parsed: ParsedDataImport }> {
  const [parsed, existing] = await Promise.all([
    parseDataImportFile(params.buffer, params.fileName),
    loadExistingData(params.shopId),
  ]);
  const fileSha256 = dataImportFileSha256(params.buffer);
  const existingGuardianByPhone = new Map<string, ExistingGuardian>();
  for (const guardian of existing.guardians.sort((left, right) => Number(Boolean(left.deleted_at)) - Number(Boolean(right.deleted_at)))) {
    const key = normalizeImportPhone(guardian.phone);
    if (key && !existingGuardianByPhone.has(key)) existingGuardianByPhone.set(key, guardian);
  }
  const existingPetKeys = new Set(
    existing.pets.map((pet) => `${pet.guardian_id}|${normalizedName(pet.name)}`),
  );
  const customers = uniqueCustomers(parsed.customers);
  const visits = uniqueVisits(parsed.visits);
  const visitsByCustomer = visitCountByCustomer(visits);
  const fileCustomerKeys = new Set(customers.map((row) => `${normalizeImportPhone(row.phone)}|${normalizedName(row.petName)}`));
  const guardianActionByPhone = new Map<string, "create" | "merge">();
  const petActionByKey = new Map<string, "create" | "merge">();

  const previewCustomers = customers.map((row) => {
    const phoneKey = normalizeImportPhone(row.phone);
    const existingGuardian = existingGuardianByPhone.get(phoneKey);
    const guardianAction = existingGuardian ? "merge" : "create";
    guardianActionByPhone.set(phoneKey, guardianAction);
    const customerKey = `${phoneKey}|${normalizedName(row.petName)}`;
    const petAction = existingGuardian && existingPetKeys.has(`${existingGuardian.id}|${normalizedName(row.petName)}`) ? "merge" : "create";
    petActionByKey.set(customerKey, petAction);
    const issues: string[] = [];
    if (phoneKey.length < 10) issues.push("전화번호를 확인해 주세요.");
    if (row.breed === "미입력") issues.push("품종이 비어 있습니다.");
    if (existingGuardian?.deleted_at) issues.push("삭제 보관 중인 고객을 복원해 합칩니다.");
    const action: DataImportAction = phoneKey.length < 10 ? "skip" : petAction;
    return {
      rowNumber: row.rowNumber,
      sheetName: row.sheetName,
      guardianName: row.guardianName,
      phone: row.phone,
      petName: row.petName,
      breed: row.breed,
      weightKg: row.weightKg,
      action,
      issues,
      visitCount: visitsByCustomer.get(customerKey) ?? 0,
    };
  });

  const previewVisits = visits.map((row) => {
    const customerKey = `${normalizeImportPhone(row.phone)}|${normalizedName(row.petName)}`;
    const guardian = existingGuardianByPhone.get(normalizeImportPhone(row.phone));
    const canResolveExistingPet = guardian && existingPetKeys.has(`${guardian.id}|${normalizedName(row.petName)}`);
    const issues: string[] = [];
    if (!normalizeImportPhone(row.phone)) issues.push("연결할 전화번호가 없습니다.");
    if (!row.petName) issues.push("연결할 반려동물 이름이 없습니다.");
    if (!fileCustomerKeys.has(customerKey) && !canResolveExistingPet) issues.push("고객·반려동물 연결 정보를 찾지 못했습니다.");
    if (row.actualMinutes === null) issues.push("실제 소요시간이 없어 시간당 분석에서는 제외됩니다.");
    return {
      rowNumber: row.rowNumber,
      sheetName: row.sheetName,
      guardianName: row.guardianName,
      phone: row.phone,
      petName: row.petName,
      visitDate: row.visitDate,
      serviceName: row.serviceName,
      actualMinutes: row.actualMinutes,
      amount: row.paidAmount,
      action: issues.some((issue) => issue.includes("찾지 못") || issue.includes("없습니다")) ? "skip" as const : "create" as const,
      issues,
    };
  });

  const previewPriceGuide = parsed.priceGuide.map((row) => ({
    rowNumber: row.rowNumber,
    sheetName: row.sheetName,
    groupName: row.groupName,
    breedNames: row.breedNames,
    weightBand: row.weightBand,
    serviceName: row.serviceName,
    price: row.price,
    durationMinutes: row.durationMinutes,
    action: row.price > 0 ? "create" as const : "skip" as const,
    issues: row.durationMinutes ? [] : ["예상시간이 비어 있어 요금표에서 확인이 필요합니다."],
  }));

  const guardianActions = Array.from(guardianActionByPhone.values());
  const petActions = Array.from(petActionByKey.values());
  const skippedRows = parsed.skippedRows + previewCustomers.filter((row) => row.action === "skip").length + previewVisits.filter((row) => row.action === "skip").length;
  const issueRows = [...previewCustomers, ...previewVisits, ...previewPriceGuide].filter((row) => row.issues.length > 0).length;
  const warnings = [...parsed.warnings];
  if (previewPriceGuide.length > 0) {
    warnings.push("가져온 요금표는 기존 요금표를 덮어쓰지 않고 비활성 초안으로 등록됩니다.");
  }

  return {
    parsed,
    preview: {
      source: params.source,
      fileName: params.fileName,
      fileSha256,
      summary: {
        totalRows: parsed.totalRows,
        customerRows: previewCustomers.length,
        visitRows: previewVisits.length,
        priceGuideRows: previewPriceGuide.length,
        guardiansToCreate: guardianActions.filter((action) => action === "create").length,
        guardiansToMerge: guardianActions.filter((action) => action === "merge").length,
        petsToCreate: petActions.filter((action) => action === "create").length,
        petsToMerge: petActions.filter((action) => action === "merge").length,
        visitsToImport: previewVisits.filter((row) => row.action === "create").length,
        priceGuideRowsToImport: previewPriceGuide.filter((row) => row.action === "create").length,
        skippedRows,
        issueRows,
      },
      customers: previewCustomers.slice(0, 100),
      visits: previewVisits.slice(0, 100),
      priceGuide: previewPriceGuide.slice(0, 100),
      warnings,
    },
  };
}
