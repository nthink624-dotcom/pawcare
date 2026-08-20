"use client";

import { Check } from "lucide-react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { formatServicePrice } from "@/lib/utils";

export default function CustomerEntryServicePicker({
  services,
  selectedServiceOptionId,
  onSelect,
  onOpenPriceSheet,
}: {
  services: CustomerServiceSourceOption[];
  selectedServiceOptionId: string;
  onSelect: (serviceOptionId: string) => void;
  onOpenPriceSheet: () => void;
}) {
  return (
    <div className="pcard" role="radiogroup" aria-label="예약 서비스 선택">
        {services.map((service) => {
          const selected = selectedServiceOptionId === service.id;
          return (
            <button
              className={`pr${selected ? " sel" : ""}`}
              key={service.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(service.id)}
            >
              <span className="radio-check" aria-hidden="true">
                {selected ? <Check size={13} strokeWidth={2.8} /> : null}
              </span>
              <span className="n">{service.name}</span>
              <span className="d">{service.durationMinutes}분</span>
              <span className="p">{formatServicePrice(service.price, service.priceType)}</span>
            </button>
          );
        })}
        <button className="full" type="button" onClick={onOpenPriceSheet}>
          요금표 전체 보기 ›
        </button>
      </div>
  );
}
