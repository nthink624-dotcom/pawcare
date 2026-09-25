import { Download } from "lucide-react";

import { revenueTrend, serviceShare, weekdayReservations } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  MetricCard,
  MiniSection,
  PrimaryButton,
  SelectLike,
  SimpleBarChart,
  SimpleLineChart,
  DonutChart,
  ToolbarRow,
  WebSectionTitle,
} from "@/components/owner-web/owner-web-ui";

export default function StatsManagementScreen() {
  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="통계"
        description="총 예약, 완료, 취소, 매출, 재방문율 카드와 차트를 한 번에 보는 대시보드형 화면입니다."
        action={
          <div className="flex items-center gap-2">
            <SelectLike label="이번 달" />
            <SelectLike label="지난달 대비" />
            <PrimaryButton label="다운로드" />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="총 예약" value="318건" meta="지난 기간 대비 +12%" />
        <MetricCard label="완료" value="274건" tone="mint" meta="완료율 86.1%" />
        <MetricCard label="취소" value="21건" tone="rose" meta="취소율 6.6%" />
        <MetricCard label="매출" value="₩8,420,000" tone="sand" meta="객단가 ₩54,300" />
        <MetricCard label="재방문율" value="67%" tone="slate" meta="재방문 고객 103명" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <MiniSection title="매출 추이" action={<GhostButton label="비교 기간 바꾸기" />}>
          <SimpleLineChart points={revenueTrend} />
        </MiniSection>

        <MiniSection title="서비스별 비율" action={<GhostButton label="서비스 목록" />}>
          <DonutChart items={serviceShare} />
        </MiniSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <MiniSection title="요일별 예약 분포" action={<GhostButton label="요일 기준 보기" />}>
          <SimpleBarChart items={weekdayReservations} />
        </MiniSection>

        <MiniSection title="운영 메모">
          <div className="space-y-3 text-[14px] leading-7 text-[#5f5851]">
            <p>금요일과 토요일 오후 슬롯이 가장 빠르게 차기 때문에, 웹 화면에서는 이 두 요일에만 별도 강조 배지를 넣는 방향이 자연스럽습니다.</p>
            <p>완료율과 취소율을 바로 비교할 수 있게 KPI 카드 하단에 짧은 메타 수치를 넣었고, 다운로드 버튼은 우측 상단에 두어 보고서 흐름과 분리했습니다.</p>
            <ToolbarRow>
              <button type="button" className="inline-flex items-center gap-2 rounded-[14px] border border-[#e5ddd6] bg-white px-4 py-2.5 text-[13px] font-medium text-[#3c4d48]">
                <Download className="h-4 w-4" />
                CSV 저장
              </button>
              <GhostButton label="주간 비교" />
            </ToolbarRow>
          </div>
        </MiniSection>
      </div>
    </div>
  );
}
