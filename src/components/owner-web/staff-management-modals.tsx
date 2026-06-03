import { Field, StaffDraftForm, StaffModal, TextInput } from "@/components/owner-web/staff-management-ui";
import { GhostButton, PrimaryButton, SoftSelect } from "@/components/owner-web/owner-web-ui";
import type { LeaveType, StaffDraft, StaffMember } from "@/components/owner-web/staff-management-model";

type LeaveDraft = {
  staffId: string;
  date: string;
  type: LeaveType;
  period: "오전" | "오후";
  reason: string;
};

type AnnualLeaveGrantDraft = {
  days: string;
};

function StaffModalActionButton({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary
        ? "h-12 rounded-[8px] bg-[#2f7866] text-[16px] font-normal text-white"
        : "h-12 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] font-normal text-[#334155]"}
    >
      {label}
    </button>
  );
}

export function StaffAddModal({
  draft,
  onDraftChange,
  onClose,
  onAdd,
}: {
  draft: StaffDraft;
  onDraftChange: (draft: StaffDraft) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <StaffModal title="직원 추가" onClose={onClose}>
      <StaffDraftForm draft={draft} onChange={onDraftChange} />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <GhostButton label="취소" onClick={onClose} />
        <PrimaryButton label="추가" onClick={onAdd} />
      </div>
    </StaffModal>
  );
}

export function StaffLeaveModal({
  staff,
  draft,
  onDraftChange,
  onClose,
  onSave,
}: {
  staff: StaffMember[];
  draft: LeaveDraft;
  onDraftChange: (updater: (current: LeaveDraft) => LeaveDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <StaffModal title="휴무/연차 등록" onClose={onClose}>
      <div className="space-y-3">
        <Field label="직원명">
          <SoftSelect
            value={draft.staffId}
            onChange={(staffId) => onDraftChange((current) => ({ ...current, staffId }))}
            options={staff.map((item) => ({ value: item.id, label: item.name }))}
            align="left"
            buttonClassName="h-10"
            valueClassName="text-[16px] font-normal"
          />
        </Field>
        <Field label="요청 날짜">
          <TextInput type="date" value={draft.date} onChange={(date) => onDraftChange((current) => ({ ...current, date }))} />
        </Field>
        <Field label="유형">
          <SoftSelect<LeaveType>
            value={draft.type}
            onChange={(type) => onDraftChange((current) => ({ ...current, type }))}
            options={[
              { value: "휴무", label: "휴무" },
              { value: "연차", label: "연차" },
              { value: "반차", label: "반차" },
            ]}
            align="left"
            buttonClassName="h-10"
            valueClassName="text-[16px] font-normal"
          />
        </Field>
        {draft.type === "반차" ? (
          <Field label="반차 구분">
            <SoftSelect<"오전" | "오후">
              value={draft.period}
              onChange={(period) => onDraftChange((current) => ({ ...current, period }))}
              options={[
                { value: "오전", label: "오전 반차" },
                { value: "오후", label: "오후 반차" },
              ]}
              align="left"
              buttonClassName="h-10"
              valueClassName="text-[16px] font-normal"
            />
          </Field>
        ) : null}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <StaffModalActionButton label="취소" onClick={onClose} />
        <StaffModalActionButton label="등록" onClick={onSave} primary />
      </div>
    </StaffModal>
  );
}

export function StaffAnnualLeaveGrantModal({
  staffCount,
  draft,
  onDraftChange,
  onClose,
  onSave,
}: {
  staffCount: number;
  draft: AnnualLeaveGrantDraft;
  onDraftChange: (draft: AnnualLeaveGrantDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <StaffModal title="연차 일괄 부여" onClose={onClose}>
      <div className="space-y-3 text-[16px]">
        <Field label="부여 연차">
          <TextInput type="number" value={draft.days} onChange={(days) => onDraftChange({ ...draft, days })} placeholder="예: 15" />
        </Field>
        <p className="text-[16px] leading-6 text-[#64748b]">활성 직원 {staffCount}명에게 같은 연차 잔여일을 적용합니다.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <StaffModalActionButton label="취소" onClick={onClose} />
        <StaffModalActionButton label="일괄 부여" onClick={onSave} primary />
      </div>
    </StaffModal>
  );
}
