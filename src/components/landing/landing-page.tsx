"use client";

import { ArrowRight, ArrowUp, Check, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import LegalLinksFooter from "@/components/legal/legal-links-footer";
import {
  BookingSystemSection,
  AutomaticNotificationSection,
  HeroSection,
  PainSection,
  ScheduleProofSection,
} from "@/components/landing/landing-primary-sections";
import { FaqAndFinalCtaSection } from "@/components/landing/landing-conversion-sections";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { OWNER_SINGLE_MONTHLY_PRICE_KRW } from "@/lib/billing/owner-plans";
import { MARKETING_UTM_FIELDS } from "@/lib/marketing-acquisition";
import { won } from "@/lib/utils";

import styles from "./landing-page.module.css";

const navigationItems = [
  { id: "booking-system", label: "예약 시스템" },
] as const;

let landingViewAcquisitionSent = false;
let landingAcquisitionQueue: Promise<void> = Promise.resolve();

function readLandingUtmQuery() {
  const query = new URLSearchParams(window.location.search);
  const utm: Record<string, unknown> = {};
  for (const field of MARKETING_UTM_FIELDS) {
    const values = query.getAll(field);
    if (values.length === 1) utm[field] = values[0];
    if (values.length > 1) utm[field] = values;
  }
  return utm;
}

function sendLandingAcquisitionEvent(body: Record<string, unknown>) {
  landingAcquisitionQueue = landingAcquisitionQueue.then(async () => {
    try {
      await fetch("/api/marketing/acquisition", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // Attribution is non-blocking; product navigation must remain available.
    }
  });
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [mobileCtaVisible, setMobileCtaVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    const utm = readLandingUtmQuery();
    if (!landingViewAcquisitionSent) {
      landingViewAcquisitionSent = true;
      sendLandingAcquisitionEvent({ eventName: "landing_view", utm });
    }

    const recordSignupCta = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      const destination = new URL(anchor.href, window.location.origin);
      if (destination.origin !== window.location.origin || destination.pathname !== "/signup") return;
      sendLandingAcquisitionEvent({ eventName: "landing_cta_click", ctaId: "signup", utm });
    };

    document.addEventListener("click", recordSignupCta);
    return () => document.removeEventListener("click", recordSignupCta);
  }, []);

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
    <main className="landing-theme owner-font min-h-screen overflow-x-clip bg-white text-[#111827]">
      <LandingHeader onNavigate={scrollToSection} onPricingOpen={() => setPricingOpen(true)} />
      <HeroSection onViewProduct={() => scrollToSection("booking-system")} />
      <PainSection />
      <BookingSystemSection />
        <ScheduleProofSection />
        <AutomaticNotificationSection />
        <FaqAndFinalCtaSection />
      <div ref={footerRef} className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-2">
        <LegalLinksFooter />
      </div>
      <MobileTrialCta visible={mobileCtaVisible && !footerVisible} />
      <ScrollToTopButton />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </main>
  );
}

function ScrollToTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`${styles.scrollTopButton} items-center justify-center rounded-full border border-white/70 bg-[#17233a] text-white shadow-[0_10px_26px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-[#223453] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2`}
      aria-label="맨 위로 이동"
      title="맨 위로"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function LandingHeader({ onNavigate, onPricingOpen }: { onNavigate: (sectionId: string) => void; onPricingOpen: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5">
        <Link href="/" aria-label={`${PETMANAGER_SERVICE_NAME} 홈`} className="flex shrink-0 items-center">
          <PetManagerBrand
            priority
            imageClassName="h-[22px] w-auto"
            nameClassName="text-[16px] text-[var(--landing-accent)] sm:text-[18px]"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="랜딩페이지 메뉴">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="h-10 text-[15px] font-medium text-[#64748b] transition hover:text-[#111827]"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onPricingOpen}
            className="h-10 text-[15px] font-medium text-[#64748b] transition hover:text-[#111827]"
          >
            요금제
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPricingOpen}
            className="inline-flex h-10 items-center px-2 text-[14px] font-medium text-[#526071] transition hover:text-[#111827] lg:hidden"
          >
            요금제
          </button>
          <Link
            href="/login?next=%2Fowner"
            className="hidden h-10 items-center px-3 text-[15px] font-medium text-[#64748b] transition hover:text-[#111827] sm:inline-flex"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-[var(--landing-accent)] px-4 text-[15px] font-semibold text-white transition hover:bg-[var(--landing-accent-hover)]"
          >
            14일 무료 시작
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function PricingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="펫매니저 요금제"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100vh-32px)] w-full max-w-[920px] overflow-y-auto rounded-[22px] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.3)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[var(--landing-accent)]">월 정기 이용</p>
            <h2 className="mt-1 text-[26px] font-semibold text-[#111827] sm:text-[30px]">한 가지 요금으로 시작하세요</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">14일 무료체험 후 계속 이용할 때만 결제를 진행합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#111827]" aria-label="요금제 닫기" autoFocus>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <article className="mt-6 rounded-[14px] border border-[#2563eb] bg-[#f6f9ff] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[16px] font-semibold text-[#172033]">펫매니저 월 정기 이용</p>
              <p className="mt-2 text-[30px] font-semibold text-[#111827]">{won(OWNER_SINGLE_MONTHLY_PRICE_KRW)}<span className="ml-1 text-[14px] font-medium text-[#64748b]">/월 · VAT 포함</span></p>
            </div>
            <Link href="/signup" className="flex h-11 w-full items-center justify-center rounded-[9px] bg-[#2563eb] px-5 text-[14px] font-semibold text-white sm:w-auto">14일 무료 시작</Link>
          </div>
          <div className="mt-5 border-t border-[#dbe8f8] pt-4 text-[14px] leading-6 text-[#526071]">
            <p className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />매장 1곳당 구독 1개로 이용하며, 직원 수 제한은 없습니다.</p>
            <p className="mt-2 flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />여러 매장을 운영하면 매장별로 별도 구독이 필요합니다.</p>
          </div>
          <div className="mt-5 border-t border-[#dbe8f8] pt-4 text-[14px] leading-6 text-[#526071]">
            <p className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />무료체험은 카드 등록 없이 시작하며, 기간이 끝나도 자동 청구되지 않습니다.</p>
            <p className="mt-2 flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />계속 이용할 때만 카드를 등록해 월 정기결제를 시작합니다.</p>
          </div>
          <div className="mt-5 border-t border-[#dbe8f8] pt-4 text-[14px] leading-6 text-[#526071]">
            <p className="font-medium text-[#172033]">파일럿 신규 매장 안내</p>
            <p className="mt-1">파일럿 참여가 확인된 신규 매장은 일반 14일 대신 최초 시작일부터 총 30일을 무료로 이용합니다.</p>
            <p className="mt-2">검증되어 보상 대상으로 인정된 피드백·문제는 건당 3일 이상 연장할 수 있으며, 첫 결제 전 총 무료 이용은 최초 시작일부터 최대 60일입니다.</p>
          </div>
        </article>
        </div>
      </div>
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
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--landing-accent)] text-[15px] font-semibold text-white"
      >
        14일 무료로 시작하기
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
