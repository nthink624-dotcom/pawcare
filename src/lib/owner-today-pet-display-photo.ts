import type { Appointment, PetDisplayPhotoProjection } from "@/types/domain";

export function indexTodayPetDisplayPhotosByAppointmentId(
  photos: readonly PetDisplayPhotoProjection[],
) {
  return new Map(photos.map((photo) => [photo.appointmentId, photo]));
}

export function resolveTodayAppointmentPetDisplayPhoto(
  photosByAppointmentId: ReadonlyMap<string, PetDisplayPhotoProjection>,
  appointment: Pick<Appointment, "id" | "pet_id">,
) {
  const photo = photosByAppointmentId.get(appointment.id);
  return photo?.petId === appointment.pet_id ? photo : undefined;
}
