import { notFound } from "next/navigation";

import AdminTesterFeedbackScreen from "@/components/admin/admin-tester-feedback-screen";
import type { TesterFeedbackItem } from "@/lib/tester-feedback";

const FIXTURE: TesterFeedbackItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    shopId: "fixture-shop-one",
    shopName: "검수 매장 하나",
    category: "bug",
    body: "예약 시간을 바꾼 뒤 목록에 이전 시간이 잠깐 남아 있습니다.",
    screenKey: "schedule",
    appVersion: "1.0.0-dev",
    status: "new",
    tester: {
      schemaReady: true,
      isTester: true,
      cohortStatus: "active",
      displayState: "awaiting_owner_decision",
      reviewDueAt: "2026-09-08T00:00:00.000Z",
      noticeKey: "tester-review:1:2026-09-08:d+0",
      noticeLabel: "테스트 기간이 끝났습니다. 종료·연장·전환을 결정해 주세요.",
    },
    screenshot: {
      attached: true,
      contentType: "image/png",
      byteSize: 248000,
      consentedAt: "2026-09-08T01:29:00.000Z",
      receiptFingerprint: "a".repeat(64),
      deletedAt: null,
    },
    createdAt: "2026-09-08T01:30:00.000Z",
    updatedAt: "2026-09-08T01:30:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    shopId: "fixture-shop-two",
    shopName: "검수 매장 둘",
    category: "improvement",
    body: "직원 근무시간을 복사해서 다음 주에 적용할 수 있으면 좋겠습니다.",
    screenKey: "staff",
    appVersion: "1.0.0-dev",
    status: "reviewing",
    tester: {
      schemaReady: true,
      isTester: false,
      cohortStatus: null,
      displayState: null,
      reviewDueAt: null,
      noticeKey: null,
      noticeLabel: null,
    },
    screenshot: {
      attached: false,
      contentType: null,
      byteSize: null,
      consentedAt: null,
      receiptFingerprint: null,
      deletedAt: null,
    },
    createdAt: "2026-09-07T23:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  },
];

export default function TesterFeedbackInboxPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AdminTesterFeedbackScreen initialFeedback={FIXTURE} />;
}
