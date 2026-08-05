import LandingPage from "@/components/landing/landing-page";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: {
    absolute: `${PETMANAGER_SERVICE_NAME} | 예약이 넘쳐도, 놓치는 손님은 없게`,
  },
  description:
    `전화를 못 받아도 예약은 놓치지 않습니다. 공개 요금제, 카드 등록 없는 14일 체험, 기존 고객 데이터 이전을 제공하는 ${PETMANAGER_SERVICE_NAME}의 실제 화면을 확인하세요.`,
};

export default function Home() {
  return <LandingPage />;
}
