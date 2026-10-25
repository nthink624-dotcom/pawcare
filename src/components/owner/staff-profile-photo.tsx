"use client";

import { useMemo, useState } from "react";

import { getStaffProfileImageCandidates } from "@/lib/staff-profile-fallback";

type Props = {
  src?: string | null;
  fallbackKey?: string | null;
  alt: string;
};

export function StaffProfilePhoto({ src, fallbackKey, alt }: Props) {
  const candidates = useMemo(() => getStaffProfileImageCandidates(src, fallbackKey), [fallbackKey, src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidate = candidates[Math.min(candidateIndex, candidates.length - 1)];
  const usingRegisteredPhoto = Boolean(src?.trim()) && candidateIndex === 0;

  // Signed profile media can use per-shop hosts, so the native image element is required here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img
    src={candidate}
    alt={alt}
    data-profile-source={usingRegisteredPhoto ? "registered" : "fallback"}
    className="h-full w-full object-cover"
    onError={() => setCandidateIndex((current) => Math.min(current + 1, candidates.length - 1))}
  />;
}
