"use client";

import { ArrowLeft, House } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LABELS: Record<string, string> = { operations: "운영 관리", owners: "업체 관리", marketing: "마케팅 워크룸" };

export default function AdminGlobalNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  if (["/admin", "/admin/login", "/admin/register", "/admin/reset"].includes(pathname)) return null;
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const labels = ["관리자 홈", ...segments.map((segment) => LABELS[segment] ?? "상세")];
  if (pathname === "/admin/marketing" && ["GROWTH-CONTENT-D1-D7-REVIEW", "SECURITY-PRICE-SOURCE-RETENTION"].includes(search.get("work") ?? "")) labels.push("대표 승인");
  return <div className="fixed left-1/2 top-2 z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center border border-[#e5e7eb] bg-white text-[#111]">
    <button type="button" onClick={() => router.back()} aria-label="이전 화면으로 돌아가기" className="inline-flex size-12 items-center justify-center border-r border-[#e5e7eb] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"><ArrowLeft className="h-4 w-4" /></button>
    <Link href="/admin" aria-label="관리자 홈으로 이동" className="inline-flex size-12 items-center justify-center border-r border-[#e5e7eb] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"><House className="h-4 w-4" /></Link>
    <nav aria-label="현재 위치" className="max-w-[min(520px,calc(100vw-112px))] truncate px-3 text-[14px] text-[#6b7280]">{labels.join(" / ")}</nav>
  </div>;
}
