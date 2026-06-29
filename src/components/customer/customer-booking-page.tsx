"use client";

import { useEffect } from "react";

import type { Shop } from "@/types/domain";

type LegacyCustomerBookingPageProps = {
  shopId?: string;
  initialShop?: Pick<Shop, "id"> | null;
  entryHref?: string;
};

function buildEntryHref(props: LegacyCustomerBookingPageProps) {
  if (props.entryHref) return props.entryHref;
  const shopId = props.shopId ?? props.initialShop?.id;
  return shopId ? `/entry/${shopId}` : "/entry";
}

export default function CustomerBookingPage(props: LegacyCustomerBookingPageProps) {
  const entryHref = buildEntryHref(props);

  useEffect(() => {
    window.location.replace(entryHref);
  }, [entryHref]);

  return null;
}
