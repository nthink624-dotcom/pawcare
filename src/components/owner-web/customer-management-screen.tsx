"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";

import { customerRows } from "@/components/owner-web/owner-web-data";
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

export default function CustomerManagementScreen() {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerRows[0]?.id ?? "");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);

  const selectedCustomer = useMemo(
    () => customerRows.find((row) => row.id === selectedCustomerId) ?? customerRows[0],
    [selectedCustomerId],
  );

  function toggleDelete(id: string) {
    setSelectedDeleteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="고객 관리"
        description="고객 검색, 태그 필터, 삭제 모드, 상세 패널을 한 화면에서 다루는 CRM형 화면입니다."
        action={<PrimaryButton label="고객 추가" />}
      />

      <ToolbarRow>
        <SearchField placeholder="보호자명, 연락처, 반려동물 이름 검색" />
        <SelectLike label="고객 필터" />
        <SelectLike label="최신 방문순" />
        <GhostButton label={deleteMode ? "삭제 모드 닫기" : "고객 삭제"} onClick={() => setDeleteMode((current) => !current)} />
      </ToolbarRow>

      <ToolbarRow className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체" active />
          <Chip label="정기 고객" tone="soft" />
          <Chip label="재방문 임박" tone="soft" />
          <Chip label="상담 필요" tone="soft" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton label="태그 필터" />
          <GhostButton label="정렬" />
        </div>
      </ToolbarRow>

      {deleteMode ? (
        <ToolbarRow className="justify-between rounded-[18px] border border-[#ead9cf] bg-[#fffaf6] px-4 py-3">
          <span className="text-[14px] font-medium text-[#5e5248]">{selectedDeleteIds.length}명 선택됨</span>
          <div className="flex items-center gap-2">
            <GhostButton label="전체 선택" />
            <GhostButton label="선택 삭제" />
          </div>
        </ToolbarRow>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TableShell columns={["고객", "연락처", "반려동물", "태그", "최근 방문"]}>
          {customerRows.map((row) => (
            <TableRow
              key={row.id}
              active={row.id === selectedCustomerId}
              onClick={() => setSelectedCustomerId(row.id)}
              columns={[
                <div key="name" className="flex items-start gap-3">
                  {deleteMode ? (
                    <button
                      type="button"
                      className={`mt-0.5 h-4 w-4 rounded border ${selectedDeleteIds.includes(row.id) ? "border-[#2f7866] bg-[#2f7866]" : "border-[#d5cec7] bg-white"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDelete(row.id);
                      }}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.name}</p>
                    <p className="mt-1 text-[12px] text-[#8b8279]">{row.alerts}</p>
                  </div>
                </div>,
                <p key="phone" className="text-[14px] text-[#17211f]">{row.phone}</p>,
                <p key="pets" className="text-[14px] text-[#17211f]">{row.pets.join(", ")}</p>,
                <div key="tags" className="flex flex-wrap gap-1.5">
                  {row.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f4f0eb] px-2.5 py-1 text-[12px] text-[#6d655c]">
                      {tag}
                    </span>
                  ))}
                </div>,
                <div key="recent" className="flex items-center justify-between gap-2">
                  <span className="text-[14px] text-[#17211f]">{row.recentVisit}</span>
                  {!deleteMode ? <ChevronRight className="h-4 w-4 text-[#b1a69c]" /> : null}
                </div>,
              ]}
            />
          ))}
        </TableShell>

        <DetailPanel title={selectedCustomer.name} subtitle={`${selectedCustomer.phone} · ${selectedCustomer.pets.join(", ")}`}>
          <DetailBlock label="기본 정보" value={`${selectedCustomer.name} / ${selectedCustomer.phone}`} description={`최근 방문 ${selectedCustomer.recentVisit} · 다음 예약 ${selectedCustomer.nextBooking}`} />
          <DetailBlock label="반려동물" value={selectedCustomer.pets.join(", ")} description="반려동물별 맞춤 메모와 스타일 기록을 우측 패널 안에서 이어서 볼 수 있습니다." />
          <DetailBlock label="고객 메모" value={selectedCustomer.memo} description={selectedCustomer.alerts} />
          <DetailBlock label="빠른 예약" value="예약 추가" description="전화 응대 중에도 이 고객 기준으로 바로 예약을 붙일 수 있는 액션" />
          <div className="grid gap-2 sm:grid-cols-2">
            <PrimaryButton label="빠른 예약 추가" />
            <GhostButton label="알림 상태 수정" />
          </div>
          <button
            type="button"
            onClick={() => setDeleteMode((current) => !current)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#94624f]"
          >
            <Trash2 className="h-4 w-4" />
            고객 선택 삭제 모드
          </button>
        </DetailPanel>
      </div>
    </div>
  );
}
