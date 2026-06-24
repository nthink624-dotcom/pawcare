"use client";

import { ExternalLink } from "lucide-react";

import type { Shop } from "@/types/domain";

type SocialLink = {
  key: string;
  label: string;
  href: string;
  iconSrc: string;
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
    shop.description?.trim() ||
    shop.customer_page_settings.tagline?.trim() ||
    shop.customer_page_settings.showcase_body?.trim() ||
    "상담부터 마무리 안내까지, 아이 성향과 컨디션을 살피며 차분하게 케어해 드려요."
  );
}

function buildSocialLinks(settings: Shop["customer_page_settings"], kakaoInquiryUrl: string): SocialLink[] {
  const links = settings.social_links ?? {};
  return [
    { key: "instagram", label: "인스타", href: normalizeExternalHref(links.instagram_url), iconSrc: "/icons/social/instagram-social.png" },
    { key: "kakao", label: "카톡", href: normalizeExternalHref(links.kakao_channel_url || kakaoInquiryUrl), iconSrc: "/icons/social/kakao-social.png" },
    { key: "naver-blog", label: "블로그", href: normalizeExternalHref(links.naver_blog_url), iconSrc: "/icons/social/naver-blog-social.png" },
    { key: "threads", label: "쓰레드", href: normalizeExternalHref(links.threads_url), iconSrc: "/icons/social/threads-social.png" },
  ].filter((link) => link.href);
}

export default function CustomerShopFrontPanel({
  shop,
  kakaoInquiryUrl,
  bookingHref,
  onBookingClick,
}: {
  shop: Pick<Shop, "description" | "customer_page_settings">;
  kakaoInquiryUrl: string;
  bookingHref: string;
  onBookingClick?: () => void;
}) {
  const settings = shop.customer_page_settings;
  const showcaseTitle = getShowcaseTitle(shop);
  const showcaseBody = getShowcaseBody(shop);
  const socialLinks = buildSocialLinks(settings, kakaoInquiryUrl);

  return (
    <>
      <div className="mt-3 rounded-[14px] border border-[#efe2dc] bg-white px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-6 tracking-[-0.02em] text-[#3a2e2a]">{showcaseTitle}</p>
          <p className="mt-1 whitespace-pre-line text-[16px] font-normal leading-6 tracking-[-0.02em] text-[#8a7a72]">{showcaseBody}</p>
        </div>
      </div>

      {socialLinks.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {socialLinks.map(({ key, label, href, iconSrc }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex h-[44px] min-w-0 items-center justify-center gap-2 rounded-[12px] border border-[#efe2dc] bg-white px-2 text-[16px] font-semibold leading-none text-[#3a2e2a] hover:bg-[#fffaf8]"
            >
              <span className="h-6 w-6 shrink-0 overflow-hidden rounded-[7px]">
                <img
                  src={iconSrc}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="truncate">{label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#b6a89f]" strokeWidth={1.8} />
            </a>
          ))}
        </div>
      ) : null}

      {onBookingClick ? (
        <button
          type="button"
          onClick={onBookingClick}
          className="mt-3 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#ec7f72] text-[16px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(236,127,114,0.32)] transition hover:bg-[#d35f50]"
        >
          {settings.booking_button_label || "예약하기"}
        </button>
      ) : (
        <a
          href={bookingHref}
          className="mt-3 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#ec7f72] text-[16px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(236,127,114,0.32)] transition hover:bg-[#d35f50]"
        >
          {settings.booking_button_label || "예약하기"}
        </a>
      )}
    </>
  );
}
