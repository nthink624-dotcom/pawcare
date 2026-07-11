"use client";

import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { alimtalkCreditProducts, type AlimtalkCreditProduct, type AlimtalkCreditProductId } from "@/lib/alimtalk-credit-products";
import { confirmAlimtalkCreditPurchase, requestAlimtalkCreditPurchase } from "@/lib/alimtalk-credit-purchase-client";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { cn, won } from "@/lib/utils";
import type { AlimtalkCreditSummary, BootstrapPayload } from "@/types/domain";

function count(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR");
}

function BalanceStat({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", emphasized ? "border-[#bfdbfe] bg-[#eff6ff]" : "border-[#e2e8f0] bg-white")}>
      <p className="text-xs font-semibold text-[#64748b]">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight", emphasized ? "text-[#1d4ed8]" : "text-[#0f172a]")}>{value}</p>
    </div>
  );
}

function ProductOption({ product, selected, onSelect }: { product: AlimtalkCreditProduct; selected: boolean; onSelect: () => void }) {
  const unitPrice = Math.round(product.price / product.creditCount).toLocaleString("ko-KR");

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-white p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2",
        selected ? "border-[#93c5fd] border-l-[3px] border-l-[#2563eb] shadow-[0_8px_24px_rgba(15,23,42,0.08)]" : "border-[#e2e8f0] hover:border-[#bfdbfe] hover:bg-[#fbfdff]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#0f172a]">{product.title}</span>
            {product.badge ? <span className="rounded-md bg-[#e8f1ff] px-2 py-0.5 text-[11px] font-bold text-[#2563eb]">{product.badge}</span> : null}
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-[#64748b]">{product.description}</p>
        </div>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-[#cbd5e1] bg-white",
          )}
          aria-hidden="true"
        >
          {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-[#eef2f7] pt-4">
        <p className="text-[13px] font-medium text-[#64748b]">건당 {unitPrice}원 · VAT 포함</p>
        <p className="text-xl font-bold tracking-tight text-[#0f172a]">{won(product.price)}</p>
      </div>
    </button>
  );
}

export default function OwnerAlimtalkCreditsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<OwnerSubscriptionSummary | null>(null);
  const [creditSummary, setCreditSummary] = useState<AlimtalkCreditSummary | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<AlimtalkCreditProductId>("credits_3000");
  const [loadingMessage, setLoadingMessage] = useState("알림톡 잔여 건수를 불러오는 중입니다.");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedProduct = useMemo(
    () => alimtalkCreditProducts.find((product) => product.id === selectedProductId) ?? alimtalkCreditProducts[1],
    [selectedProductId],
  );

  async function loadData() {
    const nextSubscription = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", { cache: "no-store" });
    const bootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(
      `/api/bootstrap?shopId=${encodeURIComponent(nextSubscription.shopId)}`,
      { cache: "no-store" },
    );
    setSubscription(nextSubscription);
    setCreditSummary(bootstrap.alimtalkCreditSummary ?? null);
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadData();
        const paymentId = new URLSearchParams(window.location.search).get("paymentId");
        if (!paymentId) return;

        const result = await confirmAlimtalkCreditPurchase(paymentId);
        if (!active) return;
        setCreditSummary(result.summary);
        setMessage({
          type: "success",
          text: result.alreadyProcessed ? "이미 반영된 결제입니다. 현재 잔여 건수를 다시 확인해 주세요." : "알림톡 충전이 완료되었습니다.",
        });
        window.history.replaceState({}, "", "/owner/alimtalk-credits");
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "알림톡 충전 정보를 불러오지 못했습니다.";
        if (nextMessage === "로그인이 필요합니다." || nextMessage.includes("로그인 상태를 확인하지 못했습니다.")) {
          router.replace("/login?next=/owner/alimtalk-credits" as never);
          router.refresh();
          return;
        }
        setLoadingMessage(nextMessage);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [router]);

  async function handlePurchase() {
    if (!subscription || purchaseLoading) return;
    setPurchaseLoading(true);
    setMessage(null);

    try {
      const result = await requestAlimtalkCreditPurchase({
        productId: selectedProduct.id,
        userId: subscription.userId,
        shopId: subscription.shopId,
        customerName: subscription.ownerName || "펫매니저 사장님",
        phoneNumber: subscription.ownerPhoneNumber,
        email: subscription.ownerEmail,
      });
      setCreditSummary(result.summary);
      setMessage({
        type: "success",
        text: result.alreadyProcessed
          ? "이미 반영된 결제입니다. 현재 잔여 건수를 다시 확인해 주세요."
          : `${selectedProduct.creditCount.toLocaleString("ko-KR")}건 충전이 완료되었습니다.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "알림톡 충전에 실패했습니다." });
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (!subscription) {
    return (
      <div className="owner-font min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a]">
        <div className="mx-auto max-w-[1160px] rounded-xl border border-[#e2e8f0] bg-white px-5 py-4 text-sm font-medium text-[#64748b]">
          {loadingMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="owner-font min-h-screen bg-[#f8fafc] px-5 py-6 text-[#0f172a] lg:px-8 lg:py-8">
      <main className="mx-auto max-w-[1160px]">
        <Link
          href="/owner"
          prefetch
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#64748b] transition hover:bg-white hover:text-[#0f172a]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          운영 홈
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-5 border-b border-[#e2e8f0] pb-6 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-[13px] font-bold text-[#2563eb]">
              <BellRing className="h-4 w-4" aria-hidden="true" />
              알림톡 크레딧
            </div>
            <h1 className="mt-2 text-[28px] font-bold tracking-tight text-[#0f172a]">알림톡 충전</h1>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">고객 안내가 끊기지 않도록 필요한 만큼 충전하세요.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
            <ShieldCheck className="h-4 w-4 text-[#1f9d55]" aria-hidden="true" />
            결제 완료 후 즉시 잔여 건수에 반영됩니다.
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:p-6" aria-labelledby="balance-title">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p id="balance-title" className="text-sm font-bold text-[#334155]">현재 사용 가능 건수</p>
              <p className="mt-1 text-[32px] font-bold tracking-tight text-[#0f172a]">
                {count(creditSummary?.remaining_total)}<span className="ml-1 text-base font-semibold text-[#64748b]">건</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[350px]">
              <BalanceStat label="플랜 포함 잔여" value={`${count(creditSummary?.included_remaining)}건`} />
              <BalanceStat label="구매 충전 잔여" value={`${count(creditSummary?.purchased_remaining)}건`} emphasized />
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={cn(
              "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
              message.type === "success" ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]" : "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]",
            )}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {message.text}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section aria-labelledby="product-title">
            <div className="mb-4">
              <h2 id="product-title" className="text-lg font-bold text-[#0f172a]">충전 상품 선택</h2>
              <p className="mt-1 text-[13px] text-[#64748b]">모든 금액은 VAT 포함이며, 충전 건수는 사용 기한 없이 유지됩니다.</p>
            </div>
            <div className="grid gap-3">
              {alimtalkCreditProducts.map((product) => (
                <ProductOption key={product.id} product={product} selected={selectedProduct.id === product.id} onSelect={() => setSelectedProductId(product.id)} />
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-[#dbe6f2] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:sticky lg:top-6" aria-label="선택 상품 결제">
            <p className="text-sm font-bold text-[#334155]">선택한 충전 상품</p>
            <div className="mt-4 rounded-xl bg-[#f8fafc] p-4">
              <p className="text-sm font-bold text-[#0f172a]">{selectedProduct.title}</p>
              <p className="mt-1 text-[13px] text-[#64748b]">{selectedProduct.creditCount.toLocaleString("ko-KR")}건이 구매 충전 잔여에 추가됩니다.</p>
              <div className="mt-4 flex items-end justify-between border-t border-[#e2e8f0] pt-4">
                <span className="text-[13px] font-medium text-[#64748b]">결제 금액</span>
                <span className="text-2xl font-bold tracking-tight text-[#0f172a]">{won(selectedProduct.price)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={purchaseLoading}
              onClick={() => void handlePurchase()}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#2563eb] text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {purchaseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />}
              {selectedProduct.title} 결제하기
            </button>
            <div className="mt-4 flex gap-2 border-t border-[#eef2f7] pt-4 text-xs leading-5 text-[#64748b]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#607080]" aria-hidden="true" />
              <p>성공한 발송은 1건 차감되며, 공급사 전송 실패 건은 자동으로 복구됩니다.</p>
            </div>
          </aside>
        </div>

        <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#e2e8f0] sm:grid-cols-3" aria-label="알림톡 크레딧 안내">
          <div className="bg-white p-4">
            <p className="text-[13px] font-bold text-[#334155]">플랜 포함분</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">다음 결제 주기에 다시 제공되며, 미사용 건수는 이월되지 않습니다.</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[13px] font-bold text-[#334155]">구매 충전분</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">플랜 포함분이 부족할 때 사용되며, 사용 기한이 없습니다.</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[13px] font-bold text-[#334155]">차감 기준</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">성공 발송 1건당 1건이 차감되고 실패 건은 자동 복구됩니다.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
