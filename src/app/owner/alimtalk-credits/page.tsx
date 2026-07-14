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

function ProductOption({ product, selected, onSelect }: { product: AlimtalkCreditProduct; selected: boolean; onSelect: () => void }) {
  const vatAmount = product.price - product.supplyPrice;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-[168px] w-full flex-col overflow-hidden rounded-[10px] border bg-white p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2",
        selected ? "border-[#2563eb] bg-[#fbfdff] shadow-[0_10px_24px_rgba(37,99,235,0.12)]" : "border-white/80 shadow-[0_5px_14px_rgba(37,99,235,0.06)] hover:border-[#bfdbfe]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[19px] font-bold tracking-tight text-[#0f172a]">{product.creditCount.toLocaleString("ko-KR")}건</span>
            {product.badge ? <span className="rounded-md bg-[#e8f1ff] px-2 py-0.5 text-[11px] font-bold text-[#2563eb]">{product.badge}</span> : null}
          </div>
          <p className="mt-1 text-[13px] font-medium text-[#64748b]">건당 <span className="font-bold text-[#2563eb]">{product.unitPriceBeforeVat.toLocaleString("ko-KR")}원</span> · VAT 별도</p>
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
      <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#e5edf6] pt-3 text-[12px]">
        <span className="text-[#64748b]">공급가</span>
        <span className="text-right font-semibold tabular-nums text-[#334155]">{won(product.supplyPrice)}</span>
        <span className="text-[#64748b]">부가세</span>
        <span className="text-right font-semibold tabular-nums text-[#334155]">{won(vatAmount)}</span>
        <span className="border-t border-[#e5edf6] pt-2 font-semibold text-[#334155]">총 결제금액</span>
        <span className="border-t border-[#e5edf6] pt-2 text-right text-[16px] font-bold tabular-nums text-[#2563eb]">{won(product.price)}</span>
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
    <div className="owner-font min-h-screen bg-[#f8fafc] text-[#0f172a] lg:h-screen lg:overflow-hidden">
      <main className="mx-auto flex min-h-screen max-w-[1240px] flex-col px-5 py-4 lg:h-screen lg:min-h-0 lg:px-8 lg:py-5">
        <header className="flex h-9 shrink-0 items-center justify-between gap-3">
          <Link
            href="/owner"
            prefetch
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#64748b] transition hover:bg-white hover:text-[#0f172a]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            운영 홈
          </Link>
        </header>

        <section className="mt-3 rounded-[14px] border border-[#dbe6ff] bg-[#eef3ff] p-5 lg:p-6" aria-labelledby="product-title">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#2563eb]">
                <BellRing className="h-4 w-4" aria-hidden="true" />
                알림톡 충전
              </div>
              <h1 id="product-title" className="mt-2 text-[28px] font-bold tracking-tight text-[#0f172a]">충전할수록 낮아지는 알림톡 단가</h1>
              <p className="mt-1 text-[16px] font-medium text-[#334155]">최대 <span className="font-bold text-[#2563eb]">건당 7원</span></p>
            </div>
            <div className="flex items-center gap-4 rounded-[10px] border border-white bg-white/85 px-4 py-3">
              <div>
                <p id="balance-title" className="text-[12px] font-semibold text-[#64748b]">사용 가능</p>
                <p className="mt-0.5 text-[23px] font-bold tabular-nums tracking-tight text-[#0f172a]">{count(creditSummary?.remaining_total)}<span className="ml-1 text-[12px] font-semibold text-[#64748b]">건</span></p>
              </div>
              <div className="h-9 w-px bg-[#dbe6f2]" aria-hidden="true" />
              <div className="grid gap-1 text-right text-[12px] font-medium text-[#64748b]">
                <span>무료 {count(creditSummary?.included_remaining)}건</span>
                <span>결제 {count(creditSummary?.purchased_remaining)}건</span>
              </div>
            </div>
          </div>

          {message ? (
            <div
              className={cn(
                "mt-3 flex shrink-0 items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] font-medium",
                message.type === "success" ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]" : "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]",
              )}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {message.text}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {alimtalkCreditProducts.map((product) => (
              <ProductOption key={product.id} product={product} selected={selectedProduct.id === product.id} onSelect={() => setSelectedProductId(product.id)} />
            ))}
          </div>

          <aside className="mt-4 flex shrink-0 flex-wrap items-center gap-3 rounded-[10px] border border-white bg-white p-3" aria-label="선택 상품 결제">
            <div className="mr-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-[14px] font-bold text-[#0f172a]">{selectedProduct.creditCount.toLocaleString("ko-KR")}건 선택</p>
              <p className="text-[13px] font-medium text-[#64748b]">공급가 {won(selectedProduct.supplyPrice)}</p>
              <p className="text-[13px] font-medium text-[#64748b]">부가세 {won(selectedProduct.price - selectedProduct.supplyPrice)}</p>
              <p className="text-[18px] font-bold tabular-nums text-[#2563eb]">총 {won(selectedProduct.price)}</p>
            </div>
            <button
              type="button"
              disabled={purchaseLoading}
              onClick={() => void handlePurchase()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] bg-[#2563eb] px-4 text-[14px] font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {purchaseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />}
              결제하기
            </button>
          </aside>
        </section>
      </main>
    </div>
  );
}
