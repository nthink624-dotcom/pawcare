import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getOwnerMediaSignedUrls } from "@/server/media-service";
import type { Appointment, Pet, PetDisplayPhotoProjection } from "@/types/domain";

type LatestCompletedRecordRow = {
  id: string;
  shop_id: string;
  pet_id: string;
  appointment_id: string | null;
  groomed_at: string;
};

type AfterMediaRow = {
  id: string;
  shop_id: string;
  pet_id: string | null;
  appointment_id: string | null;
  grooming_record_id: string | null;
  media_kind: string;
  status: string;
  created_at: string;
};

type ProjectionInput = {
  shopId: string;
  pets: Array<Pick<Pet, "id" | "shop_id">>;
  appointments: Array<Pick<Appointment, "id" | "shop_id" | "pet_id" | "start_at">>;
  records: LatestCompletedRecordRow[];
  afterMedia: AfterMediaRow[];
  signedUrlByMediaAssetId: ReadonlyMap<string, string>;
};

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareNewestRecord(first: LatestCompletedRecordRow, second: LatestCompletedRecordRow) {
  const timestampOrder = second.groomed_at.localeCompare(first.groomed_at);
  return timestampOrder || second.id.localeCompare(first.id);
}

function fallbackProjection(
  appointment: ProjectionInput["appointments"][number],
): PetDisplayPhotoProjection {
  return {
    appointmentId: appointment.id,
    petId: appointment.pet_id,
    url: null,
    source: "fallback",
    sourceAppointmentId: null,
    sourceGroomingRecordId: null,
    latestCompletedAt: null,
  };
}

/**
 * Produces only display-safe fields for the supplied appointment set. Media is
 * accepted only after its shop, pet, appointment and grooming-record bindings
 * agree; an exact ready after photo takes precedence over a strictly earlier
 * ready after photo for the same pet.
 */
export function projectLatestCompletedPetDisplayPhotos(input: ProjectionInput): PetDisplayPhotoProjection[] {
  const allowedPets = new Map(
    input.pets.filter((pet) => pet.shop_id === input.shopId).map((pet) => [pet.id, pet]),
  );
  const validAppointments = input.appointments.filter(
    (appointment) => appointment.shop_id === input.shopId && allowedPets.has(appointment.pet_id),
  );
  const recordsById = new Map(
    input.records
      .filter((record) => record.shop_id === input.shopId && allowedPets.has(record.pet_id))
      .map((record) => [record.id, record]),
  );
  const afterMedia = [...input.afterMedia].sort((first, second) => {
    const createdOrder = second.created_at.localeCompare(first.created_at);
    return createdOrder || second.id.localeCompare(first.id);
  });

  return validAppointments.map((appointment) => {
    const eligibleMedia = afterMedia.filter((media) => {
      if (
        media.shop_id !== input.shopId ||
        media.media_kind !== "grooming_after" ||
        media.status !== "ready" ||
        media.pet_id !== appointment.pet_id ||
        !media.grooming_record_id
      ) {
        return false;
      }
      const record = recordsById.get(media.grooming_record_id);
      return record?.pet_id === appointment.pet_id;
    });
    const exact = eligibleMedia.find((media) => {
      const record = recordsById.get(media.grooming_record_id!);
      return media.appointment_id === appointment.id && record?.appointment_id === appointment.id;
    });
    const prior = eligibleMedia
      .filter((media) => {
        const record = recordsById.get(media.grooming_record_id!);
        return record && record.groomed_at < appointment.start_at;
      })
      .sort((first, second) => {
        const firstRecord = recordsById.get(first.grooming_record_id!)!;
        const secondRecord = recordsById.get(second.grooming_record_id!)!;
        return compareNewestRecord(firstRecord, secondRecord);
      })[0];
    const selected = exact ?? prior;
    const signedUrl = selected ? safeHttpsUrl(input.signedUrlByMediaAssetId.get(selected.id)) : null;
    if (!selected || !signedUrl) return fallbackProjection(appointment);

    const record = recordsById.get(selected.grooming_record_id!);
    return {
      appointmentId: appointment.id,
      petId: appointment.pet_id,
      url: signedUrl,
      source: selected === exact ? "appointment_grooming_after" : "prior_grooming_after",
      sourceAppointmentId: selected.appointment_id ?? record?.appointment_id ?? null,
      sourceGroomingRecordId: record?.id ?? null,
      latestCompletedAt: record?.groomed_at ?? null,
    };
  });
}

async function loadLatestRecordsForPets(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  shopId: string,
  petIds: string[],
) {
  const result = await supabase
    .from("grooming_records")
    .select("id,shop_id,pet_id,appointment_id,groomed_at")
    .eq("shop_id", shopId)
    .in("pet_id", petIds)
    .order("groomed_at", { ascending: false })
    .order("id", { ascending: false })
  return result.error ? [] : (result.data as LatestCompletedRecordRow[] ?? []);
}

export async function loadLatestCompletedPetDisplayPhotos(
  shopId: string,
  pets: ProjectionInput["pets"],
  appointments: ProjectionInput["appointments"],
): Promise<PetDisplayPhotoProjection[]> {
  const shopPets = pets.filter((pet) => pet.shop_id === shopId);
  const shopAppointments = appointments.filter((appointment) => appointment.shop_id === shopId);
  const fallback = projectLatestCompletedPetDisplayPhotos({
    shopId,
    pets: shopPets,
    appointments: shopAppointments,
    records: [],
    afterMedia: [],
    signedUrlByMediaAssetId: new Map(),
  });
  const supabase = getSupabaseAdmin();
  if (!supabase || shopPets.length === 0 || shopAppointments.length === 0) return fallback;

  try {
    const records = await loadLatestRecordsForPets(supabase, shopId, shopPets.map((pet) => pet.id));
    if (records.length === 0) return fallback;

    const mediaResult = await supabase
      .from("media_assets")
      .select("id,shop_id,pet_id,appointment_id,grooming_record_id,media_kind,status,created_at")
      .eq("shop_id", shopId)
      .in("pet_id", shopPets.map((pet) => pet.id))
      .eq("media_kind", "grooming_after")
      .eq("status", "ready")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (mediaResult.error) {
      return projectLatestCompletedPetDisplayPhotos({
        shopId,
        pets: shopPets,
        appointments: shopAppointments,
        records,
        afterMedia: [],
        signedUrlByMediaAssetId: new Map(),
      });
    }

    const afterMedia = (mediaResult.data ?? []) as AfterMediaRow[];
    const signed = await getOwnerMediaSignedUrls(
      { shopId, userId: null },
      { mediaAssetIds: afterMedia.map((media) => media.id), variantKey: "thumbnail" },
    );
    return projectLatestCompletedPetDisplayPhotos({
      shopId,
      pets: shopPets,
      appointments: shopAppointments,
      records,
      afterMedia,
      signedUrlByMediaAssetId: new Map(
        signed.items.map((item) => [item.mediaAssetId, item.signedUrl]),
      ),
    });
  } catch {
    // Display media is non-critical and older schemas may not have media tables.
    return fallback;
  }
}
