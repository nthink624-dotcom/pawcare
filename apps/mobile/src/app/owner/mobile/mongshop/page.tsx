import { MongshopMobileBookings } from "@/components/owner/mongshop-mobile-bookings";

export const dynamic = "force-dynamic";

// PC 대시보드 배너에서 iframe으로 표시하는 개발 전용, 읽기 전용 모바일 화면입니다.
export default function MongshopMobilePage() {
  return <MongshopMobileBookings />;
}
