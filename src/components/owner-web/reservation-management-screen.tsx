"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Search } from "lucide-react";

import { reservationRows, type ReservationStatus } from "@/components/owner-web/owner-web-data";
import {
  Chip,
  DetailBlock,
  DetailPanel,
  GhostButton,
  PrimaryButton,
  SearchField,
  SelectLike,
  TableRow,
  TableShell,
  ToolbarRow,
  WebSectionTitle,
} from "@/components/owner-web/owner-web-ui";

type ReservationFilterStatus = ReservationStatus | "전체";

const statusOrder: ReservationFilterStatus[] = ["전체", "승인 대기", "확정", "진행 중", "픽업 준비", "완료", "취소"];

export default function ReservationManagementScreen() {
  const [selectedReservationId, setSelectedReservationId] = useState(reservationRows[1]?.id ?? "");
  const [activeStatus, setActiveStatus] = useState<ReservationFilterStatus>("전체");
  const [selectedIds, setSelectedIds] = useState<string[]>([reservationRows[1]?.id ?? ""]);

  const filteredRows = useMemo(
    () => (activeStatus === "전체" ? reservationRows : reservationRows.filter((row) => row.status === activeStatus)),
    [activeStatus],
  );

  const selectedReservation = filteredRows.find((row) => row.id === selectedReservationId) ?? reservationRows[1];

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="예약 관리"
        description="날짜, 상태, 검색 기준으로 예약을 빠르게 걸러서 한 번에 조정하는 웹 전용 화면입니다."
        action={<PrimaryButton label="예약 추가" />}
      />

      <ToolbarRow>
        <SelectLike label="오늘부터 7일" icon={CalendarRange} />
        <SearchField placeholder="보호자명, 반려동물명, 연락처 검색" />
      </ToolbarRow>

      <ToolbarRow className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {statusOrder.map((status) => (
            <Chip key={status} label={status} active={activeStatus === status} tone={status === "취소" ? "danger" : "default"} onClick={() => setActiveStatus(status)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton label={`${selectedIds.length}건 선택`} />
          <GhostButton label="상태 변경" />
          <GhostButton label="예약 취소" />
        </div>
      </ToolbarRow>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TableShell columns={["예약 정보", "서비스", "담당", "상태", "채널"]}>
          {filteredRows.map((row) => (
            <TableRow
              key={row.id}
              active={row.id === selectedReservationId}
              onClick={() => setSelectedReservationId(row.id)}
              columns={[
                <div key="info" className="flex items-start gap-3">
                  <button
                    type="button"
                    className={`mt-0.5 h-4 w-4 rounded border ${selectedIds.includes(row.id) ? "border-[#2f7866] bg-[#2f7866]" : "border-[#d5cec7] bg-white"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelection(row.id);
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.customer}</p>
                    <p className="mt-1 text-[13px] text-[#6d655c]">{row.pet} · {row.time}</p>
                  </div>
                </div>,
                <div key="service">
                  <p className="text-[14px] font-medium text-[#17211f]">{row.service}</p>
                  <p className="mt-1 text-[12px] text-[#8b8279]">{row.note}</p>
                </div>,
                <p key="staff" className="text-[14px] text-[#17211f]">{row.staff}</p>,
                <div key="status">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    row.status === "승인 대기"
                      ? "bg-[#fff3ea] text-[#9f654c]"
                      : row.status === "확정"
                        ? "bg-[#eef7f3] text-[#2f7866]"
                        : row.status === "진행 중"
                          ? "bg-[#eef3ff] text-[#4561a8]"
                          : row.status === "픽업 준비"
                            ? "bg-[#faf0f3] text-[#a05672]"
                            : row.status === "완료"
                              ? "bg-[#f0f0ef] text-[#53514d]"
                              : "bg-[#fbefea] text-[#9a5b4a]"
                  }`}>
                    {row.status}
                  </span>
                </div>,
                <div key="channel" className="flex items-center justify-between gap-2">
                  <span className="text-[14px] text-[#5f5851]">{row.channel}</span>
                  <Search className="h-4 w-4 text-[#b0a69c]" />
                </div>,
              ]}
            />
          ))}
        </TableShell>

        <DetailPanel title={`${selectedReservation.customer} · ${selectedReservation.pet}`} subtitle={`${selectedReservation.time} / ${selectedReservation.service}`}>
          <DetailBlock label="예약 상태" value={selectedReservation.status} description={`${selectedReservation.staff} 담당 · ${selectedReservation.channel}`} />
          <DetailBlock label="연락처" value={selectedReservation.phone} description="예약 변경, 픽업 준비, 완료 알림을 바로 보낼 수 있어요." />
          <DetailBlock label="메모" value={selectedReservation.note} description="고객 요청사항과 빠른 전달 메모를 여기서 확인합니다." />
          <div className="grid gap-2 sm:grid-cols-2">
            <PrimaryButton label="상태 변경" />
            <GhostButton label="예약 취소" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <GhostButton label="다중 선택 보기" />
            <GhostButton label="예약 내역 복제" />
          </div>
        </DetailPanel>
      </div>
    </div>
  );
}
