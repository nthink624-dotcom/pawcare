import { LEGAL_BUSINESS_INFO, LEGAL_LINKS } from "@/lib/legal/legal-info";

export default function LegalLinksFooter() {
  return (
    <footer className="mt-8 rounded-[24px] border border-[#e7e0d5] bg-white px-4 py-4 text-[#5f5852]">
      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-[#2a2522]">{LEGAL_BUSINESS_INFO.serviceName}</p>
        <p className="text-[12px]">
          <span className="font-medium text-[#2a2522]">운영주체</span> {LEGAL_BUSINESS_INFO.operatorName}
        </p>
        <p className="text-[11px] leading-5">
          대표자 {LEGAL_BUSINESS_INFO.representativeName} · 사업자등록번호 {LEGAL_BUSINESS_INFO.businessRegistrationNumber}
        </p>
        <p className="text-[11px] leading-5">주소 {LEGAL_BUSINESS_INFO.address}</p>
        <p className="text-[11px] leading-5">호스팅서비스 제공자 {LEGAL_BUSINESS_INFO.hostingProvider}</p>
        <p className="text-[11px] leading-5">
          고객센터 {LEGAL_BUSINESS_INFO.customerServicePhone} · {LEGAL_BUSINESS_INFO.customerServiceEmail}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-[#e3dbcf] pt-3 text-[11px] font-medium text-[#2a2522]">
        {LEGAL_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="underline underline-offset-2">
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
