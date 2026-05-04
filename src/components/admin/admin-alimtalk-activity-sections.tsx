"use client";

import type { AdminNotificationActivity } from "@/server/admin-alimtalk";

function statusTone(status: string) {
  switch (status) {
    case "sent":
      return "border-[#d8e7e1] bg-[#f5fbf8] text-[#2f7266]";
    case "failed":
      return "border-[#efd4d4] bg-[#fff7f7] text-[#b54b4b]";
    case "skipped":
      return "border-[#ece6dc] bg-[#fcfaf7] text-[#8a6f4a]";
    default:
      return "border-[#e6e3dd] bg-white text-[#6f665f]";
  }
}

export default function AdminAlimtalkActivitySections({
  notificationActivity,
}: {
  notificationActivity: AdminNotificationActivity;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">최근 알림 이슈</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">실패나 스킵이 난 최근 건</h2>
          <p className="text-[13px] leading-6 text-[#6f665f]">
            템플릿 상태, 고객 수신 설정, relay 전달 문제는 여기서 가장 먼저 확인할 수 있어요.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {notificationActivity.issues.length ? (
            notificationActivity.issues.map((item) => (
              <div key={item.id} className="rounded-[6px] border border-[#e6e3dd] bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#171411]">
                      {item.title} · {item.shopName}
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                      {item.guardianName || "고객 미상"}
                      {item.petName ? ` · ${item.petName}` : ""}
                      {item.recipientPhoneTail ? ` · ****${item.recipientPhoneTail}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-[999px] border px-2.5 py-1 text-[11px] font-medium ${statusTone(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[#7a7268]">
                  {item.failReason || "실패 사유가 남지 않았습니다."}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[6px] border border-[#e6e3dd] bg-white px-4 py-5 text-[13px] leading-6 text-[#7a7268]">
              최근 실패나 스킵 이슈가 없습니다.
            </div>
          )}
        </div>
      </article>

      <article className="rounded-[8px] border border-[#e6e3dd] bg-white p-6 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">최근 발송 이벤트</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">관리자에서 바로 보는 최근 알림 흐름</h2>
          <p className="text-[13px] leading-6 text-[#6f665f]">
            어떤 타입이 실제로 많이 나가는지, 특정 타입만 계속 실패하는지 한 번에 볼 수 있어요.
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-[6px] border border-[#e6e3dd] bg-white">
          {notificationActivity.recentEvents.length ? (
            notificationActivity.recentEvents.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 px-4 py-3 ${
                  index !== notificationActivity.recentEvents.length - 1 ? "border-b border-[#f0ece6]" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#171411]">
                    {item.title} · {item.shopName}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#6f665f]">
                    {item.guardianName || "고객 미상"}
                    {item.petName ? ` · ${item.petName}` : ""}
                    {item.recipientPhoneTail ? ` · ****${item.recipientPhoneTail}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#8a8277]">
                    {item.createdAt}
                    {item.providerMessageId ? ` · ${item.providerMessageId}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-[999px] border px-2.5 py-1 text-[11px] font-medium ${statusTone(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-[13px] leading-6 text-[#7a7268]">최근 알림 이벤트가 없습니다.</div>
          )}
        </div>
      </article>
    </section>
  );
}
