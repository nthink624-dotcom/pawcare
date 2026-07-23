import Link from "next/link";

import { LEGAL_BUSINESS_INFO, LEGAL_LINKS, LEGAL_SERVICE_OPERATOR_NOTICE } from "@/lib/legal/legal-info";

export default function LegalLinksFooter() {
  return (
    <footer className="mt-10 border-t border-[#dfe4e8] pt-6 text-[#69747e]">
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <p className="text-[13px] font-bold text-[#303840]">{LEGAL_BUSINESS_INFO.serviceName}</p>
          <p className="text-[12px] leading-5">{LEGAL_SERVICE_OPERATOR_NOTICE}</p>
          <p className="text-[12px] leading-5">
          운영사 {LEGAL_BUSINESS_INFO.operatorName} · 대표 {LEGAL_BUSINESS_INFO.representativeName}
          </p>
          <p className="text-[12px] leading-5">
          사업자등록번호 {LEGAL_BUSINESS_INFO.businessRegistrationNumber} · 호스팅 {LEGAL_BUSINESS_INFO.hostingProvider}
          </p>
          <p className="text-[12px] leading-5">
            통신판매업 신고번호 {LEGAL_BUSINESS_INFO.telecomSalesRegistration} · 결제대행 {LEGAL_BUSINESS_INFO.paymentProvider}
          </p>
          <p className="text-[12px] leading-5">주소 {LEGAL_BUSINESS_INFO.address}</p>
          <p className="text-[12px] leading-5">
          고객센터 {LEGAL_BUSINESS_INFO.customerServicePhone} · {LEGAL_BUSINESS_INFO.customerServiceEmail}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-semibold text-[#46515b] md:justify-end">
          <Link href="/#pricing" className="underline underline-offset-4">
            상품 및 요금
          </Link>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline underline-offset-4">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
