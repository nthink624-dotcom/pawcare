/** PostgREST caps each response. Callers must scope and order the query before paging. */
export async function readAlimtalkRows<T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await readPage(from, from + size - 1);
    if (result.error || !result.data) throw new Error("알림톡 저장 정보를 확인하지 못했습니다.");
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}
