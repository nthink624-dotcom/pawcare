"use client";

import { useEffect, useRef, useState } from "react";

import { GalaxyPhoneMockup } from "@/components/landing/landing-ui";

const OWNER_AUTHORING_PREVIEW = "/demo/owner-care-report-completion-preview?mode=landing";
const CUSTOMER_REPORT_PREVIEW = "/demo/customer-care-report-preview";
const OWNER_AUTHORING_VIEWPORT_WIDTH = 520;
const CUSTOMER_REPORT_VIEWPORT_WIDTH = 430;

type ScaledPreviewProps = {
  src: string;
  title: string;
  viewportWidth: number;
};

function ScaledPreview({ src, title, viewportWidth }: ScaledPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const scale = viewportSize.width > 0 ? viewportSize.width / viewportWidth : 1;
  const iframeHeight = scale > 0 ? viewportSize.height / scale : 0;

  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-white">
      {viewportSize.width > 0 && viewportSize.height > 0 ? (
        <iframe
          src={src}
          title={title}
          className="absolute left-0 top-0 block border-0 bg-white"
          style={{
            width: `${viewportWidth}px`,
            height: `${iframeHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          loading="eager"
        />
      ) : null}
    </div>
  );
}

export function LandingAiCareReportCard() {
  return (
    <div className="mx-auto grid max-w-[1140px] overflow-hidden rounded-[24px] bg-[#10192b] shadow-[0_22px_55px_rgba(15,23,42,0.16)] lg:grid-cols-[minmax(0,1.08fr)_170px_minmax(0,0.82fr)]">
      <section className="flex min-w-0 flex-col px-5 py-5 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#8fb7f3]">OWNER PC</p>
            <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-white">말하거나 적으면, 작성은 AI가</p>
          </div>
        </div>

        <div className="mt-4 flex flex-1 items-start justify-center">
          <div className="relative h-[470px] w-full max-w-[382px] overflow-hidden rounded-[16px] bg-transparent">
            <ScaledPreview
              src={OWNER_AUTHORING_PREVIEW}
              title="오너 PC의 실제 AI 케어리포트 작성 화면"
              viewportWidth={OWNER_AUTHORING_VIEWPORT_WIDTH}
            />
          </div>
        </div>
      </section>

        <aside className="flex flex-col justify-center border-y border-white/10 bg-[#17233a] px-5 py-6 text-white lg:border-x lg:border-y-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#8fb7f3]">AI CARE FLOW</p>
          <ol className="relative mt-6 space-y-5 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-white/15">
            {[
              ["01", "말하거나 입력", "메모와 사진을 남겨요"],
              ["02", "AI가 문장 정리", "고객에게 보낼 말로 다듬어요"],
              ["03", "확인 후 발송", "대표님은 확인만 하면 끝"],
            ].map(([number, label, description]) => (
              <li key={number} className="relative grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
                <span className="relative z-10 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#b7d1ff]/40 bg-[#233b61] text-[11px] font-bold tracking-[0.04em] text-[#b7d1ff] tabular-nums">{number}</span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-5 text-white">{label}</p>
                  <p className="mt-1 text-[13px] leading-5 text-white/55">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-white/10 pt-4 text-[13px] leading-5 text-white/70">긴 글을 직접 쓰지 않아도,<br /><strong className="font-semibold text-white">고객에게 보낼 문장이 완성됩니다.</strong></p>
        </aside>

      <section className="flex min-w-0 flex-col justify-center bg-[#fff3f1] px-5 py-5 sm:px-7">
        <div className="mx-auto flex w-full flex-col justify-center">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#c26770]">CUSTOMER</p>
            <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#3b2b2f]">사진과 오늘의 기록을 한눈에</p>
          </div>

          <div className="mt-4 flex items-center justify-center">
            <GalaxyPhoneMockup className="w-full max-w-[220px] drop-shadow-[0_18px_40px_rgba(73,42,48,0.18)]">
              <ScaledPreview
                src={CUSTOMER_REPORT_PREVIEW}
                title="고객이 실제로 확인하는 펫매니저 케어리포트 화면"
                viewportWidth={CUSTOMER_REPORT_VIEWPORT_WIDTH}
              />
            </GalaxyPhoneMockup>
          </div>
          <p className="mt-2 text-center text-[12px] font-medium text-[#9a747a]">알림톡 링크에서 바로 확인</p>
        </div>
      </section>
    </div>
  );
}
