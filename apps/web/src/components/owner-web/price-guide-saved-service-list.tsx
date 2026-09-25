"use client";

import { PencilLine } from "lucide-react";

export type SavedPriceGuideServiceSummary = {
  id: string;
  name: string;
  price: string;
  duration: string;
};

export default function PriceGuideSavedServiceList({
  services,
  onEdit,
}: {
  services: SavedPriceGuideServiceSummary[];
  onEdit: (serviceId: string) => void;
}) {
  return (
    <section aria-labelledby="saved-price-guide-services-title" className="min-w-0">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 id="saved-price-guide-services-title" className="text-[18px] font-semibold leading-[26px] text-[#172033]">
            저장된 서비스
          </h3>
          <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">
            수정할 서비스를 선택하면 상세 요금표가 바로 열립니다.
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-medium leading-[18px] text-[#64748b]">
          {services.length}개
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_56px_68px] items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-[12px] font-medium leading-[18px] text-[#64748b] sm:grid-cols-[minmax(0,1.4fr)_minmax(100px,1fr)_minmax(80px,0.7fr)_72px] sm:px-4">
          <span>서비스명</span>
          <span className="text-right">가격</span>
          <span className="text-right">시간</span>
          <span className="text-center">관리</span>
        </div>
        <ul className="divide-y divide-[#edf2f7]">
          {services.map((service) => (
            <li
              key={service.id}
              className="grid min-h-16 grid-cols-[minmax(0,1fr)_80px_56px_68px] items-center gap-2 px-3 py-2 text-[14px] leading-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(100px,1fr)_minmax(80px,0.7fr)_72px] sm:px-4"
            >
              <span className="min-w-0 truncate font-medium text-[#172033]" title={service.name}>
                {service.name}
              </span>
              <span className="whitespace-nowrap text-right tabular-nums text-[#334155]">{service.price || "-"}</span>
              <span className="whitespace-nowrap text-right tabular-nums text-[#64748b]">{service.duration || "-"}</span>
              <button
                type="button"
                onClick={() => onEdit(service.id)}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[8px] border border-[#cbd5e1] bg-white px-2 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                aria-label={`${service.name} 상세 요금표 수정`}
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                <span>수정</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
