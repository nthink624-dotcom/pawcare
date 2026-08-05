import { createHash, randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeImportPhone, type ParsedCustomerRow, type ParsedPriceGuideRow, type ParsedVisitRow } from "@/server/data-import-parser";
import { buildDataImportPreview, dataImportRowKey } from "@/server/data-import-preview";
import type { DataImportCommitResult, DataImportSource } from "@/types/data-import";

type GuardianRow = {
  id: string;
  name: string;
  phone: string;
  memo: string;
  notification_settings: Record<string, unknown> | null;
  deleted_at: string | null;
  created_at: string;
};

type PetRow = {
  id: string;
  guardian_id: string;
  name: string;
  breed: string;
  weight: number | null;
  birthday: string | null;
  notes: string;
  grooming_cycle_weeks: number;
  created_at: string;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

function normalizedName(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function appendMemo(current: string, incoming: string) {
  const next = incoming.trim();
  if (!next || current.includes(next)) return current;
  return [current.trim(), next].filter(Boolean).join("\n");
}

function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function rowFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function defaultGuardianNotifications(enabled: boolean) {
  return {
    enabled,
    revisit_enabled: true,
    booking_confirmed_enabled: true,
    booking_cancelled_enabled: true,
    booking_rescheduled_enabled: true,
    appointment_reminder_10m_enabled: true,
    grooming_started_enabled: true,
    grooming_almost_done_enabled: true,
    grooming_completed_enabled: true,
    birthday_greeting_enabled: true,
  };
}

function uniqueCustomerRows(rows: ParsedCustomerRow[]) {
  const byKey = new Map<string, ParsedCustomerRow>();
  for (const row of rows) {
    const key = `${normalizeImportPhone(row.phone)}|${normalizedName(row.petName)}`;
    const previous = byKey.get(key);
    byKey.set(key, previous ? {
      ...previous,
      guardianMemo: appendMemo(previous.guardianMemo, row.guardianMemo),
      petMemo: appendMemo(previous.petMemo, row.petMemo),
      breed: previous.breed === "미입력" ? row.breed : previous.breed,
      weightKg: previous.weightKg ?? row.weightKg,
      birthday: previous.birthday ?? row.birthday,
      notificationEnabled: previous.notificationEnabled && row.notificationEnabled,
    } : row);
  }
  return Array.from(byKey.values());
}

function uniqueVisitRows(rows: ParsedVisitRow[]) {
  const byKey = new Map<string, ParsedVisitRow>();
  for (const row of rows) {
    const key = [normalizeImportPhone(row.phone), normalizedName(row.petName), row.visitDate, normalizedName(row.serviceName)].join("|");
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function buildImportedPriceGuide(rows: ParsedPriceGuideRow[], batchId: string, source: DataImportSource) {
  const sections = new Map<string, ParsedPriceGuideRow[]>();
  for (const row of rows) sections.set(row.groupName, [...(sections.get(row.groupName) ?? []), row]);
  const normalizedSections = Array.from(sections.entries()).map(([groupName, groupRows]) => {
    const weightBands = Array.from(new Set(groupRows.map((row) => row.weightBand)));
    const breedNames = Array.from(new Set(groupRows.flatMap((row) => row.breedNames)));
    const itemNames = Array.from(new Set(groupRows.map((row) => row.serviceName)));
    return {
      id: stableId("import_section", `${batchId}|${groupName}`),
      species: "dog",
      title: groupName,
      note: breedNames.join(", "),
      weightBands,
      items: itemNames.map((serviceName) => ({
        id: stableId("import_item", `${batchId}|${groupName}|${serviceName}`),
        label: serviceName,
        cells: Object.fromEntries(weightBands.map((weightBand) => {
          const row = groupRows.find((candidate) => candidate.serviceName === serviceName && candidate.weightBand === weightBand);
          return [weightBand, {
            price: row ? String(row.price) : "",
            durationMinutes: row?.durationMinutes ? String(row.durationMinutes) : "",
          }];
        })),
      })),
    };
  });
  const firstSection = normalizedSections[0];
  return {
    enabled: true,
    weightBands: firstSection?.weightBands ?? [],
    items: (firstSection?.items ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      durationMinutes: Object.values(item.cells)[0]?.durationMinutes ?? "",
      prices: Object.fromEntries(Object.entries(item.cells).map(([band, cell]) => [band, cell.price])),
    })),
    sections: normalizedSections,
    extraNote: "외부 데이터에서 이전한 요금표 초안입니다. 검토 후 활성화해 주세요.",
    extraFees: [],
    importMetadata: { source, batchId },
  };
}

async function chunkInsert(table: string, rows: Array<Record<string, unknown>>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 서버 연결을 확인할 수 없습니다.");
  for (let index = 0; index < rows.length; index += 300) {
    const result = await supabase.from(table).insert(rows.slice(index, index + 300));
    if (result.error) throw new Error(result.error.message);
  }
}

function resultFromBatch(batch: Record<string, unknown>): DataImportCommitResult {
  return {
    batchId: String(batch.id),
    alreadyImported: true,
    summary: {
      importedGuardians: Number(batch.imported_guardian_count ?? 0),
      mergedGuardians: Number(batch.merged_guardian_count ?? 0),
      importedPets: Number(batch.imported_pet_count ?? 0),
      mergedPets: Number(batch.merged_pet_count ?? 0),
      importedVisits: Number(batch.imported_visit_count ?? 0),
      importedPriceGuideRows: Number(batch.imported_price_guide_count ?? 0),
      skippedRows: Number(batch.skipped_row_count ?? 0),
    },
  };
}

export async function commitDataImport(params: {
  shopId: string;
  userId: string | null;
  source: DataImportSource;
  fileName: string;
  buffer: Buffer;
}): Promise<DataImportCommitResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 서버 연결을 확인할 수 없습니다.");
  const { preview, parsed } = await buildDataImportPreview(params);
  const existingBatchResult = await supabase
    .from("shop_data_import_batches")
    .select("*")
    .eq("shop_id", params.shopId)
    .eq("source", params.source)
    .eq("file_sha256", preview.fileSha256)
    .maybeSingle();
  if (existingBatchResult.error) {
    throw new Error(existingBatchResult.error.message.includes("shop_data_import_batches")
      ? "데이터 이전 마이그레이션이 아직 적용되지 않았습니다."
      : existingBatchResult.error.message);
  }
  if (existingBatchResult.data?.status === "completed") return resultFromBatch(existingBatchResult.data);

  const batchId = existingBatchResult.data?.id ?? randomUUID();
  const timestamp = new Date().toISOString();
  const batchStart = await supabase.from("shop_data_import_batches").upsert({
    id: batchId,
    shop_id: params.shopId,
    source: params.source,
    file_name: params.fileName.slice(0, 240),
    file_sha256: preview.fileSha256,
    status: "processing",
    total_rows: preview.summary.totalRows,
    error_message: null,
    created_by_user_id: params.userId,
    updated_at: timestamp,
  }, { onConflict: "shop_id,source,file_sha256" });
  if (batchStart.error) throw new Error(batchStart.error.message);

  try {
    const [guardiansResult, petsResult, servicesResult, staffResult, importedRecordsResult] = await Promise.all([
      supabase.from("guardians").select("id,name,phone,memo,notification_settings,deleted_at,created_at").eq("shop_id", params.shopId).limit(10000),
      supabase.from("pets").select("id,guardian_id,name,breed,weight,birthday,notes,grooming_cycle_weeks,created_at").eq("shop_id", params.shopId).limit(20000),
      supabase.from("services").select("id,name,price,duration_minutes").eq("shop_id", params.shopId).limit(2000),
      supabase.from("staff_members").select("id,name,display_name").eq("shop_id", params.shopId).limit(2000),
      supabase.from("grooming_records").select("external_record_key").eq("shop_id", params.shopId).eq("external_source", params.source).like("external_record_key", `${preview.fileSha256}:%`).limit(5000),
    ]);
    for (const result of [guardiansResult, petsResult, servicesResult, staffResult, importedRecordsResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const guardians = (guardiansResult.data ?? []) as GuardianRow[];
    const pets = (petsResult.data ?? []) as PetRow[];
    const services = (servicesResult.data ?? []) as ServiceRow[];
    const importedRecordKeys = new Set((importedRecordsResult.data ?? []).map((row) => row.external_record_key));
    const guardianByPhone = new Map<string, GuardianRow>();
    for (const guardian of guardians.sort((left, right) => Number(Boolean(left.deleted_at)) - Number(Boolean(right.deleted_at)))) {
      const key = normalizeImportPhone(guardian.phone);
      if (key && !guardianByPhone.has(key)) guardianByPhone.set(key, guardian);
    }

    const customers = uniqueCustomerRows(parsed.customers);
    const visits = uniqueVisitRows(parsed.visits);
    const customerByPhone = new Map<string, ParsedCustomerRow>();
    for (const customer of customers) {
      const phoneKey = normalizeImportPhone(customer.phone);
      const previous = customerByPhone.get(phoneKey);
      customerByPhone.set(phoneKey, previous ? {
        ...previous,
        guardianMemo: appendMemo(previous.guardianMemo, customer.guardianMemo),
        notificationEnabled: previous.notificationEnabled && customer.notificationEnabled,
      } : customer);
    }
    const guardianUpserts: Array<Record<string, unknown>> = [];
    let importedGuardians = 0;
    let mergedGuardians = 0;
    const guardianRowsByPhone = new Map(guardianByPhone);
    for (const customer of customerByPhone.values()) {
      const phoneKey = normalizeImportPhone(customer.phone);
      if (phoneKey.length < 10) continue;
      const existing = guardianRowsByPhone.get(phoneKey);
      if (existing) {
        const notificationSettings = existing.notification_settings ?? defaultGuardianNotifications(true);
        const next: GuardianRow = {
          ...existing,
          name: existing.name || customer.guardianName,
          memo: appendMemo(existing.memo, customer.guardianMemo),
          notification_settings: customer.notificationEnabled ? notificationSettings : { ...notificationSettings, enabled: false },
          deleted_at: null,
        };
        guardianRowsByPhone.set(phoneKey, next);
        guardianUpserts.push({ ...next, shop_id: params.shopId, deleted_restore_until: null, updated_at: timestamp });
        mergedGuardians += 1;
      } else {
        const next: GuardianRow = {
          id: randomUUID(),
          name: customer.guardianName,
          phone: customer.phone,
          memo: customer.guardianMemo,
          notification_settings: defaultGuardianNotifications(customer.notificationEnabled),
          deleted_at: null,
          created_at: timestamp,
        };
        guardianRowsByPhone.set(phoneKey, next);
        guardianUpserts.push({ ...next, shop_id: params.shopId, updated_at: timestamp });
        importedGuardians += 1;
      }
    }
    if (guardianUpserts.length > 0) {
      const result = await supabase.from("guardians").upsert(guardianUpserts, { onConflict: "id" });
      if (result.error) throw new Error(result.error.message);
    }

    const petByKey = new Map(pets.map((pet) => [`${pet.guardian_id}|${normalizedName(pet.name)}`, pet]));
    const petUpserts: Array<Record<string, unknown>> = [];
    let importedPets = 0;
    let mergedPets = 0;
    for (const customer of customers) {
      const guardian = guardianRowsByPhone.get(normalizeImportPhone(customer.phone));
      if (!guardian) continue;
      const key = `${guardian.id}|${normalizedName(customer.petName)}`;
      const existing = petByKey.get(key);
      if (existing) {
        const next: PetRow = {
          ...existing,
          breed: existing.breed && existing.breed !== "미입력" ? existing.breed : customer.breed,
          weight: existing.weight ?? customer.weightKg,
          birthday: existing.birthday ?? customer.birthday,
          notes: appendMemo(existing.notes, customer.petMemo),
          grooming_cycle_weeks: existing.grooming_cycle_weeks || customer.groomingCycleWeeks,
        };
        petByKey.set(key, next);
        petUpserts.push({ ...next, shop_id: params.shopId, updated_at: timestamp });
        mergedPets += 1;
      } else {
        const next: PetRow = {
          id: randomUUID(),
          guardian_id: guardian.id,
          name: customer.petName,
          breed: customer.breed || "미입력",
          weight: customer.weightKg,
          birthday: customer.birthday,
          notes: customer.petMemo,
          grooming_cycle_weeks: customer.groomingCycleWeeks,
          created_at: timestamp,
        };
        petByKey.set(key, next);
        petUpserts.push({ ...next, shop_id: params.shopId, updated_at: timestamp });
        importedPets += 1;
      }
    }
    if (petUpserts.length > 0) {
      const result = await supabase.from("pets").upsert(petUpserts, { onConflict: "id" });
      if (result.error) throw new Error(result.error.message);
    }

    const serviceByName = new Map(services.map((service) => [normalizedName(service.name), service]));
    const serviceUpserts: Array<Record<string, unknown>> = [];
    for (const visit of visits) {
      const serviceKey = normalizedName(visit.serviceName);
      if (!serviceKey || serviceByName.has(serviceKey)) continue;
      const service: ServiceRow = {
        id: stableId("import_service", `${params.shopId}|${serviceKey}`),
        name: `외부 이전 · ${visit.serviceName}`,
        price: Math.max(0, visit.originalAmount || visit.paidAmount),
        duration_minutes: visit.expectedMinutes ?? visit.actualMinutes ?? 60,
      };
      serviceByName.set(serviceKey, service);
      serviceUpserts.push({
        ...service,
        shop_id: params.shopId,
        price_type: "starting",
        is_active: false,
        category: "이전 기록",
        description: "기존 방문 기록 연결용 비활성 서비스입니다.",
        sort_order: 999,
        capacity_label: "기록 전용",
        staff_selection_mode: "unassigned",
        price_guide: { enabled: false, importOnly: true, source: params.source },
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    if (parsed.priceGuide.length > 0) {
      const draftId = stableId("import_price_guide", `${params.shopId}|${preview.fileSha256}`);
      const minimumPrice = Math.min(...parsed.priceGuide.map((row) => row.price));
      const minimumDuration = Math.min(...parsed.priceGuide.map((row) => row.durationMinutes ?? 60));
      serviceUpserts.push({
        id: draftId,
        shop_id: params.shopId,
        name: `${params.source === "teepee" ? "티피" : "외부"} 이전 요금표 (검토 필요)`,
        price: minimumPrice,
        price_type: "starting",
        duration_minutes: minimumDuration,
        is_active: false,
        category: "이전 요금표",
        description: "기존 요금표를 덮어쓰지 않는 비활성 초안입니다.",
        sort_order: 998,
        capacity_label: "검토 후 설정",
        staff_selection_mode: "all",
        price_guide: buildImportedPriceGuide(parsed.priceGuide, batchId, params.source),
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
    if (serviceUpserts.length > 0) {
      const result = await supabase.from("services").upsert(serviceUpserts, { onConflict: "id" });
      if (result.error) throw new Error(result.error.message);
    }

    const staffByName = new Map<string, { id: string }>();
    for (const member of staffResult.data ?? []) {
      if (member.name) staffByName.set(normalizedName(member.name), member);
      if (member.display_name) staffByName.set(normalizedName(member.display_name), member);
    }
    const recordRows: Array<Record<string, unknown>> = [];
    const auditRows: Array<Record<string, unknown>> = [];
    let skippedRows = parsed.skippedRows;
    let importedVisits = importedRecordKeys.size;

    for (const customer of customers) {
      const guardian = guardianRowsByPhone.get(normalizeImportPhone(customer.phone));
      const pet = guardian ? petByKey.get(`${guardian.id}|${normalizedName(customer.petName)}`) : null;
      if (!guardian || !pet) continue;
      const existed = guardians.some((row) => row.id === guardian.id) || pets.some((row) => row.id === pet.id);
      auditRows.push({
        batch_id: batchId,
        shop_id: params.shopId,
        row_number: customer.rowNumber,
        entity_type: "customer",
        row_fingerprint: rowFingerprint(`${normalizeImportPhone(customer.phone)}|${normalizedName(customer.petName)}`),
        status: existed ? "merged" : "imported",
        guardian_id: guardian.id,
        pet_id: pet.id,
      });
    }

    for (const visit of visits) {
      const externalRecordKey = dataImportRowKey(preview.fileSha256, visit.sheetName, visit.rowNumber);
      if (importedRecordKeys.has(externalRecordKey)) continue;
      const guardian = guardianRowsByPhone.get(normalizeImportPhone(visit.phone));
      const pet = guardian ? petByKey.get(`${guardian.id}|${normalizedName(visit.petName)}`) : null;
      const service = serviceByName.get(normalizedName(visit.serviceName));
      if (!guardian || !pet || !service) {
        skippedRows += 1;
        auditRows.push({
          batch_id: batchId,
          shop_id: params.shopId,
          row_number: visit.rowNumber,
          entity_type: "visit",
          row_fingerprint: rowFingerprint(externalRecordKey),
          status: "skipped",
          error_code: "missing_customer_pet_or_service",
        });
        continue;
      }
      const recordId = randomUUID();
      recordRows.push({
        id: recordId,
        shop_id: params.shopId,
        guardian_id: guardian.id,
        pet_id: pet.id,
        service_id: service.id,
        appointment_id: null,
        staff_id: visit.staffName ? staffByName.get(normalizedName(visit.staffName))?.id ?? null : null,
        style_notes: visit.treatmentNotes,
        memo: visit.specialNotes,
        price_paid: visit.paidAmount,
        actual_duration_minutes: visit.actualMinutes,
        expected_duration_minutes: visit.expectedMinutes ?? service.duration_minutes,
        original_price: Math.max(visit.originalAmount, visit.paidAmount + visit.discountAmount),
        discount_amount: visit.discountAmount,
        pet_breed_snapshot: visit.breed || pet.breed,
        pet_weight_snapshot: visit.weightKg ?? pet.weight,
        service_name_snapshot: visit.serviceName,
        record_source: "external_import",
        external_source: params.source,
        external_record_key: externalRecordKey,
        import_batch_id: batchId,
        groomed_at: `${visit.visitDate}T12:00:00+09:00`,
        created_at: timestamp,
        updated_at: timestamp,
      });
      auditRows.push({
        batch_id: batchId,
        shop_id: params.shopId,
        row_number: visit.rowNumber,
        entity_type: "visit",
        row_fingerprint: rowFingerprint(externalRecordKey),
        status: "imported",
        guardian_id: guardian.id,
        pet_id: pet.id,
        grooming_record_id: recordId,
        service_id: service.id,
      });
      importedVisits += 1;
    }
    await chunkInsert("grooming_records", recordRows);

    if (parsed.priceGuide.length > 0) {
      const draftServiceId = stableId("import_price_guide", `${params.shopId}|${preview.fileSha256}`);
      for (const row of parsed.priceGuide) {
        auditRows.push({
          batch_id: batchId,
          shop_id: params.shopId,
          row_number: row.rowNumber,
          entity_type: "price_guide",
          row_fingerprint: rowFingerprint(`${row.sheetName}|${row.rowNumber}|${row.groupName}|${row.weightBand}|${row.serviceName}`),
          status: "imported",
          service_id: draftServiceId,
        });
      }
    }
    if (auditRows.length > 0) {
      const auditResult = await supabase.from("shop_data_import_rows").upsert(auditRows, {
        onConflict: "batch_id,entity_type,row_fingerprint",
      });
      if (auditResult.error) throw new Error(auditResult.error.message);
    }

    const summary = {
      importedGuardians,
      mergedGuardians,
      importedPets,
      mergedPets,
      importedVisits,
      importedPriceGuideRows: parsed.priceGuide.length,
      skippedRows,
    };
    const completed = await supabase.from("shop_data_import_batches").update({
      status: "completed",
      imported_guardian_count: importedGuardians,
      merged_guardian_count: mergedGuardians,
      imported_pet_count: importedPets,
      merged_pet_count: mergedPets,
      imported_visit_count: importedVisits,
      imported_price_guide_count: parsed.priceGuide.length,
      skipped_row_count: skippedRows,
      summary,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", batchId);
    if (completed.error) throw new Error(completed.error.message);
    return { batchId, alreadyImported: false, summary };
  } catch (error) {
    await supabase.from("shop_data_import_batches").update({
      status: "failed",
      error_message: error instanceof Error ? error.message.slice(0, 1000) : "unknown_error",
      updated_at: new Date().toISOString(),
    }).eq("id", batchId);
    throw error;
  }
}
