"use client";

import { Check } from "lucide-react";

import { formatCustomerServiceDuration, type CustomerServiceSourceOption } from "@/lib/customer-service-options";
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
    <div className="pcard" data-customer-service-picker="card-pinned-action">
      <div
        className="service-options-scroll"
        role="radiogroup"
        aria-label="예약 서비스 선택"
        data-customer-service-list-scroll="true"
        onWheel={(event) => {
          const list = event.currentTarget;
          if (list.scrollHeight <= list.clientHeight) return;
          list.scrollTop += event.deltaY;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
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
              <span className="d">{formatCustomerServiceDuration(service)}</span>
              <span className="p">{formatServicePrice(service.price, service.priceType)}</span>
            </button>
          );
        })}
      </div>
      <button
        className="full"
        type="button"
        data-customer-price-guide-card-footer="true"
        onClick={onOpenPriceSheet}
      >
        요금표 전체 보기 <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
