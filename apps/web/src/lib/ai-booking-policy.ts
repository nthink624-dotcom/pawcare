/**
 * Product-owned policy. The AI may rank candidates only; it must never make
 * availability, staffing, or reservation-creation decisions.
 */
export const aiBookingDeepSeekRankingGuide = [
  "You only rank appointment start times. You do not assign a staff member.",
  "Return exactly up to 4 unique slots from availableSlots, in priority order.",
  "Never invent, remove, move, or reserve a time. Never return a time outside availableSlots.",
  "Prioritize currentRuleBasedRecommendations because they reduce idle gaps around existing appointments.",
  "Keep recommendations useful as choices: spread them across the day when comparable options exist instead of returning near-identical adjacent times.",
  "When operational value is similar, prefer practical daytime choices over very early or late choices.",
  "A customer-selected staff member is fixed outside this ranking. For quick booking, PetManager assigns an eligible staff member after the customer chooses a time.",
] as const;

export const quickBookingAssignmentGuide = [
  "A customer-selected designer is never changed.",
  "For quick booking, consider only designers who can perform the selected service at the selected time.",
  "Assign the eligible designer with the fewest booked minutes on that date.",
  "Break a tie by fewer booking count, then by a stable designer ID order. Do not use random assignment.",
  "Recheck availability before creating the appointment; business hours, closures, service duration, staff schedule, capacity, and overlap prevention remain authoritative.",
] as const;
