"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildStaffAvatarCandidates,
  findFirstUsableStaffAvatarCandidate,
  type StaffAvatarCandidate,
} from "@/lib/staff-avatar-candidates";
import { resolveStaffProfileFallbackOrDefaultImageUrl, type StaffProfileFallbackKey } from "@/lib/staff-profile-fallback";
import { cn } from "@/lib/utils";

const failedAvatarCandidates = new Set<string>();
const lastDecodedAvatarByIdentity = new Map<string, { candidateSetKey: string; url: string }>();

export function StableAvatar({
  identity,
  name,
  imageUrl,
  imageUrls,
  imageAssetId,
  imageAssetIds,
  profileImageFallbackKey,
  size = "md",
  className,
}: {
  identity: string;
  name: string;
  imageUrl?: string | null;
  imageUrls?: Array<string | null | undefined> | null;
  imageAssetId?: string | null;
  imageAssetIds?: Array<string | null | undefined> | null;
  profileImageFallbackKey?: StaffProfileFallbackKey | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const candidates = useMemo(
    () => buildStaffAvatarCandidates({ identity, imageUrl, imageUrls, imageAssetId, imageAssetIds }),
    [identity, imageAssetId, imageAssetIds, imageUrl, imageUrls],
  );
  const candidateSetKey = JSON.stringify(candidates.map((candidate) => candidate.key));
  const [decodedAvatar, setDecodedAvatar] = useState({ identity: "", candidateSetKey: "", url: "" });
  const cachedAvatar = lastDecodedAvatarByIdentity.get(identity);
  const decodedUrl = candidateSetKey
    ? decodedAvatar.identity === identity && decodedAvatar.candidateSetKey === candidateSetKey
      ? decodedAvatar.url
      : cachedAvatar?.candidateSetKey === candidateSetKey
        ? cachedAvatar.url
        : ""
    : "";

  useEffect(() => {
    if (candidates.length === 0 || !candidateSetKey) return;
    if (lastDecodedAvatarByIdentity.get(identity)?.candidateSetKey === candidateSetKey) return;

    let cancelled = false;
    void findFirstUsableStaffAvatarCandidate(
      candidates,
      (candidate: StaffAvatarCandidate) => new Promise((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = async () => {
          try {
            await image.decode();
            resolve(true);
          } catch {
            resolve(false);
          }
        };
        image.onerror = () => resolve(false);
        image.src = candidate.url;
      }),
      failedAvatarCandidates,
    ).then((candidate) => {
      if (cancelled || !candidate) return;
      lastDecodedAvatarByIdentity.set(identity, { candidateSetKey, url: candidate.url });
      setDecodedAvatar({ identity, candidateSetKey, url: candidate.url });
    });

    return () => {
      cancelled = true;
    };
  }, [candidateSetKey, candidates, identity]);

  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const showPhoto = Boolean(decodedUrl);
  const displayImageUrl = decodedUrl || resolveStaffProfileFallbackOrDefaultImageUrl(profileImageFallbackKey);

  return (
    <span
      data-avatar-photo-state={showPhoto ? "decoded" : profileImageFallbackKey ? "preset" : candidates.length > 0 ? "fallback" : "default"}
      data-avatar-fallback-key={profileImageFallbackKey ?? ""}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e8edf3] bg-[#f8fafc] text-[#475569]",
        sizeClass,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={displayImageUrl} alt={showPhoto ? `${name || "직원"} 프로필` : "기본 프로필"} className="h-full w-full object-cover" />
    </span>
  );
}
