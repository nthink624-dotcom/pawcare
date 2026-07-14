import Link from "next/link";

import { LEGAL_BUSINESS_INFO, LEGAL_LINKS } from "@/lib/legal/legal-info";

export default function LegalLinksFooter() {
  return (
    <footer className="mt-5 border-t border-[#edf0ee] px-1 pt-4 text-[#7b8580]">
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold text-[#4f5a55]">{LEGAL_BUSINESS_INFO.serviceName}</p>
        <p className="text-[10.5px] leading-[1.45]">
          운영사 {LEGAL_BUSINESS_INFO.operatorName} · 대표 {LEGAL_BUSINESS_INFO.representativeName}
        </p>
        <p className="text-[10.5px] leading-[1.45]">
          사업자등록번호 {LEGAL_BUSINESS_INFO.businessRegistrationNumber} · 호스팅 {LEGAL_BUSINESS_INFO.hostingProvider}
        </p>
        <p className="text-[10.5px] leading-[1.45]">주소 {LEGAL_BUSINESS_INFO.address}</p>
        <p className="text-[10.5px] leading-[1.45]">
          고객센터 {LEGAL_BUSINESS_INFO.customerServicePhone} · {LEGAL_BUSINESS_INFO.customerServiceEmail}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] font-medium text-[#4f5a55]">
        <Link href="/#pricing" className="underline underline-offset-2">
          상품 및 요금
        </Link>
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="underline underline-offset-2">
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
