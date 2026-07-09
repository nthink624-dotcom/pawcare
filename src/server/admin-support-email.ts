import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";
import type { OwnerSupportRequestItem } from "@/server/owner-support-requests";

type ResendEmailResponse = {
  id?: string;
  message?: string;
};

function readRecipientEmails() {
  const raw = process.env.ADMIN_SUPPORT_NOTIFICATION_EMAILS ?? process.env.ADMIN_SUPPORT_NOTIFICATION_EMAIL ?? LEGAL_BUSINESS_INFO.customerServiceEmail;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripHtml(value: string) {
  return value.replace(/[<>&]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      default:
        return char;
    }
  });
}

function buildAdminSupportEmailHtml(request: OwnerSupportRequestItem) {
  const message = stripHtml(request.message).replace(/\n/g, "<br />");
  const ownerName = request.ownerName || "-";
  const contact = request.contact || request.ownerPhone || request.ownerEmail || "-";
  const shopName = request.shopName ?? request.shopId;

  return `
    <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#172033;line-height:1.6">
      <h2 style="margin:0 0 12px;font-size:20px">새 오너 문의가 접수되었습니다</h2>
      <p style="margin:0 0 16px;color:#64748b">관리자 페이지에서 답변을 남겨주세요.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>
          <tr><td style="padding:8px;border-top:1px solid #e5edf5;color:#64748b;width:120px">매장</td><td style="padding:8px;border-top:1px solid #e5edf5">${stripHtml(shopName)}</td></tr>
          <tr><td style="padding:8px;border-top:1px solid #e5edf5;color:#64748b">오너</td><td style="padding:8px;border-top:1px solid #e5edf5">${stripHtml(ownerName)}</td></tr>
          <tr><td style="padding:8px;border-top:1px solid #e5edf5;color:#64748b">연락처</td><td style="padding:8px;border-top:1px solid #e5edf5">${stripHtml(contact)}</td></tr>
          <tr><td style="padding:8px;border-top:1px solid #e5edf5;color:#64748b">제목</td><td style="padding:8px;border-top:1px solid #e5edf5">${stripHtml(request.title)}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:16px;padding:14px;border:1px solid #e5edf5;border-radius:10px;background:#f8fbff">
        ${message}
      </div>
      <p style="margin-top:18px">
        <a href="https://www.petmanager.co.kr/admin" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#2563eb;color:white;text-decoration:none;font-weight:700">관리자 페이지 열기</a>
      </p>
    </div>
  `;
}

export async function notifyAdminOwnerSupportRequest(request: OwnerSupportRequestItem) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipients = readRecipientEmails();
  const from = process.env.ADMIN_SUPPORT_NOTIFICATION_FROM?.trim() || "PetManager <onboarding@resend.dev>";

  if (!apiKey || recipients.length === 0) {
    console.warn("[admin-support-email] skipped: missing RESEND_API_KEY or recipient email");
    return { sent: false, reason: "missing_email_env" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[넘친데이] 새 오너 문의 · ${request.shopName ?? request.shopId}`,
      html: buildAdminSupportEmailHtml(request),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ResendEmailResponse | null;
    console.error("[admin-support-email] failed", response.status, body?.message ?? response.statusText);
    return { sent: false, reason: "provider_failed" as const };
  }

  return { sent: true as const };
}
