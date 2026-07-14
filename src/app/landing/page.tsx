import { redirect } from "next/navigation";

export const metadata = {
  title: "넘친 Day | 예약이 넘쳐도, 놓치는 손님은 없게",
  description:
    "전화를 못 받아도 예약은 놓치지 않습니다. 예약, 보호자·반려동물 정보, 알림톡, 캘린더를 오너 화면 하나로 정리하는 넘친 Day의 실제 화면과 요금제를 확인하세요.",
};

export default function Page() {
  redirect("/");
}
