import { redirect } from "next/navigation";

import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export const metadata = {
  title: {
    absolute: `${PETMANAGER_SERVICE_NAME} | 예약이 넘쳐도, 놓치는 손님은 없게`,
  },
  description:
    `전화를 못 받아도 예약은 놓치지 않습니다. 예약, 보호자·반려동물 정보, 알림톡, 캘린더를 오너 화면 하나로 정리하는 ${PETMANAGER_SERVICE_NAME}의 실제 화면과 요금제를 확인하세요.`,
};

export default function Page() {
  redirect("/");
}
