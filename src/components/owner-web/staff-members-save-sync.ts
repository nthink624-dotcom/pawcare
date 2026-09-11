export type StaffMembersChangeOptions = {
  deferEssentialRefresh?: boolean;
};

export type StaffMembersChangeResult = {
  backgroundRefresh: Promise<void>;
};

export async function saveStaffMembersWithDeferredRefresh<T>({
  patch,
  verifyAcknowledged,
  applyAcknowledged,
  refresh,
}: {
  patch: () => Promise<T>;
  verifyAcknowledged?: (acknowledged: T) => boolean;
  applyAcknowledged: (acknowledged: T) => void;
  refresh: () => Promise<void>;
}): Promise<StaffMembersChangeResult> {
  const acknowledged = await patch();
  if (verifyAcknowledged && !verifyAcknowledged(acknowledged)) {
    throw new Error("저장 결과에서 개인 칩 색과 프로필 멘트를 확인하지 못했습니다. 입력 내용은 유지했습니다.");
  }
  applyAcknowledged(acknowledged);
  return { backgroundRefresh: refresh() };
}
