import type { MediaKind } from "@/types/domain";

type MediaStorageDateInput = Date | string | null | undefined;

type MediaStorageDirectoryInput = {
  shopId: string;
  mediaAssetId: string;
  mediaKind: MediaKind;
  createdAt?: MediaStorageDateInput;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  staffId?: string | null;
};

function getYearMonth(createdAt: MediaStorageDateInput) {
  const date = createdAt ? new Date(createdAt) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return {
    year: safeDate.getUTCFullYear(),
    month: String(safeDate.getUTCMonth() + 1).padStart(2, "0"),
  };
}

function mediaScopePath(params: MediaStorageDirectoryInput) {
  if (params.mediaKind === "shop_profile") {
    return "shop-profile";
  }

  if (params.mediaKind === "staff_profile") {
    const staffId = params.staffId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "unassigned";
    return `staff-profiles/${staffId}`;
  }

  if (params.appointmentId) {
    return `appointments/${params.appointmentId}/${params.mediaKind}`;
  }

  if (params.petId) {
    return `pets/${params.petId}/${params.mediaKind}`;
  }

  if (params.guardianId) {
    return `guardians/${params.guardianId}/${params.mediaKind}`;
  }

  if (params.mediaKind === "message_image") {
    return "messages";
  }

  if (params.mediaKind === "memo_attachment") {
    return "memo-attachments";
  }

  return `media/${params.mediaKind}`;
}

export function buildMediaStorageDirectory(params: MediaStorageDirectoryInput) {
  const { year, month } = getYearMonth(params.createdAt);
  return `shops/${params.shopId}/${mediaScopePath(params)}/${year}/${month}/${params.mediaAssetId}`;
}
