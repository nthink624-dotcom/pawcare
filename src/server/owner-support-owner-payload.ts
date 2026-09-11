import type {
  OwnerSupportAttachmentItem,
  OwnerSupportMessageItem,
  OwnerSupportRequestItem,
} from "@/server/owner-support-requests";

export type OwnerSupportPublicAttachment = Pick<
  OwnerSupportAttachmentItem,
  | "id"
  | "fileUrl"
  | "signedUrl"
  | "fileName"
  | "fileType"
  | "fileSize"
  | "createdAt"
>;

export type OwnerSupportPublicRequest = Pick<
  OwnerSupportRequestItem,
  | "id"
  | "category"
  | "status"
  | "title"
  | "message"
  | "createdAt"
  | "updatedAt"
  | "answeredAt"
  | "ownerLastReadAt"
> & {
  attachments: OwnerSupportPublicAttachment[];
  messages: Array<Pick<OwnerSupportMessageItem, "id" | "senderType" | "senderName" | "message" | "isAnswer" | "createdAt">>;
  answer: string;
  reply: string;
  admin_reply: string;
  answered_at: string | null;
  created_at: string;
  read_at: string | null;
  owner_read_at: string | null;
};

function isOwnerVisibleMessage(message: OwnerSupportMessageItem) {
  return message.senderType === "owner" || (message.senderType === "admin" && message.isAnswer);
}

function toOwnerSupportPublicAttachment(attachment: OwnerSupportAttachmentItem): OwnerSupportPublicAttachment {
  return {
    id: attachment.id,
    fileUrl: attachment.fileUrl,
    signedUrl: attachment.signedUrl,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
    createdAt: attachment.createdAt,
  };
}

export function toOwnerSupportPublicRequest(request: OwnerSupportRequestItem): OwnerSupportPublicRequest {
  const messages = request.messages
    .filter(isOwnerVisibleMessage)
    .map(({ id, senderType, senderName, message, isAnswer, createdAt }) => ({
      id,
      senderType,
      senderName,
      message,
      isAnswer,
      createdAt,
    }));
  const answer = [...messages]
    .reverse()
    .find((message) => message.senderType === "admin" && message.isAnswer)?.message ?? "";

  return {
    id: request.id,
    category: request.category,
    status: request.status,
    title: request.title,
    message: request.message,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    answeredAt: request.answeredAt,
    ownerLastReadAt: request.ownerLastReadAt,
    messages,
    attachments: request.attachments.map(toOwnerSupportPublicAttachment),
    answer,
    reply: answer,
    admin_reply: answer,
    answered_at: request.answeredAt,
    created_at: request.createdAt,
    read_at: request.ownerLastReadAt,
    owner_read_at: request.ownerLastReadAt,
  };
}
