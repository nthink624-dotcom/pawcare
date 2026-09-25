"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { buildDemoInitialSetupBootstrap } from "@/lib/mock-data";

export default function InitialSetupRefreshPreview() {
  const [data, setData] = useState(buildDemoInitialSetupBootstrap);
  if (process.env.NODE_ENV !== "development") notFound();
  return <>
    <button data-testid="refresh-complete" onClick={() => setData(current => ({ ...current, initialSetupReadiness: { shopId: current.shop.id, steps: { hours: true, staff: true, pricing: true }, completed: true, nextStep: null } }))}>완료 응답 갱신</button>
    <button data-testid="refresh-incomplete" onClick={() => setData(current => ({ ...current, initialSetupReadiness: { shopId: current.shop.id, steps: { hours: false, staff: false, pricing: false }, completed: false, nextStep: "hours" } }))}>미완료 응답 갱신</button>
    <OwnerWebPreview initialData={data} />
  </>;
}
