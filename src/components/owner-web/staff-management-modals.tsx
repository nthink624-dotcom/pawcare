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
            />
          </Field>
        ) : null}
        <Field label="사유">
          <TextInput value={draft.reason} onChange={(reason) => onDraftChange((current) => ({ ...current, reason }))} placeholder="예: 개인 일정" />
        </Field>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <GhostButton label="취소" onClick={onClose} />
        <PrimaryButton label="등록" onClick={onSave} />
      </div>
    </StaffModal>
  );
}
