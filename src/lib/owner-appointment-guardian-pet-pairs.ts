export type AppointmentGuardianPetPair<Guardian, Pet> = {
  guardian: Guardian;
  pet: Pet;
};

export function flattenAppointmentGuardianPetPairs<Guardian, Pet>(
  groups: Array<{ guardian: Guardian; pets: Pet[] }>,
): Array<AppointmentGuardianPetPair<Guardian, Pet>> {
  return groups.flatMap(({ guardian, pets }) => pets.map((pet) => ({ guardian, pet })));
}
