// An additional client guard during presentation of a local snapshot.
// Server authentication, membership, billing and booking validation remain authoritative.
let nextLease = 0;
const pending = new Set<number>();
let revision = 0;

export function getOwnerStartupRevision() { return revision; }
export function invalidateOwnerStartupRevision() { revision += 1; }

export function beginOwnerStartupReadOnly() {
  const lease = ++nextLease;
  pending.add(lease);
  return () => { pending.delete(lease); };
}

export function assertOwnerStartupWriteReady(method = "GET") {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  if (pending.size && mutation) {
    throw new Error("최신 예약·이용 상태를 확인 중입니다. 입력 내용은 유지되니 잠시 후 저장해 주세요.");
  }
  if (mutation) invalidateOwnerStartupRevision();
}
