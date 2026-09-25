import Link from "next/link";
import { notFound } from "next/navigation";

import AdminPilotBenefitScreen from "@/components/admin/admin-pilot-benefit-screen";

import {
  buildPilotBenefitPreviewFixture,
  PILOT_BENEFIT_PREVIEW_LABELS,
  PILOT_BENEFIT_PREVIEW_STATES,
  type PilotBenefitPreviewState,
} from "./pilot-benefit-fixtures";

function parsePreviewState(value: string | string[] | undefined): PilotBenefitPreviewState {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PILOT_BENEFIT_PREVIEW_STATES.find((state) => state === candidate) ?? "initial";
}

export default async function PilotBenefitsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const state = parsePreviewState((await searchParams).state);

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <nav aria-label="파일럿 혜택 예시 상태" className="mx-auto flex w-full max-w-[1180px] flex-wrap gap-2 px-3 pt-3 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6">
        {PILOT_BENEFIT_PREVIEW_STATES.map((item) => (
          <Link
            key={item}
            href={`/dev/pilot-benefits-preview?state=${item}` as never}
            aria-current={item === state ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-[10px] border px-3 text-[14px] font-medium leading-5 tracking-[-0.005em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
              item === state
                ? "border-[#15213b] bg-[#15213b] text-white"
                : "border-[#d9e0e8] bg-white text-[#475569] hover:bg-[#f8fafc]"
            }`}
          >
            {PILOT_BENEFIT_PREVIEW_LABELS[item]}
          </Link>
        ))}
      </nav>
      <AdminPilotBenefitScreen fixture={buildPilotBenefitPreviewFixture(state)} />
    </div>
  );
}
