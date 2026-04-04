import LegalPageLayout from "@/components/legal/legal-page-layout";
import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";

const rows = [
  ["서비스명", LEGAL_BUSINESS_INFO.serviceName],
  ["운영주체", LEGAL_BUSINESS_INFO.operatorName],
  ["대표자명", LEGAL_BUSINESS_INFO.representativeName],
  ["사업자등록번호", LEGAL_BUSINESS_INFO.businessRegistrationNumber],
  ["주소", LEGAL_BUSINESS_INFO.address],
  ["고객센터 전화", LEGAL_BUSINESS_INFO.customerServicePhone],
  ["고객센터 이메일", LEGAL_BUSINESS_INFO.customerServiceEmail],
] as const;

export default function BusinessPage() {
  return (
    <LegalPageLayout
      title="사업자 정보"
      subtitle="멍매니저 서비스의 공개 사업자 정보와 고객센터 안내입니다."
    >
      <section className="rounded-[22px] border border-[#eee6db] bg-[#fcfaf6] px-4 py-4">
        <div className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-[#e7e0d5] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold text-[#6a625b]">{label}</p>
              <p className="mt-1 text-[14px] font-semibold text-[#1f1a17]">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </LegalPageLayout>
  );
}
