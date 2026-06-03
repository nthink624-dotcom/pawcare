"use client";

import { Camera, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BasilIcon } from "@/components/owner-web/basil-icon";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  compressImageForPetmanager,
  compressImageVariantsForPetmanager,
  type PetmanagerCompressedImage,
} from "@/lib/media/client-image-compression";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaKind, MediaVariant, Notification, NotificationStatus } from "@/types/domain";

type MediaAssetListItem = {
  mediaAsset: MediaAsset;
  variants: MediaVariant[];
};

type MediaAssetListResponse = {
  items: MediaAssetListItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextBeforeCreatedAt: string | null;
  };
};

type UploadIntentResponse = {
  mediaAsset: MediaAsset;
  upload: {
    bucket: string;
    path: string;
    token: string;
    maxBytes: number;
  };
};

type CompleteUploadResponse = {
  mediaAsset: MediaAsset;
};

type VariantUploadIntentResponse = {
  upload: {
    bucket: string;
    path: string;
    token: string;
    maxBytes: number;
  };
};

type VariantCompleteResponse = {
  variant: MediaVariant;
};

type SignedUrlResponse = {
  mediaAsset: MediaAsset;
  variant: MediaVariant | null;
  signedUrl: string;
  expiresInSeconds: number;
};

type PhotoSendRequestItem = {
  notification: Notification;
  attachmentCount: number;
};

type PhotoSendRequestListResponse = {
  items: PhotoSendRequestItem[];
};

type UploadSlot = {
  key: "before" | "after";
  label: string;
  mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">;
};

type MediaContext = {
  shopId: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
};

type PreviewItem = {
  mediaAsset: MediaAsset;
  signedUrl: string;
};

type UploadMessageTone = "info" | "success" | "error";

const uploadSlots: UploadSlot[] = [
  { key: "before", label: "미용 전 사진", mediaKind: "grooming_before" },
  { key: "after", label: "완료 사진", mediaKind: "grooming_after" },
];

function buildQuery(context: MediaContext) {
  const query = new URLSearchParams({
    shopId: context.shopId,
    limit: "12",
  });

  if (context.groomingRecordId) {
    query.set("groomingRecordId", context.groomingRecordId);
  } else if (context.appointmentId) {
    query.set("appointmentId", context.appointmentId);
  } else {
    if (context.guardianId) query.set("guardianId", context.guardianId);
    if (context.petId) query.set("petId", context.petId);
  }

  return query;
}

function getLatestByKind(items: PreviewItem[], mediaKind: MediaKind) {
  return items.find((item) => item.mediaAsset.media_kind === mediaKind) ?? null;
}

function getPhotoSendStatusCopy(status: NotificationStatus, failReason?: string | null) {
  if (status === "sent") return "완료 사진 알림톡 발송 완료";
  if (status === "failed") return failReason || "완료 사진 전송 실패";
  if (status === "skipped") return failReason || "완료 사진 전송 제외";
  if (failReason) return failReason;
  return "완료 사진 전송 요청 저장됨";
}

function isAlimtalkCreditEmptyReason(reason?: string | null) {
  return reason?.includes("알림톡 잔여 건수가 없습니다") ?? false;
}

async function uploadCompressedFile(params: {
  bucket: string;
  path: string;
  token: string;
  file: File;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase 연결을 확인할 수 없습니다.");
  }

  const result = await supabase.storage
    .from(params.bucket)
    .uploadToSignedUrl(params.path, params.token, params.file, {
      contentType: params.file.type,
      upsert: false,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function createUploadIntent(context: MediaContext, mediaKind: MediaKind, compressed: PetmanagerCompressedImage) {
  return fetchApiJsonWithAuth<UploadIntentResponse>("/api/owner/media/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      originalFileName: compressed.file.name,
      contentType: compressed.file.type,
      byteSize: compressed.file.size,
      sourceByteSize: compressed.sourceByteSize,
      width: compressed.width,
      height: compressed.height,
      mediaKind,
      visibility: "customer_shared",
      retentionPolicy: "standard",
      uploadedFrom: "owner_web",
      guardianId: context.guardianId ?? null,
      petId: context.petId ?? null,
      appointmentId: context.appointmentId ?? null,
      groomingRecordId: context.groomingRecordId ?? null,
    }),
  });
}

async function completeUpload(context: MediaContext, mediaAssetId: string, compressed: PetmanagerCompressedImage) {
  return fetchApiJsonWithAuth<CompleteUploadResponse>("/api/owner/media/complete", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      mediaAssetId,
      byteSize: compressed.file.size,
      width: compressed.width,
      height: compressed.height,
    }),
  });
}

async function createProviderReadyVariant(context: MediaContext, mediaAssetId: string, sourceFile: File) {
  const [variant] = await compressImageVariantsForPetmanager(sourceFile, ["provider_ready"]);
  if (!variant) return null;

  const intent = await fetchApiJsonWithAuth<VariantUploadIntentResponse>("/api/owner/media/variants/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      mediaAssetId,
      variantKey: variant.variantKey,
      contentType: variant.file.type,
      byteSize: variant.file.size,
      width: variant.width,
      height: variant.height,
    }),
  });

  await uploadCompressedFile({
    bucket: intent.upload.bucket,
    path: intent.upload.path,
    token: intent.upload.token,
    file: variant.file,
  });

  return fetchApiJsonWithAuth<VariantCompleteResponse>("/api/owner/media/variants/complete", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      mediaAssetId,
      variantKey: variant.variantKey,
      contentType: variant.file.type,
      byteSize: variant.file.size,
      width: variant.width,
      height: variant.height,
    }),
  });
}

export function OwnerMediaUploadPanel({ context }: { context: MediaContext }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<UploadSlot | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot["key"] | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<UploadMessageTone>("info");
  const [sendRequests, setSendRequests] = useState<PhotoSendRequestItem[]>([]);
  const [localPreviews, setLocalPreviews] = useState<Record<UploadSlot["key"], string | null>>({
    before: null,
    after: null,
  });
  const localPreviewUrlsRef = useRef(localPreviews);

  const previewsBySlot = useMemo(
    () =>
      Object.fromEntries(
        uploadSlots.map((slot) => [slot.key, getLatestByKind(items, slot.mediaKind)]),
      ) as Record<UploadSlot["key"], PreviewItem | null>,
    [items],
  );

  async function loadMediaAssets({ clearMessage = true }: { clearMessage?: boolean } = {}) {
    setLoading(true);
    if (clearMessage) {
      setMessage("");
      setMessageTone("info");
    }
    try {
      const list = await fetchApiJsonWithAuth<MediaAssetListResponse>(
        `/api/owner/media/assets?${buildQuery(context).toString()}`,
      );
      const visibleItems = list.items.filter((item) =>
        uploadSlots.some((slot) => slot.mediaKind === item.mediaAsset.media_kind),
      );
      const previews = await Promise.all(
        visibleItems.map(async (item) => {
          const signed = await fetchApiJsonWithAuth<SignedUrlResponse>(
            `/api/owner/media/signed-url?shopId=${encodeURIComponent(context.shopId)}&mediaAssetId=${encodeURIComponent(
              item.mediaAsset.id,
            )}&variant=provider_ready`,
          );
          return {
            mediaAsset: item.mediaAsset,
            signedUrl: signed.signedUrl,
          };
        }),
      );
      setItems(previews);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "사진을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPhotoSendRequests() {
    try {
      const list = await fetchApiJsonWithAuth<PhotoSendRequestListResponse>(
        `/api/owner/media/send-requests?${buildQuery(context).toString()}`,
      );
      setSendRequests(list.items);
    } catch {
      setSendRequests([]);
    }
  }

  useEffect(() => {
    void loadMediaAssets();
    void loadPhotoSendRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.shopId, context.guardianId, context.petId, context.appointmentId, context.groomingRecordId]);

  useEffect(() => {
    return () => {
      Object.values(localPreviewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  function openPicker(slot: UploadSlot) {
    setSelectedSlot(slot);
    inputRef.current?.click();
  }

  async function handleSelectedFile(file: File | null) {
    if (!file || !selectedSlot) return;

    const activeSlot = selectedSlot;
    const localPreviewUrl = URL.createObjectURL(file);
    setLocalPreviews((current) => {
      const previousUrl = current[activeSlot.key];
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const next = { ...current, [activeSlot.key]: localPreviewUrl };
      localPreviewUrlsRef.current = next;
      return next;
    });
    setUploadingSlot(activeSlot.key);
    setMessageTone("info");
    setMessage("사진을 압축하고 있어요.");

    try {
      const compressed = await compressImageForPetmanager(file);
      setMessage("사진을 업로드하고 있어요.");
      const intent = await createUploadIntent(context, activeSlot.mediaKind, compressed);

      await uploadCompressedFile({
        bucket: intent.upload.bucket,
        path: intent.upload.path,
        token: intent.upload.token,
        file: compressed.file,
      });

      setMessage("사진을 저장하고 있어요.");
      const completed = await completeUpload(context, intent.mediaAsset.id, compressed);
      setItems((current) => [
        {
          mediaAsset: completed.mediaAsset,
          signedUrl: localPreviewUrl,
        },
        ...current.filter((item) => item.mediaAsset.media_kind !== activeSlot.mediaKind),
      ]);
      setMessageTone("success");
      setMessage("사진이 저장됐습니다.");

      void createProviderReadyVariant(context, intent.mediaAsset.id, file)
        .then(() => loadMediaAssets({ clearMessage: false }))
        .catch(() => {
          setMessageTone("success");
          setMessage("사진은 저장됐습니다. 알림톡용 이미지는 다시 열 때 자동 확인됩니다.");
        });
    } catch (error) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviews((current) => {
        const next = { ...current, [activeSlot.key]: null };
        localPreviewUrlsRef.current = next;
        return next;
      });
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "사진 저장 중 문제가 발생했습니다.");
    } finally {
      setUploadingSlot(null);
      setSelectedSlot(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function sendPhotoAlimtalk() {
    const mediaAssetIds = uploadSlots
      .filter((slot) => slot.key === "after")
      .map((slot) => previewsBySlot[slot.key]?.mediaAsset.id)
      .filter((id): id is string => Boolean(id));

    if (!mediaAssetIds.length) {
      setMessage("먼저 완료 사진을 저장해 주세요.");
      return;
    }

    if (!context.guardianId || !context.petId) {
      setMessage("고객 정보가 연결된 예약이나 기록에서만 보낼 수 있습니다.");
      return;
    }

    setSending(true);
    setMessageTone("info");
    setMessage("사진 알림톡을 준비하고 있어요.");
    try {
      const notification = await fetchApiJsonWithAuth<{ status?: string; fail_reason?: string | null }>("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          shopId: context.shopId,
          guardianId: context.guardianId,
          petId: context.petId,
          appointmentId: context.appointmentId ?? null,
          type: "grooming_completed",
          channel: "alimtalk",
          mediaAssetIds,
          message: "미용 사진을 보내드려요. 확인해 주세요.",
          metadata: {
            source: "owner_photo_send_request",
            mediaDeliveryMode: "manual_request",
          },
        }),
      });
      setMessageTone(notification.status === "sent" ? "success" : "info");
      setMessage(
        notification.status === "sent"
          ? "완료 사진 알림톡을 발송했습니다."
          : notification.fail_reason || "완료 사진 전송 요청이 저장됐습니다. 템플릿 승인 후 실제 발송됩니다.",
      );
      void loadPhotoSendRequests();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "사진 알림톡 요청 중 문제가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  const latestPhotoSendRequest =
    sendRequests.find((request) => !isAlimtalkCreditEmptyReason(request.notification.fail_reason)) ?? null;

  return (
    <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#334155]">사진</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMediaAssets()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
          aria-label="사진 새로고침"
        >
          <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleSelectedFile(event.target.files?.[0] ?? null)}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        {uploadSlots.map((slot) => {
          const uploading = uploadingSlot === slot.key;
          const storedPreview = previewsBySlot[slot.key];
          const previewUrl = localPreviews[slot.key] ?? storedPreview?.signedUrl ?? null;
          const preview = storedPreview ?? (previewUrl ? ({ signedUrl: previewUrl } as PreviewItem) : null);

          return (
            <button
              key={slot.key}
              type="button"
              onClick={() => openPicker(slot)}
              disabled={Boolean(uploadingSlot)}
              className={cn(
                "group relative flex aspect-[1.08] min-h-[124px] overflow-hidden rounded-[8px] border text-left transition disabled:cursor-wait disabled:opacity-75",
                previewUrl
                  ? "border-[#cfd8e3] bg-[#f8fafc] hover:border-[#7ba99b]"
                  : "border-dashed border-[#cfd8e3] bg-[#f8fafc] hover:border-[#7ba99b] hover:bg-[#f3fbf8]",
              )}
            >
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt={`${slot.label} 사진`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-2 pb-2 pt-8">
                    <span className="rounded-[5px] bg-white/95 px-2 py-1 text-[12px] font-semibold text-[#111827]">{slot.label}</span>
                    <span className="rounded-[5px] bg-white/90 px-2 py-1 text-[11px] font-medium text-[#334155]">변경</span>
                  </span>
                </>
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center text-[13px] font-medium text-[#334155]">
                  {uploading ? <Loader2 className="mb-1.5 h-5 w-5 animate-spin" /> : <BasilIcon name="picture" className="mb-1.5 h-5 w-5" />}
                  {slot.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void sendPhotoAlimtalk()}
        disabled={sending || Boolean(uploadingSlot)}
        className="mt-3 h-10 w-full rounded-[8px] bg-[var(--accent)] text-[14px] font-semibold text-white transition hover:bg-[#236b5b] disabled:cursor-wait disabled:bg-[#9fbfb5]"
      >
        {sending ? "전송 요청 저장 중" : "완료 사진 전송 요청 저장"}
      </button>

      {message ? (
        <div
          className={cn(
            "mt-3 flex items-start justify-between gap-3 rounded-[8px] px-3 py-2.5 text-[13px] leading-5",
            messageTone === "success" && "border border-[#bfe3d6] bg-[#eefaf5] font-semibold text-[#176957]",
            messageTone === "error" && "border border-[#f4d4d4] bg-[#fff5f5] text-[#b42318]",
            messageTone === "info" && "bg-[#f8fafc] text-[#64748b]",
          )}
        >
          <span className="flex items-start gap-2">
            {messageTone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <span>{message}</span>
          </span>
          <button type="button" onClick={() => setMessage("")} className="mt-0.5 text-[#94a3b8] hover:text-[#334155]" aria-label="메시지 닫기">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {latestPhotoSendRequest ? (
        <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="font-semibold text-[#334155]">
              {getPhotoSendStatusCopy(
                latestPhotoSendRequest.notification.status,
                latestPhotoSendRequest.notification.fail_reason,
              )}
            </span>
            <span className="shrink-0 text-[#64748b]">{latestPhotoSendRequest.attachmentCount}장</span>
          </div>
          <p className="mt-1 text-[12px] leading-4 text-[#64748b]">
            {latestPhotoSendRequest.notification.status === "queued"
              ? "쏘다/카카오 템플릿 승인 후 실제 발송 단계로 전환합니다."
              : "최근 완료 사진 전송 상태입니다."}
          </p>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[#94a3b8]">
          <Camera className="h-4 w-4" />
          저장된 사진이 없습니다.
        </div>
      ) : null}
    </section>
  );
}
