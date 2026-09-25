"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import type { ProfitabilityPayload, ServiceDurationRecommendation } from "@/types/profitability";

type RecommendationLoadState = {
  status: "loading" | "ready" | "error";
  items: ServiceDurationRecommendation[];
};

export default function ServiceDurationRecommendationPanel({
  shopId,
  serviceIds,
  demoMode = false,
}: {
  shopId: string;
  serviceIds: string[];
  demoMode?: boolean;
}) {
  const [loadState, setLoadState] = useState<RecommendationLoadState>({ status: "loading", items: [] });

  useEffect(() => {
    if (demoMode || !shopId) return;
    let active = true;

    void fetchApiJsonWithAuth<ProfitabilityPayload>(
      `/api/owner/profitability?shopId=${encodeURIComponent(shopId)}&range=365d`,
      { cache: "no-store" },
    )
      .then((payload) => {
        if (active) setLoadState({ status: "ready", items: payload.durationRecommendations ?? [] });
      })
      .catch(() => {
        if (active) setLoadState({ status: "error", items: [] });
      });

    return () => {
      active = false;
    };
  }, [demoMode, shopId]);

  const currentServiceIds = useMemo(() => new Set(serviceIds), [serviceIds]);
  const recommendations = loadState.items.filter((item) => currentServiceIds.has(item.serviceId));
  const status = demoMode ? "ready" : loadState.status;

  return (
    <section
      className="rounded-[12px] border border-[#dbe2ea] bg-white px-4 py-3.5"
      data-testid="service-duration-recommendations"
    >
      <p className="text-[15px] font-semibold text-[#334155]">서비스 시간 추천</p>
      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
        초기 평균 시간을 정해 주세요. 실제 완료 기록이 쌓이면 평균을 자동 계산해 추천해 드려요.
      </p>

      <div className="mt-3" aria-live="polite">
        {status === "loading" ? (
          <p className="text-[13px] leading-5 text-[#64748b]">완료 기록에서 추천 시간을 계산하고 있습니다.</p>
        ) : status === "error" ? (
          <p className="text-[13px] leading-5 text-[#a04455]">
            실제 평균 추천을 불러오지 못했습니다. 현재 설정 시간은 변경되지 않았습니다.
          </p>
        ) : recommendations.length === 0 ? (
          <p className="text-[13px] leading-5 text-[#64748b]">
            같은 서비스와 체중의 유효한 완료 기록이 3건 이상 쌓이면 추천이 표시됩니다.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation.key}
                className="rounded-[8px] border border-[#e7ebf0] bg-[#fbfcfd] px-3 py-2.5"
              >
                <p className="text-[13px] font-medium text-[#334155]">
                  {recommendation.serviceName} · {recommendation.weightLabel}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                  실제 평균 <span className="font-semibold text-[#2563eb]">{recommendation.observedAverageMinutes}분</span>
                  {" · "}완료 {recommendation.sampleCount}건
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
