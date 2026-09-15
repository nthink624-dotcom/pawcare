export class OwnerMobileStartupTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? "앱을 불러오는 데 시간이 오래 걸리고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.");
    this.name = "OwnerMobileStartupTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function withOwnerMobileTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new OwnerMobileStartupTimeoutError(timeoutMs, timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (!controller.signal.aborted) controller.abort();
  }
}

function ownerMobileNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export async function traceOwnerMobileStartupStep<T>(step: string, work: () => Promise<T>): Promise<T> {
  const startedAt = ownerMobileNow();

  try {
    const result = await work();
    console.info("[owner-mobile-startup]", {
      step,
      outcome: "success",
      durationMs: Math.round(ownerMobileNow() - startedAt),
    });
    return result;
  } catch (error) {
    console.warn("[owner-mobile-startup]", {
      step,
      outcome: "failure",
      durationMs: Math.round(ownerMobileNow() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

type OwnerMobileCriticalLoadOptions<TShop, TSubscription, TBootstrap> = {
  signal: AbortSignal;
  loadShops: (signal: AbortSignal) => Promise<TShop[]>;
  loadSubscription?: ((signal: AbortSignal) => Promise<TSubscription>) | null;
  loadBootstrap: (shopId: string, signal: AbortSignal) => Promise<TBootstrap>;
  resolveShopId: (shops: TShop[]) => string | null;
};

type OwnerMobileSettledResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export async function loadOwnerMobileCriticalData<TShop, TSubscription, TBootstrap>({
  signal,
  loadShops,
  loadSubscription,
  loadBootstrap,
  resolveShopId,
}: OwnerMobileCriticalLoadOptions<TShop, TSubscription, TBootstrap>) {
  const subscriptionPromise: Promise<OwnerMobileSettledResult<TSubscription>> | null = loadSubscription
    ? loadSubscription(signal).then(
        (value) => ({ ok: true, value }),
        (error: unknown) => ({ ok: false, error }),
      )
    : null;
  const shops = await loadShops(signal);
  const shopId = resolveShopId(shops);
  if (!shopId) throw new Error("소유한 매장이 없습니다.");

  const bootstrapPromise = loadBootstrap(shopId, signal);
  const [subscriptionResult, bootstrap] = subscriptionPromise
    ? await Promise.all([subscriptionPromise, bootstrapPromise])
    : [null, await bootstrapPromise] as const;
  if (subscriptionResult && !subscriptionResult.ok) throw subscriptionResult.error;

  return {
    shops,
    shopId,
    subscription: subscriptionResult?.ok ? subscriptionResult.value : null,
    bootstrap,
  };
}
