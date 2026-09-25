import { createHash, randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, type OwnerShopContext } from "@/server/owner-api-auth";
import type { AppointmentVisitWeightResponse, VisitWeightMeasurement } from "@/types/visit-weight";

type AppointmentScope = {
  id: string;
  shop_id: string;
  pet_id: string;
  staff_id: string | null;
};

type VisitWeightRow = {
  id: string;
  shop_id: string;
  appointment_id: string;
  pet_id: string;
  weight_kg: number;
  measured_at: string;
  measured_by_user_id: string | null;
  idempotency_key_hash: string;
};

const demoMeasurements: VisitWeightRow[] = [];

function isMissingVisitWeightSchema(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("appointment_visit_weight_measurements");
}

function hashIdempotencyKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function serializeMeasurement(row: VisitWeightRow | null): VisitWeightMeasurement | null {
  if (!row) return null;
  return {
    appointmentId: row.appointment_id,
    petId: row.pet_id,
    weightKg: Number(row.weight_kg),
    measuredAt: row.measured_at,
  };
}

async function requireAppointmentScope(owner: OwnerShopContext, appointmentId: string): Promise<AppointmentScope> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      id: appointmentId,
      shop_id: owner.shopId,
      pet_id: `demo-pet:${appointmentId}`,
      staff_id: owner.staffId,
    };
  }

  const result = await admin
    .from("appointments")
    .select("id,shop_id,pet_id,staff_id")
    .eq("id", appointmentId)
    .eq("shop_id", owner.shopId)
    .maybeSingle();
  if (result.error) throw new OwnerApiError("예약 정보를 확인하지 못했습니다. 다시 시도해 주세요.", 500);
  if (!result.data) throw new OwnerApiError("이 매장의 예약을 찾지 못했습니다.", 404);

  const appointment = result.data as AppointmentScope;
  if (owner.role === "staff" && appointment.staff_id !== owner.staffId) {
    throw new OwnerApiError("본인 담당 예약의 몸무게만 저장할 수 있습니다.", 403);
  }
  return appointment;
}

function latestRow(rows: VisitWeightRow[]) {
  return [...rows].sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.id.localeCompare(a.id))[0] ?? null;
}

export async function readAppointmentVisitWeight(
  owner: OwnerShopContext,
  appointmentId: string,
): Promise<AppointmentVisitWeightResponse> {
  const appointment = await requireAppointmentScope(owner, appointmentId);
  const admin = getSupabaseAdmin();
  if (!admin) {
    const scoped = demoMeasurements.filter((row) => row.shop_id === owner.shopId && row.pet_id === appointment.pet_id);
    return {
      current: serializeMeasurement(latestRow(scoped.filter((row) => row.appointment_id === appointment.id))),
      recent: serializeMeasurement(latestRow(scoped.filter((row) => row.appointment_id !== appointment.id))),
    };
  }

  const [currentResult, recentResult] = await Promise.all([
    admin
      .from("appointment_visit_weight_measurements")
      .select("id,shop_id,appointment_id,pet_id,weight_kg,measured_at,measured_by_user_id,idempotency_key_hash")
      .eq("shop_id", owner.shopId)
      .eq("appointment_id", appointment.id)
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("appointment_visit_weight_measurements")
      .select("id,shop_id,appointment_id,pet_id,weight_kg,measured_at,measured_by_user_id,idempotency_key_hash")
      .eq("shop_id", owner.shopId)
      .eq("pet_id", appointment.pet_id)
      .neq("appointment_id", appointment.id)
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (isMissingVisitWeightSchema(currentResult.error) || isMissingVisitWeightSchema(recentResult.error)) {
    throw new OwnerApiError("방문 몸무게 저장 기능을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
  if (currentResult.error || recentResult.error) {
    throw new OwnerApiError("방문 몸무게를 불러오지 못했습니다. 다시 시도해 주세요.", 500);
  }

  let recent = serializeMeasurement((recentResult.data as VisitWeightRow | null) ?? null);
  if (!recent) {
    const legacyResult = await admin
      .from("grooming_records")
      .select("appointment_id,pet_id,pet_weight_snapshot,groomed_at")
      .eq("shop_id", owner.shopId)
      .eq("pet_id", appointment.pet_id)
      .neq("appointment_id", appointment.id)
      .not("pet_weight_snapshot", "is", null)
      .order("groomed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyResult.error) throw new OwnerApiError("최근 몸무게를 불러오지 못했습니다. 다시 시도해 주세요.", 500);
    if (legacyResult.data?.appointment_id && legacyResult.data.groomed_at) {
      recent = {
        appointmentId: legacyResult.data.appointment_id,
        petId: legacyResult.data.pet_id,
        weightKg: Number(legacyResult.data.pet_weight_snapshot),
        measuredAt: legacyResult.data.groomed_at,
      };
    }
  }

  return {
    current: serializeMeasurement((currentResult.data as VisitWeightRow | null) ?? null),
    recent,
  };
}

export async function saveAppointmentVisitWeight(
  owner: OwnerShopContext,
  input: { appointmentId: string; weightKg: number; idempotencyKey: string },
): Promise<VisitWeightMeasurement> {
  const appointment = await requireAppointmentScope(owner, input.appointmentId);
  const requestHash = hashIdempotencyKey(input.idempotencyKey);
  const admin = getSupabaseAdmin();

  if (!admin) {
    const replay = demoMeasurements.find(
      (row) => row.shop_id === owner.shopId && row.appointment_id === appointment.id && row.idempotency_key_hash === requestHash,
    );
    if (replay) {
      if (Number(replay.weight_kg) !== input.weightKg) throw new OwnerApiError("같은 저장 요청의 내용이 달라 다시 저장할 수 없습니다.", 409);
      return serializeMeasurement(replay) as VisitWeightMeasurement;
    }
    const row: VisitWeightRow = {
      id: randomUUID(),
      shop_id: owner.shopId,
      appointment_id: appointment.id,
      pet_id: appointment.pet_id,
      weight_kg: input.weightKg,
      measured_at: new Date().toISOString(),
      measured_by_user_id: owner.userId,
      idempotency_key_hash: requestHash,
    };
    demoMeasurements.push(row);
    return serializeMeasurement(row) as VisitWeightMeasurement;
  }

  if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
  const replayResult = await admin
    .from("appointment_visit_weight_measurements")
    .select("id,shop_id,appointment_id,pet_id,weight_kg,measured_at,measured_by_user_id,idempotency_key_hash")
    .eq("shop_id", owner.shopId)
    .eq("appointment_id", appointment.id)
    .eq("idempotency_key_hash", requestHash)
    .maybeSingle();
  if (isMissingVisitWeightSchema(replayResult.error)) {
    throw new OwnerApiError("방문 몸무게 저장 기능을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
  if (replayResult.error) throw new OwnerApiError("방문 몸무게 저장 상태를 확인하지 못했습니다.", 500);
  if (replayResult.data) {
    const replay = replayResult.data as VisitWeightRow;
    if (Number(replay.weight_kg) !== input.weightKg) throw new OwnerApiError("같은 저장 요청의 내용이 달라 다시 저장할 수 없습니다.", 409);
    return serializeMeasurement(replay) as VisitWeightMeasurement;
  }

  const insertResult = await admin
    .from("appointment_visit_weight_measurements")
    .insert({
      shop_id: owner.shopId,
      appointment_id: appointment.id,
      pet_id: appointment.pet_id,
      weight_kg: input.weightKg,
      measured_by_user_id: owner.userId,
      idempotency_key_hash: requestHash,
    })
    .select("id,shop_id,appointment_id,pet_id,weight_kg,measured_at,measured_by_user_id,idempotency_key_hash")
    .single();
  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      return saveAppointmentVisitWeight(owner, input);
    }
    if (isMissingVisitWeightSchema(insertResult.error)) {
      throw new OwnerApiError("방문 몸무게 저장 기능을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.", 503);
    }
    throw new OwnerApiError("오늘 몸무게를 저장하지 못했습니다. 입력한 값은 유지되었어요. 다시 시도해 주세요.", 500);
  }
  return serializeMeasurement(insertResult.data as VisitWeightRow) as VisitWeightMeasurement;
}

export async function readCurrentVisitWeightForCompletion(shopId: string, appointmentId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return serializeMeasurement(latestRow(demoMeasurements.filter((row) => row.shop_id === shopId && row.appointment_id === appointmentId)));
  }
  const result = await admin
    .from("appointment_visit_weight_measurements")
    .select("id,shop_id,appointment_id,pet_id,weight_kg,measured_at,measured_by_user_id,idempotency_key_hash")
    .eq("shop_id", shopId)
    .eq("appointment_id", appointmentId)
    .order("measured_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (isMissingVisitWeightSchema(result.error)) return null;
  if (result.error) throw new Error(result.error.message);
  return serializeMeasurement((result.data as VisitWeightRow | null) ?? null);
}
