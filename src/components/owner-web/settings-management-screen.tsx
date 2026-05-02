"use client";

import { useState } from "react";

import { settingsTabs, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  PrimaryButton,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";

const tabContent: Record<SettingsTabKey, { title: string; rows: Array<{ label: string; value: string; description?: string }> }> = {
  shop: {
    title: "매장 정보",
    rows: [
      { label: "매장명", value: "우유 미용실", description: "고객 예약 화면과 결제 화면에 노출되는 대표 이름" },
      { label: "대표 연락처", value: "010-8989-8498", description: "고객 문의와 예약 확인에 사용하는 번호" },
      { label: "주소", value: "서울특별시 동대문구 서울시립대로 26-1 (전농동), 1층", description: "카카오 주소 검색과 상세 주소를 합친 최종 노출 주소" },
    ],
  },
  hours: {
    title: "운영 시간",
    rows: [
      { label: "전체 시간 설정", value: "10:00 - 19:00", description: "월요일부터 일요일까지 한 번에 적용" },
      { label: "정기 휴무일", value: "매주 수요일", description: "휴무일은 예약 가능한 슬롯에서 자동 제외" },
      { label: "예약 가능 간격", value: "정각 / 30분", description: "고객 예약 화면 시간 슬롯 간격과 연결" },
    ],
  },
  policy: {
    title: "예약 정책",
    rows: [
      { label: "동시 예약 가능 수", value: "2명", description: "한 시간대에 동시에 받을 수 있는 예약 수" },
      { label: "승인 방식", value: "직접 승인", description: "예약 요청 후 오너가 직접 확정하는 운영 방식" },
      { label: "취소 허용 시간", value: "예약 2시간 전까지", description: "고객이 직접 변경/취소할 수 있는 범위" },
    ],
  },
  alerts: {
    title: "알림 설정",
    rows: [
      { label: "알림톡 전체 사용", value: "사용 중", description: "예약 확정, 취소, 픽업 준비, 완료 알림을 묶어서 관리" },
      { label: "재방문 안내", value: "켜짐", description: "주기 기준으로 고객에게 재방문 알림 발송" },
      { label: "운영자 알림", value: "카카오 채널 + 앱", description: "예약 요청과 변경 사항을 오너에게 즉시 전달" },
    ],
  },
  billing: {
    title: "결제 설정",
    rows: [
      { label: "현재 플랜", value: "일 년 플랜", description: "월 7,900원 / 서비스 종료일 2027.04.29" },
      { label: "정기 결제 수단", value: "신한카드 ···· 1024", description: "등록된 카드 변경과 재결제 확인" },
      { label: "환불/취소 정책", value: "관리자 승인 필요", description: "운영자 확인 후 수동 취소가 가능한 구조" },
    ],
  },
  users: {
    title: "사용자 관리",
    rows: [
      { label: "원장 계정", value: "owner@petmanager.co.kr", description: "매장 전체 권한 / 설정 수정 가능" },
      { label: "서브 스태프", value: "2명", description: "캘린더 열람, 예약 진행, 완료 처리 권한" },
      { label: "관리자 활동 기록", value: "최근 7일 14건", description: "누가 어떤 설정을 바꿨는지 확인하는 로그" },
    ],
  },
};

export default function SettingsManagementScreen() {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("shop");
  const current = tabContent[activeTab];

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="설정"
        description="매장 정보, 운영 시간, 예약 정책, 알림, 결제, 사용자 관리를 웹 화면 기준으로 탭화한 구성입니다."
        action={<PrimaryButton label="저장" />}
      />

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <WebSurface className="p-3">
          <div className="space-y-1.5">
            {settingsTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left transition ${
                  activeTab === tab.key ? "bg-[#f1f7f4] text-[#2f7866]" : "text-[#5f5851] hover:bg-[#fbfaf8]"
                }`}
              >
                <span className="text-[15px] font-medium">{tab.label}</span>
                <span className="text-[12px]">{activeTab === tab.key ? "선택됨" : ""}</span>
              </button>
            ))}
          </div>
        </WebSurface>

        <WebSurface className="p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#f0e8e1] pb-4">
            <div>
              <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[#17211f]">{current.title}</h3>
              <p className="mt-2 text-[14px] text-[#7a7269]">웹 오너 페이지에서는 각 탭을 좌측 고정 메뉴로 두고, 우측에서 한 번에 수정하는 구조를 가정했습니다.</p>
            </div>
            <GhostButton label="초기화" />
          </div>

          <div className="divide-y divide-[#f1e8e0]">
            {current.rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-6 py-5">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.label}</p>
                  {row.description ? <p className="mt-2 text-[13px] leading-6 text-[#81796f]">{row.description}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-medium text-[#2f7866]">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </WebSurface>
      </div>
    </div>
  );
}
