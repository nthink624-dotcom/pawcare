"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import type { AlimtalkSenderMode, AlimtalkShopChannelStatus } from "@/types/domain";

type ShopChannelRequest = {
  shopId: string;
  shopName: string;
  senderMode: AlimtalkSenderMode;
  status: AlimtalkShopChannelStatus;
  channelName: string;
  channelUrl: string;
  senderProfileKey: string;
  requestedAt: string | null;
  adminNote: string;
  templateRequestNote: string;
  templateRequestUpdatedAt: string | null;
};

type ShopChannelResponse = {
  ok: true;
  requests: ShopChannelRequest[];
};

type ShopChannelUpdateResponse = {
  ok: true;
  request: ShopChannelRequest;
};

const statusLabels: Record<AlimtalkShopChannelStatus, string> = {
  not_requested: "신청 전",
  requested: "신청 접수",
  reviewing: "심사 중",
  active: "사용 가능",
  rejected: "보완 필요",
};

function formatRequestedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminAlimtalkShopChannelPanel() {
  const [requests, setRequests] = useState<ShopChannelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const response = await fetchApiJson<ShopChannelResponse>("/api/admin/alimtalk/shop-channels", {
        cache: "no-store",
      });
      setRequests(response.requests);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "매장 채널 신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function updateRequest(
    request: ShopChannelRequest,
    patch: Partial<Pick<ShopChannelRequest, "status" | "senderProfileKey" | "adminNote">>,
  ) {
    const nextRequest = { ...request, ...patch };
    setSavingShopId(request.shopId);
    try {
      const response = await fetchApiJson<ShopChannelUpdateResponse>("/api/admin/alimtalk/shop-channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: nextRequest.shopId,
          status: nextRequest.status,
          senderProfileKey: nextRequest.senderProfileKey,
          adminNote: nextRequest.adminNote,
        }),
      });
      setRequests((current) =>
        current.map((item) => (item.shopId === response.request.shopId ? response.request : item)),
      );
      setMessage(`${response.request.shopName} 채널 상태를 저장했습니다.`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "매장 채널 상태 저장에 실패했습니다.");
      setMessage(null);
    } finally {
      setSavingShopId(null);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold tracking-[0.04em] text-[#8a8277]">매장 채널</p>
          <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#171411]">
            오너 카카오 채널 신청 관리
          </h3>
          <p className="mt-2 text-[14px] leading-6 text-[#6f665f]">
            사용 가능 상태와 Sender Key가 있어야 실제 알림톡 발신 채널이 매장 채널로 전환됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-4 text-[14px] font-semibold text-[#5c554d] disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-[6px] border border-[#cbe4dc] bg-[#f4faf8] px-4 py-3 text-[14px] text-[#1f6b5b]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] text-[#b54b4b]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[16px] text-[#7a7268]">
          신청 목록을 불러오는 중입니다.
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-5 rounded-[6px] border border-[#e6e3dd] bg-white px-5 py-6 text-[16px] text-[#7a7268]">
          아직 매장 채널 신청이 없습니다.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {requests.map((request) => (
            <article key={request.shopId} className="rounded-[8px] border border-[#e6e3dd] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-[17px] font-semibold text-[#171411]">{request.shopName}</h4>
                  <p className="mt-1 text-[14px] leading-6 text-[#6f665f]">
                    채널명 {request.channelName || "-"} · 신청 {formatRequestedAt(request.requestedAt)}
                  </p>
                  {request.channelUrl ? (
                    <p className="break-all text-[14px] leading-6 text-[#6f665f]">채널 URL {request.channelUrl}</p>
                  ) : null}
                  {request.templateRequestNote ? (
                    <div className="mt-3 rounded-[8px] border border-[#e6e3dd] bg-[#faf9f7] px-3 py-2">
                      <p className="text-[13px] font-semibold text-[#8a8277]">오너 희망 알림톡 문구 / 요청사항</p>
                      <p className="mt-1 whitespace-pre-line text-[14px] leading-6 text-[#4f463f]">{request.templateRequestNote}</p>
                      {request.templateRequestUpdatedAt ? (
                        <p className="mt-1 text-[12px] text-[#8a8277]">수정 {formatRequestedAt(request.templateRequestUpdatedAt)}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[14px] text-[#526170]">
                  {statusLabels[request.status]}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-[#8a8277]">상태</span>
                  <select
                    value={request.status}
                    onChange={(event) =>
                      updateRequest(request, {
                        status: event.target.value as AlimtalkShopChannelStatus,
                      })
                    }
                    disabled={savingShopId === request.shopId}
                    className="h-10 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-[#8a8277]">Sender Key</span>
                  <input
                    value={request.senderProfileKey}
                    onChange={(event) =>
                      setRequests((current) =>
                        current.map((item) =>
                          item.shopId === request.shopId ? { ...item, senderProfileKey: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-10 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                    placeholder="쏘다 발신 프로필 Sender Key"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-[#8a8277]">관리 메모</span>
                  <input
                    value={request.adminNote}
                    onChange={(event) =>
                      setRequests((current) =>
                        current.map((item) =>
                          item.shopId === request.shopId ? { ...item, adminNote: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-10 w-full rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[15px] text-[#171411] outline-none focus:border-[#1f6b5b]"
                    placeholder="심사/보완 메모"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void updateRequest(request, {})}
                  disabled={savingShopId === request.shopId}
                  className="mt-auto inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  저장
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
