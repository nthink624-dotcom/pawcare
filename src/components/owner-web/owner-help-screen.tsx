"use client";

import {
  Bell,
  Bug,
  HelpCircle,
  Lightbulb,
  MessageSquareText,
  Send,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import OwnerSupportAttachmentPicker, {
  type SelectedSupportAttachment,
} from "@/components/owner-web/owner-support-attachment-picker";
import OwnerSupportHistoryPanel from "@/components/owner-web/owner-support-history-panel";
import {
  categoryLabels,
  isUnreadAnsweredRequest,
  type HelpCategory,
  type OwnerSupportRequestItem,
} from "@/components/owner-web/owner-support-model";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import type { BootstrapPayload } from "@/types/domain";

const requestCategories: Array<{
  key: HelpCategory;
  label: string;
  description: string;
  exampleTitle: string;
  icon: typeof Bug;
}> = [
  {
    key: "how_to_use",
    label: "사용법 문의",
    description: "기능 위치, 설정 방법, 운영 흐름이 헷갈릴 때",
    exampleTitle: "사용법을 확인하고 싶어요",
    icon: MessageSquareText,
  },
  {
    key: "bug",
    label: "오류 신고",
    description: "저장 실패, 화면 깨짐, 예상과 다른 동작",
    exampleTitle: "오류가 발생했어요",
    icon: Bug,
  },
  {
    key: "feature_request",
    label: "기능 제안",
    description: "새 기능, 개선 요청, 불편한 운영 흐름",
    exampleTitle: "기능 개선을 제안하고 싶어요",
    icon: Lightbulb,
  },
  {
    key: "account",
    label: "계정/매장",
    description: "로그인, 사업자, 매장 정보, 권한 문제",
    exampleTitle: "계정 또는 매장 정보 문의입니다",
    icon: UserCog,
  },
  {
    key: "notification",
    label: "알림톡",
    description: "알림톡 발송, 잔여건수, 고객 안내 메시지",
    exampleTitle: "알림톡 문의가 있어요",
    icon: Bell,
  },
  {
    key: "other",
    label: "기타",
    description: "위 유형에 맞지 않는 일반 문의",
    exampleTitle: "기타 문의입니다",
    icon: HelpCircle,
  },
];

function buildStorageKey(shopId: string) {
  return `petmanager.ownerHelpDraft.${shopId}`;
}

function isVisibleRequestCategory(value: unknown): value is HelpCategory {
  return typeof value === "string" && requestCategories.some((item) => item.key === value);
}

function readSavedHelpDraft(storageKey: string) {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<{
      category: HelpCategory;
      title: string;
      message: string;
      contact: string;
    }>;

    return {
      category: isVisibleRequestCategory(parsed.category) ? parsed.category : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      message: typeof parsed.message === "string" ? parsed.message : null,
      contact: typeof parsed.contact === "string" ? parsed.contact : null,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function getSupportRequestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("다른 매장 데이터")) {
    return "현재 로그인된 오너 계정의 문의 내역만 확인할 수 있습니다. 매장 계정이 맞는지 확인해 주세요.";
  }
  return message || "문의 내역을 불러오지 못했습니다.";
}

function buildSystemContext(shop: BootstrapPayload["shop"], category: HelpCategory) {
  const lines = [
    `문의 유형: ${categoryLabels[category]}`,
    `매장명: ${shop.name || "-"}`,
    `매장 ID: ${shop.id}`,
    typeof window !== "undefined" ? `현재 경로: ${window.location.pathname}` : null,
    typeof window !== "undefined" ? `현재 주소: ${window.location.href}` : null,
    typeof window !== "undefined" ? `브라우저: ${window.navigator.userAgent}` : null,
    `작성 시각: ${new Date().toLocaleString("ko-KR")}`,
  ];

  return lines.filter(Boolean).join("\n");
}

export default function OwnerHelpScreen({ initialData }: { initialData: BootstrapPayload }) {
  const shop = initialData.shop;
  const contactSectionRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => buildStorageKey(shop.id), [shop.id]);
  const savedDraft = useMemo(() => readSavedHelpDraft(storageKey), [storageKey]);
  const [category, setCategory] = useState<HelpCategory>(() => savedDraft?.category ?? "how_to_use");
  const [title, setTitle] = useState(() => savedDraft?.title ?? "");
  const [message, setMessage] = useState(() => savedDraft?.message ?? "");
  const [contact, setContact] = useState(() => savedDraft?.contact ?? initialData.ownerProfile?.phone_number ?? shop.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedSupportAttachment[]>([]);
  const [requests, setRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const systemContext = useMemo(() => buildSystemContext(shop, category), [category, shop]);
  const unreadAnswerCount = requests.filter(isUnreadAnsweredRequest).length;

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        category,
        title,
        message,
        contact,
      }),
    );
  }, [category, contact, message, storageKey, title]);

  useEffect(() => {
    void loadRequests();
  }, [shop.id]);

  async function loadRequests() {
    setLoadingRequests(true);
    setRequestsError("");
    try {
      const response = await fetchApiJsonWithAuth<{ requests: OwnerSupportRequestItem[] }>(
        `/api/owner/support-requests?shopId=${encodeURIComponent(shop.id)}&limit=20`,
        { cache: "no-store" },
      );
      setRequests(response.requests);
    } catch (error) {
      setRequestsError(getSupportRequestErrorMessage(error));
    } finally {
      setLoadingRequests(false);
    }
  }

  async function markAsRead(requestId: string) {
    setRequests((current) =>
      current.map((item) => (item.id === requestId ? { ...item, ownerLastReadAt: new Date().toISOString() } : item)),
    );
    try {
      await fetchApiJsonWithAuth<{ success: true }>("/api/owner/support-requests", {
        method: "PATCH",
        body: JSON.stringify({ shopId: shop.id, requestId }),
      });
    } catch {
      void loadRequests();
    }
  }

  function handleAttachmentChange(files: FileList | null) {
    setAttachmentError("");
    if (!files) return;

    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const nextFiles = Array.from(files).filter((file) => acceptedTypes.has(file.type));
    if (nextFiles.length !== files.length) {
      setAttachmentError("jpg, png, webp 이미지만 첨부할 수 있습니다.");
    }

    setSelectedAttachments((current) => {
      const merged = [
        ...current,
        ...nextFiles.map((file) => ({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ].slice(0, 3);
      if (current.length + nextFiles.length > 3) {
        setAttachmentError("이미지는 최대 3장까지 첨부할 수 있습니다.");
      }
      return merged;
    });
  }

  function removeAttachment(id: string) {
    setSelectedAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  async function submitRequest() {
    if (submitting) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setSubmitError("문의 내용을 입력해 주세요.");
      setSubmitMessage("");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");
    try {
      const attachments = await Promise.all(
        selectedAttachments.map(async (attachment) => {
          const uploaded = await createOwnerMediaAssetFromFile({ shopId: shop.id }, "message_image", attachment.file);
          return {
            mediaAssetId: uploaded.mediaAsset.id,
            fileName: uploaded.mediaAsset.original_file_name ?? attachment.file.name,
            fileType: uploaded.mediaAsset.content_type,
            fileSize: uploaded.mediaAsset.byte_size,
          };
        }),
      );

      const response = await fetchApiJsonWithAuth<{ request: { id: string } }>("/api/owner/support-requests", {
        method: "POST",
        body: JSON.stringify({
          shopId: shop.id,
          category,
          title,
          contact,
          ownerName: initialData.ownerProfile?.name ?? "",
          ownerPhone: initialData.ownerProfile?.phone_number ?? contact,
          message: trimmedMessage,
          attachments,
          context: {
            shopName: shop.name,
            shopId: shop.id,
            currentPath: typeof window !== "undefined" ? window.location.pathname : "",
            currentUrl: typeof window !== "undefined" ? window.location.href : "",
            userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
            createdAt: new Date().toISOString(),
          },
        }),
      });
      const requestNumber = response.request.id.slice(0, 8).toUpperCase();
      setSubmitMessage(`문의가 접수되었습니다. 문의번호 ${requestNumber}로 확인할 수 있습니다.`);
      setTitle("");
      setMessage("");
      setSelectedAttachments((current) => {
        current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
        return [];
      });
      void loadRequests();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "문의를 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div ref={contactSectionRef}>
          <WebSurface className="p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">문의하기</h1>
              {unreadAnswerCount > 0 ? (
                <p className="mt-2 inline-flex rounded-[10px] border border-[#cfe4dc] bg-[#f8fdfb] px-3 py-2 text-[14px] font-semibold text-[#1f6b5b]">
                  새 답변 {unreadAnswerCount}건이 도착했습니다.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">문의 유형</span>
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value as HelpCategory;
                  const nextItem = requestCategories.find((item) => item.key === nextCategory);
                  setCategory(nextCategory);
                  if (nextItem && !title.trim()) setTitle(nextItem.exampleTitle);
                }}
                className="h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
              >
                {requestCategories.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
                placeholder="예: 예약 시간이 이상하게 보여요"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">연락 받을 번호 또는 메일</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
                placeholder="로그인 정보가 있으면 자동 입력됩니다"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">내용</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[220px] resize-y rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-3 text-[15px] font-medium leading-6 text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
                placeholder="어느 화면에서 어떤 문제가 있었는지 적어주세요."
              />
            </label>
            <OwnerSupportAttachmentPicker
              attachments={selectedAttachments}
              error={attachmentError}
              submitting={submitting}
              onChange={handleAttachmentChange}
              onRemove={removeAttachment}
            />
            {submitMessage ? (
              <p className="rounded-[10px] border border-[#cfe4dc] bg-[#f8fdfb] px-3 py-2 text-[14px] font-semibold text-[#1f6b5b]">
                {submitMessage}
              </p>
            ) : null}
            {submitError ? (
              <p className="rounded-[10px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[14px] font-semibold text-[#b42318]">
                {submitError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setMessage("");
                  setSelectedAttachments((current) => {
                    current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
                    return [];
                  });
                  setSubmitError("");
                  setAttachmentError("");
                  setSubmitMessage("");
                }}
                className="inline-flex h-10 items-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                비우기
              </button>
              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={submitting}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#316fe8] px-4 text-[14px] font-semibold text-white transition hover:bg-[#245bd0] disabled:bg-[#94a3b8]"
              >
                <Send className="h-4 w-4" />
                {submitting ? "업로드 중" : "접수하기"}
              </button>
            </div>
          </div>
          </WebSurface>
        </div>

        <div className="grid gap-4">
          <OwnerSupportHistoryPanel
            requests={requests}
            loading={loadingRequests}
            error={requestsError}
            onRefresh={() => void loadRequests()}
            onMarkAsRead={(requestId) => void markAsRead(requestId)}
          />
        </div>
      </div>
    </div>
  );
}
