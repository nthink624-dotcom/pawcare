import { LEGAL_BUSINESS_INFO, LEGAL_LINKS } from "@/lib/legal/legal-info";

export default function LegalLinksFooter() {
  return (
    <footer className="mt-6 rounded-[20px] border border-[#e7e0d5] bg-white px-3.5 py-3 text-[#5f5852]">
      <div className="space-y-0.5">
        <p className="text-[12px] font-semibold text-[#2a2522]">{LEGAL_BUSINESS_INFO.serviceName}</p>
        <p className="text-[12px]">
          <span className="font-medium text-[#2a2522]">운영사</span> {LEGAL_BUSINESS_INFO.operatorName}
        </p>
        <p className="text-[11px] leading-[1.45]">
          대표자 {LEGAL_BUSINESS_INFO.representativeName} · 사업자등록번호{" "}
          {LEGAL_BUSINESS_INFO.businessRegistrationNumber}
        </p>
        <p className="text-[11px] leading-[1.45]">주소 {LEGAL_BUSINESS_INFO.address}</p>
        <p className="text-[11px] leading-[1.45]">호스팅 제공자 {LEGAL_BUSINESS_INFO.hostingProvider}</p>
        <p className="text-[11px] leading-[1.45]">
          고객센터 {LEGAL_BUSINESS_INFO.customerServicePhone} · {LEGAL_BUSINESS_INFO.customerServiceEmail}
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1.5 border-t border-[#e3dbcf] pt-2.5 text-[11px] font-medium text-[#2a2522]">
        {LEGAL_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="underline underline-offset-2">
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
