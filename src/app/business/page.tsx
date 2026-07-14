import LegalPageLayout from "@/components/legal/legal-page-layout";
import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";

const rows = [
  ["서비스명", LEGAL_BUSINESS_INFO.serviceName],
  ["운영사", LEGAL_BUSINESS_INFO.operatorName],
  ["대표자명", LEGAL_BUSINESS_INFO.representativeName],
  ["사업자등록번호", LEGAL_BUSINESS_INFO.businessRegistrationNumber],
  ["주소", LEGAL_BUSINESS_INFO.address],
  ["고객센터 연락처", LEGAL_BUSINESS_INFO.customerServicePhone],
  ["고객센터 이메일", LEGAL_BUSINESS_INFO.customerServiceEmail],
  ["호스팅 제공자", LEGAL_BUSINESS_INFO.hostingProvider],
] as const;

export default function BusinessPage() {
  return (
    <LegalPageLayout
      title="사업자 정보"
      subtitle="넘친 Day 서비스의 공개 사업자 정보와 고객센터 안내입니다."
    >
      <section className="overflow-hidden rounded-lg border border-[#dde2e7] bg-white">
        <dl className="divide-y divide-[#e5e9ed]">
          {rows.map(([label, value]) => (
            <div key={label} className="grid md:grid-cols-[220px_1fr]">
              <dt className="bg-[#f8f9fa] px-5 py-3 text-[13px] font-semibold text-[#596570] md:border-r md:border-[#e5e9ed] md:px-6 md:py-4">
                {label}
              </dt>
              <dd className="px-5 pb-4 text-[14px] font-semibold text-[#20262c] md:px-6 md:py-4">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </LegalPageLayout>
  );
}
