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
  if (pathname.startsWith("/admin/approvals/")) labels.splice(1, labels.length, "마케팅 워크룸", "대표 승인");
  return <div className="fixed left-1/2 top-2 z-50 grid w-[calc(100vw-16px)] max-w-[560px] -translate-x-1/2 grid-cols-[40px_40px_minmax(0,1fr)] grid-rows-[40px_32px] border border-[#e5e7eb] bg-white text-[#111] sm:flex sm:w-auto sm:max-w-[calc(100vw-16px)] sm:items-center">
    <button type="button" onClick={() => router.back()} aria-label="이전 화면으로 돌아가기" className="inline-flex size-10 items-center justify-center border-r border-[#e5e7eb] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-black sm:size-12"><ArrowLeft className="h-4 w-4" /></button>
    <Link href="/admin" aria-label="관리자 홈으로 이동" className="inline-flex size-10 items-center justify-center border-r border-[#e5e7eb] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-black sm:size-12"><House className="h-4 w-4" /></Link>
    <nav aria-label="현재 위치" className="col-span-3 row-start-2 min-w-0 truncate border-t border-[#e5e7eb] px-3 text-[13px] leading-8 text-[#6b7280] sm:max-w-[min(520px,calc(100vw-112px))] sm:border-t-0 sm:text-[14px]">{labels.join(" / ")}</nav>
  </div>;
}
