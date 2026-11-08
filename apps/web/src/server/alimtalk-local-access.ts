export const LOCAL_ALIMTALK_READ_ONLY_MESSAGE = "로컬 조회 모드에서는 검수 요청이나 실제 알림톡 발송을 사용할 수 없습니다.";

export function isLocalAlimtalkReadOnly() {
  return process.env.ALIMTALK_RELAY_ACCESS_MODE === "read-only";
}

export function assertAlimtalkMutationAllowed() {
  if (isLocalAlimtalkReadOnly()) throw new Error(LOCAL_ALIMTALK_READ_ONLY_MESSAGE);
}
