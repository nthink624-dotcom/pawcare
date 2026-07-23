"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import {
  AutomationSection,
  CustomerDataSection,
  HeroSection,
  PainSection,
  ScheduleProofSection,
} from "@/components/landing/landing-primary-sections";
import {
  FaqAndFinalCtaSection,
  PricingSection,
  SavingsSection,
  TrustSection,
} from "@/components/landing/landing-conversion-sections";

const navigationItems = [
  { id: "customer-data", label: "자동 고객관리" },
  { id: "screens", label: "실제 화면" },
  { id: "savings", label: "시간 가치" },
  { id: "pricing", label: "요금제" },
] as const;

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [mobileCtaVisible, setMobileCtaVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const updateMobileCta = () => setMobileCtaVisible(window.scrollY > window.innerHeight * 0.3);
    updateMobileCta();
    window.addEventListener("scroll", updateMobileCta, { passive: true });
    return () => window.removeEventListener("scroll", updateMobileCta);
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), {
      rootMargin: "0px 0px 120px 0px",
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="owner-font min-h-screen overflow-x-hidden bg-white text-[#111827]">
      <LandingHeader onNavigate={scrollToSection} />
      <HeroSection onViewProduct={() => scrollToSection("customer-data")} />
      <PainSection />
      <CustomerDataSection />
      <ScheduleProofSection />
      <AutomationSection />
      <SavingsSection />
      <TrustSection />
      <PricingSection />
      <FaqAndFinalCtaSection />
      <div ref={footerRef} className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-2">
        <LegalLinksFooter />
      </div>
      <MobileTrialCta visible={mobileCtaVisible && !footerVisible} />
    </main>
  );
}

function LandingHeader({ onNavigate }: { onNavigate: (sectionId: string) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5">
        <Link href="/" aria-label="넘친 Day 홈" className="flex shrink-0 items-center">
          <Image src="/icons/logo/nemchin-day-logo.svg" alt="넘친 Day" width={132} height={36} priority />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="랜딩페이지 메뉴">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="h-10 text-[14px] font-medium text-[#64748b] transition hover:text-[#111827]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login?next=%2Fowner"
            className="hidden h-10 items-center px-3 text-[14px] font-medium text-[#64748b] transition hover:text-[#111827] sm:inline-flex"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-[#2563eb] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            14일 무료 시작
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileTrialCta({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe2ea] bg-white/96 p-3 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur-md transition-transform duration-200 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <Link
        href="/signup"
        tabIndex={visible ? 0 : -1}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] text-[15px] font-semibold text-white"
      >
        14일 무료로 시작하기
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
