export const OWNER_LOGIN_ROUTE_TIMEOUT_MS = 12_000;
export const OWNER_LOGIN_CLIENT_TIMEOUT_MS = 15_000;

export class OwnerLoginTimeoutError extends Error {
  constructor() {
    super("OWNER_LOGIN_TIMEOUT");
    this.name = "OwnerLoginTimeoutError";
  }
}

export async function withOwnerLoginTimeout<T>(
  work: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OwnerLoginTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(work(controller.signal)), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
