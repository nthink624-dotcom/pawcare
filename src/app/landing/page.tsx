import { redirect } from "next/navigation";

export const metadata = {
  title: "PetManager | 반려동물 미용샵 예약·고객관리 자동화",
  description: "하루 30분씩 반복 업무를 줄이고, 고객 예약 정보가 오너 고객DB로 자동 정리되는 반려동물 미용샵 운영 도구입니다.",
};

export default function Page() {
  redirect("/");
}
