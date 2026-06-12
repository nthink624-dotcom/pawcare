"use client";

import { AtSign, ExternalLink, Instagram, MessageCircle, Play, Sparkles, type LucideIcon } from "lucide-react";

import type { Shop } from "@/types/domain";

type SocialLink = {
  key: string;
  label: string;
  href: string;
  Icon: LucideIcon;
};

function normalizeExternalHref(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (/^(https?:|tel:|mailto:|kakao)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getShowcaseTitle(shop: Pick<Shop, "customer_page_settings">) {
  return shop.customer_page_settings.showcase_title?.trim() || "우리 아이를 편안하게 맡길 수 있는 공간";
}

function getShowcaseBody(shop: Pick<Shop, "description" | "customer_page_settings">) {
  return (
    shop.customer_page_settings.showcase_body?.trim() ||
    shop.description?.trim() ||
    shop.customer_page_settings.tagline?.trim() ||
    "상담부터 마무리 안내까지, 아이 성향과 컨디션을 살피며 차분하게 케어해 드려요."
  );
}

function buildSocialLinks(settings: Shop["customer_page_settings"], kakaoInquiryUrl: string): SocialLink[] {
  const links = settings.social_links ?? {};
  return [
    { key: "instagram", label: "인스타", href: normalizeExternalHref(links.instagram_url), Icon: Instagram },
    { key: "kakao", label: "카톡", href: normalizeExternalHref(links.kakao_channel_url || kakaoInquiryUrl), Icon: MessageCircle },
    { key: "tiktok", label: "틱톡", href: normalizeExternalHref(links.tiktok_url), Icon: Play },
    { key: "threads", label: "쓰레드", href: normalizeExternalHref(links.threads_url), Icon: AtSign },
  ].filter((link) => link.href);
}

export default function CustomerShopFrontPanel({
  shop,
  kakaoInquiryUrl,
  bookingHref,
}: {
  shop: Pick<Shop, "description" | "customer_page_settings">;
  kakaoInquiryUrl: string;
  bookingHref: string;
}) {
  const settings = shop.customer_page_settings;
  const showcaseTitle = getShowcaseTitle(shop);
  const showcaseBody = getShowcaseBody(shop);
  const socialLinks = buildSocialLinks(settings, kakaoInquiryUrl);

  return (
    <>
      <div className="mt-3 rounded-[10px] border border-[#eadfd6] bg-[#fffdf9] px-3 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-[#7A5A45] ring-1 ring-[#eadfd6]">
            <Sparkles className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-6 tracking-[-0.03em] text-[#2b241f]">{showcaseTitle}</p>
            <p className="mt-1 whitespace-pre-line text-[16px] font-normal leading-6 tracking-[-0.02em] text-[#6f6258]">{showcaseBody}</p>
          </div>
        </div>
      </div>

      {socialLinks.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {socialLinks.map(({ key, label, href, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex h-[42px] min-w-0 items-center justify-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-2 text-[16px] font-normal leading-none text-[#3f352d] hover:bg-[#faf7f2]"
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9a8c80]" strokeWidth={1.8} />
            </a>
          ))}
        </div>
      ) : null}

      <a
        href={bookingHref}
        className="mt-2 flex h-[46px] w-full items-center justify-center rounded-[8px] bg-[#7A5A45] text-[16px] font-medium leading-none text-white transition hover:bg-[#684b39]"
      >
        {settings.booking_button_label || "예약하기"}
      </a>
    </>
  );
}
