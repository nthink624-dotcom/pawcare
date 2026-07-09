export type HelpCategory = "how_to_use" | "bug" | "payment" | "feature_request" | "account" | "notification" | "other";
export type HelpStatus = "open" | "reviewing" | "answered" | "resolved" | "closed";

export type OwnerSupportMessageItem = {
  id: string;
  senderType: "owner" | "admin" | "system";
  senderName: string | null;
  message: string;
  isAnswer: boolean;
  createdAt: string;
};

export type OwnerSupportAttachmentItem = {
  id: string;
  requestId: string;
  messageId: string | null;
  mediaAssetId: string | null;
  fileUrl: string;
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  uploadedByType: "owner" | "admin";
  uploadedById: string | null;
  createdAt: string;
};

export type OwnerSupportRequestItem = {
  id: string;
  category: HelpCategory;
  status: HelpStatus;
  title: string;
  message: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  ownerLastReadAt: string | null;
  messages: OwnerSupportMessageItem[];
  attachments: OwnerSupportAttachmentItem[];
};

export const categoryLabels: Record<HelpCategory, string> = {
  how_to_use: "사용법 문의",
  bug: "오류 제보",
  payment: "결제 문의",
  feature_request: "기능 요청",
  account: "계정/매장",
  notification: "알림 문의",
  other: "기타",
};

export const statusLabels: Record<HelpStatus, string> = {
  open: "접수됨",
  reviewing: "확인중",
  answered: "답변완료",
  resolved: "답변완료",
  closed: "종료",
};

export function isUnreadAnsweredRequest(request: OwnerSupportRequestItem) {
  if (request.status !== "answered" && request.status !== "resolved") return false;
  if (!request.answeredAt) return false;
  if (!request.ownerLastReadAt) return true;
  return new Date(request.ownerLastReadAt).getTime() < new Date(request.answeredAt).getTime();
}
