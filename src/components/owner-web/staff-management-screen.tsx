"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { staffRows } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  MiniSection,
  PrimaryButton,
  TableRow,
  TableShell,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";

type StaffRow = (typeof staffRows)[number];

const staffInitialState = {
  name: "",
  role: "",
  start: "10:00",
  end: "19:00",
};

const leaveRows = [
  { name: "정우진", type: "반차", date: "5월 14일", status: "승인" },
  { name: "서하늘", type: "연차", date: "5월 20일", status: "대기" },
  { name: "민서윤", type: "휴무 변경", date: "5월 22일", status: "확인 필요" },
];

const weekScheduleRows = [
  { day: "월", open: "정우진", mid: "서하늘", close: "민서윤" },
  { day: "화", open: "정우진", mid: "강리오", close: "서하늘" },
  { day: "수", open: "서하늘", mid: "민서윤", close: "정우진" },
  { day: "목", open: "정우진", mid: "오다은", close: "한지우" },
  { day: "금", open: "서하늘", mid: "정우진", close: "민서윤" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-[#334155]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
    />
  );
}

export default function StaffManagementScreen() {
  const [staff, setStaff] = useState<StaffRow[]>(staffRows);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(staffInitialState);
  const [formError, setFormError] = useState("");
  const [leaveManageMode, setLeaveManageMode] = useState(false);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);
  const [staffNotice, setStaffNotice] = useState("");

  function closeDialog() {
    setDialogOpen(false);
    setFormError("");
  }

  function addStaff() {
    if (!staffForm.name.trim()) {
      setFormError("스태프 이름을 입력해 주세요.");
      return;
    }

    if (!staffForm.role.trim()) {
      setFormError("담당 가능한 서비스나 역할을 입력해 주세요.");
      return;
    }

    setStaff((current) => [
      ...current,
      {
        name: staffForm.name.trim(),
        role: staffForm.role.trim(),
        hours: `${staffForm.start} - ${staffForm.end}`,
        today: "예약 0건",
      },
    ]);
    setStaffForm(staffInitialState);
    closeDialog();
  }

  return (
    <div className="space-y-5">
      <WebSectionTitle
        title="스태프"
        description="스태프별 담당 서비스, 오늘 근무, 휴무와 연차를 따로 관리합니다."
        action={<PrimaryButton label="스태프 추가" onClick={() => setDialogOpen(true)} />}
      />

      <div className="grid gap-3 lg:grid-cols-4">
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">등록 스태프</p>
          <p className="mt-2 text-[28px] font-semibold text-[#111827]">{staff.length}명</p>
        </WebSurface>
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">오늘 근무</p>
          <p className="mt-2 text-[28px] font-semibold text-[#111827]">4명</p>
        </WebSurface>
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">연차 예정</p>
          <p className="mt-2 text-[28px] font-semibold text-[#111827]">2건</p>
        </WebSurface>
        <WebSurface className="p-4">
          <p className="text-[13px] font-semibold text-[#64748b]">확인 필요</p>
          <p className="mt-2 text-[28px] font-semibold text-[#111827]">1건</p>
        </WebSurface>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TableShell columns={["스태프", "담당", "근무시간", "오늘"]}>
          {staff.map((staffMember) => (
            <TableRow
              key={staffMember.name}
              columns={[
                <p key="name" className="text-[15px] font-semibold text-[#111827]">{staffMember.name}</p>,
                <p key="role" className="text-[14px] text-[#64748b]">{staffMember.role}</p>,
                <p key="hours" className="text-[14px] text-[#334155]">{staffMember.hours}</p>,
                <span key="today" className="inline-flex rounded-[8px] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-medium text-[#2f7866]">{staffMember.today}</span>,
              ]}
            />
          ))}
        </TableShell>

        <MiniSection
          title="휴무·연차"
          action={
            <GhostButton
              label={leaveManageMode ? "관리 닫기" : "신청 관리"}
              onClick={() => {
                setLeaveManageMode((current) => !current);
                setStaffNotice(leaveManageMode ? "휴무·연차 신청 관리를 닫았습니다." : "휴무·연차 신청 관리 모드를 열었습니다.");
              }}
            />
          }
        >
          <div className="space-y-2">
            {leaveRows.map((leave) => (
              <div key={`${leave.name}-${leave.date}`} className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[#111827]">{leave.name}</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">{leave.type} · {leave.date}</p>
                  </div>
                  <span className="shrink-0 rounded-[8px] bg-white px-2 py-1 text-[12px] font-medium text-[#334155]">{leave.status}</span>
                </div>
                {leaveManageMode ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setStaffNotice(`${leave.name} 신청을 승인 처리했습니다.`)} className="h-8 rounded-[8px] bg-[#2f7866] px-3 text-[12px] font-semibold text-white">
                      승인
                    </button>
                    <button type="button" onClick={() => setStaffNotice(`${leave.name} 신청을 반려 처리했습니다.`)} className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[12px] font-medium text-[#334155]">
                      반려
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </MiniSection>
      </div>

      {staffNotice ? (
        <div className="rounded-[8px] border border-[#cfded8] bg-[#f6fbf9] px-4 py-3 text-[13px] font-medium text-[#1f6b5b]">
          {staffNotice}
        </div>
      ) : null}

      <MiniSection
        title="주간 근무표"
        action={
          <GhostButton
            label={scheduleEditMode ? "수정 완료" : "근무표 수정"}
            onClick={() => {
              setScheduleEditMode((current) => !current);
              setStaffNotice(scheduleEditMode ? "주간 근무표 수정 내용을 반영했습니다." : "주간 근무표 수정 모드를 열었습니다.");
            }}
          />
        }
      >
        <div className="grid gap-2 lg:grid-cols-5">
          {weekScheduleRows.map((row) => (
            <div key={row.day} className="rounded-[8px] border border-[#e2e8f0] bg-white p-3">
              <p className="text-[15px] font-semibold text-[#111827]">{row.day}</p>
              <div className="mt-3 space-y-2 text-[13px] text-[#64748b]">
                <p>오픈 {row.open}</p>
                <p>미들 {row.mid}</p>
                <p>마감 {row.close}</p>
              </div>
              {scheduleEditMode ? (
                <button type="button" onClick={() => setStaffNotice(`${row.day} 근무표를 선택했습니다.`)} className="mt-3 h-8 w-full rounded-[8px] border border-[#cfded8] bg-[#f6fbf9] text-[12px] font-semibold text-[#1f6b5b]">
                  이 요일 수정
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </MiniSection>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={closeDialog}>
          <div className="w-full max-w-[460px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-[20px] font-semibold text-[#111827]">스태프 추가</h3>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">스태프 카드에 표시할 역할과 기본 근무 시간을 입력합니다.</p>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="스태프 이름">
                <TextInput value={staffForm.name} onChange={(name) => setStaffForm((form) => ({ ...form, name }))} placeholder="예: 민서윤" />
              </Field>
              <Field label="담당/역할">
                <TextInput value={staffForm.role} onChange={(role) => setStaffForm((form) => ({ ...form, role }))} placeholder="예: 목욕 / 위생 미용" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="출근 시간">
                  <TextInput value={staffForm.start} onChange={(start) => setStaffForm((form) => ({ ...form, start }))} type="time" />
                </Field>
                <Field label="퇴근 시간">
                  <TextInput value={staffForm.end} onChange={(end) => setStaffForm((form) => ({ ...form, end }))} type="time" />
                </Field>
              </div>
            </div>

            {formError ? <p className="mt-4 text-[13px] font-medium text-[#b91c1c]">{formError}</p> : null}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <GhostButton label="취소" onClick={closeDialog} />
              <PrimaryButton label="스태프 저장" onClick={addStaff} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
