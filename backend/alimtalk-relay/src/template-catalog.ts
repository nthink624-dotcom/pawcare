/** Read every provider page. A repeated/incomplete page is an error, never a partial catalog. */
export async function collectTemplatePages<T>(
  fetchPage: (page: number, count: number) => Promise<{ records: T[]; totalPage?: number; totalCount?: number }>,
  key: (record: T) => string,
) {
  const records = new Map<string, T>();
  const count = 100;
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, count);
    const before = records.size;
    for (const row of result.records) {
      const code = key(row);
      if (!code) throw new Error("Invalid provider template identity");
      records.set(code, row);
    }
    if (result.totalPage !== undefined ? page >= result.totalPage : result.records.length < count) {
      if (result.totalCount !== undefined && records.size !== result.totalCount) throw new Error("Incomplete provider template catalog");
      return [...records.values()];
    }
    if (records.size === before) throw new Error("Provider template pagination did not advance");
  }
}

export async function mapTemplateDetails<T, R>(rows: T[], concurrency: number, read: (row: T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid template concurrency");
  const results = new Array<R>(rows.length);
  let cursor = 0;
  let failure: { error: unknown } | undefined;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (cursor < rows.length && !failure) {
      const index = cursor++;
      try { results[index] = await read(rows[index]); }
      catch (error) { failure = { error }; }
    }
  }));
  if (failure) throw failure.error;
  return results;
}

/** One in-flight refresh for all callers; failures are not cached or replaced by stale approvals. */
export function sharedTemplateCatalog<T>(load: () => Promise<T>, ttlMs: number, now = Date.now) {
  let cached: { value: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && now() < cached.expires) return Promise.resolve(cached.value);
    if (!pending) pending = load().then(value => {
      cached = { value, expires: now() + ttlMs };
      return value;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

/** A bounded cache/pool shared across targeted HTTP requests. No global provider listing is required. */
export function targetedTemplateReader<T>(load: (code: string) => Promise<T>, ttl: (value: T) => number, now = Date.now) {
  const cache = new Map<string, { value: T; expires: number }>();
  const pending = new Map<string, Promise<T>>();
  const queue: Array<() => void> = [];
  let active = 0;
  const acquire = () => new Promise<void>(resolve => {
    if (active < 6) { active++; resolve(); } else queue.push(resolve);
  });
  const release = () => { const next = queue.shift(); if (next) next(); else active--; };
  return {
    invalidate: (code: string) => { cache.delete(code); },
    read: (code: string): Promise<T> => {
      const hit = cache.get(code);
      if (hit && hit.expires > now()) return Promise.resolve(hit.value);
      const inFlight = pending.get(code);
      if (inFlight) return inFlight;
      if (pending.size >= 1_024) return Promise.reject(new Error("Template lookup queue is busy"));
      const task = (async () => {
        await acquire();
        try {
          const value = await load(code);
          cache.delete(code);
          cache.set(code, { value, expires: now() + ttl(value) });
          while (cache.size > 5_000) cache.delete(cache.keys().next().value!);
          return value;
        } finally { release(); }
      })().finally(() => pending.delete(code));
      pending.set(code, task);
      return task;
    },
  };
}
