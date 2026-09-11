"use client";

import { useEffect, useState } from "react";

import { resolveStaffProfileFallbackImageUrl, type StaffProfileFallbackKey } from "@/lib/staff-profile-fallback";
import { cn } from "@/lib/utils";

const failedAvatarCandidates = new Set<string>();
const lastDecodedAvatarByIdentity = new Map<string, { candidateKey: string; url: string }>();

export function StableAvatar({
  identity,
  name,
  imageUrl,
  imageAssetId,
  profileImageFallbackKey,
  size = "md",
  className,
}: {
  identity: string;
  name: string;
  imageUrl?: string | null;
  imageAssetId?: string | null;
  profileImageFallbackKey?: StaffProfileFallbackKey | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const candidateUrl = imageUrl?.trim() ?? "";
  const candidateKey = candidateUrl ? `${identity}:${imageAssetId?.trim() || candidateUrl}` : "";
  const [decodedAvatar, setDecodedAvatar] = useState({ identity: "", candidateKey: "", url: "" });
  const cachedAvatar = lastDecodedAvatarByIdentity.get(identity);
  const decodedUrl = candidateKey
    ? decodedAvatar.identity === identity && decodedAvatar.candidateKey === candidateKey
      ? decodedAvatar.url
      : cachedAvatar?.candidateKey === candidateKey
        ? cachedAvatar.url
        : ""
    : "";

  useEffect(() => {
    if (!candidateUrl || !candidateKey) return;
    if (failedAvatarCandidates.has(candidateKey)) return;
    if (lastDecodedAvatarByIdentity.get(identity)?.candidateKey === candidateKey) return;

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        failedAvatarCandidates.add(candidateKey);
        return;
      }
      if (cancelled) return;
      lastDecodedAvatarByIdentity.set(identity, { candidateKey, url: candidateUrl });
      setDecodedAvatar({ identity, candidateKey, url: candidateUrl });
    };
    image.onerror = () => {
      failedAvatarCandidates.add(candidateKey);
    };
    image.src = candidateUrl;

    return () => {
      cancelled = true;
    };
  }, [candidateKey, candidateUrl, identity]);

  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const showPhoto = Boolean(decodedUrl);
  const displayImageUrl = decodedUrl || resolveStaffProfileFallbackImageUrl(profileImageFallbackKey);

  return (
    <span
      data-avatar-photo-state={showPhoto ? "decoded" : displayImageUrl ? "preset" : candidateUrl ? "fallback" : "not-requested"}
      data-avatar-fallback-key={profileImageFallbackKey ?? ""}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e8edf3] bg-[#f8fafc] text-[#475569]",
        sizeClass,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {displayImageUrl ? <img src={displayImageUrl} alt={showPhoto ? `${name || "직원"} 프로필` : "기본 프로필"} className="h-full w-full object-cover" /> : null}
    </span>
  );
}
