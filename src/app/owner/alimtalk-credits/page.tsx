"use client";

import { BellRing, CheckCircle2, ChevronLeft, CreditCard, Loader2, ShieldCheck, Zap } from "lucide-react";
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

function getPerCreditLabel(product: AlimtalkCreditProduct) {
  return `${Math.round(product.price / product.creditCount).toLocaleString("ko-KR")}원/건`;
}

function BalanceCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "dark";
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border px-4 py-3",
        tone === "blue"
          ? "border-[#bcd6ff] bg-[#eff6ff]"
          : tone === "dark"
            ? "border-[#1e293b] bg-[#0f172a] text-white"
            : "border-[#e2e8f0] bg-white",
      )}
    >
      <p className={cn("text-[12px] font-semibold", tone === "dark" ? "text-[#cbd5e1]" : "text-[#64748b]")}>{label}</p>
      <p className={cn("mt-1 text-[24px] font-bold tracking-normal", tone === "blue" ? "text-[#2563eb]" : tone === "dark" ? "text-white" : "text-[#0f172a]")}>
        {value}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  selected,
  loading,
  onSelect,
  onPurchase,
}: {
  product: AlimtalkCreditProduct;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
  onPurchase: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative flex min-h-[238px] cursor-pointer flex-col rounded-[14px] border bg-white p-5 transition",
        selected
          ? "border-[#2563eb] shadow-[0_22px_52px_rgba(37,99,235,0.20)]"
          : "border-[#dbe6f2] shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:border-[#9ec0f5]",
      )}
    >
      {product.badge ? (
        <span className="absolute right-4 top-4 rounded-full bg-[#2563eb] px-3 py-1 text-[12px] font-bold text-white">
          {product.badge}
        </span>
      ) : null}
      <div>
        <p className="text-[15px] font-bold text-[#0f172a]">{product.title}</p>
        <p className="mt-2 text-[13px] font-medium leading-5 text-[#64748b]">{product.description}</p>
      </div>
      <div className="mt-6">
        <p className="text-[38px] font-bold leading-none tracking-normal text-[#0f172a]">{count(product.creditCount)}</p>
        <p className="mt-1 text-[13px] font-semibold text-[#64748b]">알림톡 {getPerCreditLabel(product)}, VAT 포함</p>
      </div>
      <div className="mt-auto border-t border-[#e5edf5] pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-[#64748b]">결제 금액</span>
          <span className="text-[22px] font-bold text-[#2563eb]">{won(product.price)}</span>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={(event) => {
            event.stopPropagation();
            onPurchase();
          }}
          className={cn(
            "mt-4 inline-flex h-11 w-full items-center justify-center rounded-[10px] text-[14px] font-bold transition disabled:opacity-60",
            selected ? "bg-[image:var(--pm-brand-blue-button-gradient)] text-white" : "bg-[#eef4ff] text-[#2563eb]",
          )}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />}
          충전하기
        </button>
      </div>
    </article>
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
    const nextSubscription = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
      cache: "no-store",
    });
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
        if (paymentId) {
          const result = await confirmAlimtalkCreditPurchase(paymentId);
          if (!active) return;
          setCreditSummary(result.summary);
          setMessage({
            type: "success",
            text: result.alreadyProcessed
              ? "이미 반영된 결제입니다. 현재 잔여 건수를 다시 확인했어요."
              : "알림톡 충전이 완료되었습니다.",
          });
          window.history.replaceState({}, "", "/owner/alimtalk-credits");
        }
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "알림톡 충전 정보를 불러오지 못했습니다.";
        if (nextMessage === "로그인이 필요합니다." || nextMessage.includes("로그인 상태를 확인하지 못했습니다")) {
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

  async function handlePurchase(product: AlimtalkCreditProduct) {
    if (!subscription || purchaseLoading) return;
    setSelectedProductId(product.id);
    setPurchaseLoading(true);
    setMessage(null);

    try {
      const result = await requestAlimtalkCreditPurchase({
        productId: product.id,
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
          ? "이미 반영된 결제입니다. 현재 잔여 건수를 다시 확인했어요."
          : `${product.creditCount.toLocaleString("ko-KR")}건 충전이 완료되었습니다.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "알림톡 충전에 실패했습니다.",
      });
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (!subscription) {
    return (
      <div className="owner-font min-h-screen bg-[image:var(--pm-brand-blue-page-gradient)] px-5 py-6 text-[#0f172a]">
        <div className="mx-auto max-w-[960px] rounded-[14px] border border-[#dbe6f2] bg-white px-5 py-4 text-[14px] font-semibold text-[#64748b]">
          {loadingMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="owner-font min-h-screen bg-[image:var(--pm-brand-blue-page-gradient)] px-5 py-5 text-[#0f172a]">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href="/owner"
            prefetch
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#dbe6f2] bg-white px-3 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            오너 화면
          </Link>
        </div>

        <section className="overflow-hidden rounded-[18px] border border-[#cfe0f5] bg-white shadow-[0_24px_72px_rgba(37,99,235,0.14)]">
          <div className="grid gap-6 bg-[image:var(--pm-brand-blue-soft-gradient)] px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[12px] font-bold text-[#2563eb]">
                <BellRing className="h-4 w-4" aria-hidden="true" />
                알림톡 충전
              </div>
              <h1 className="mt-4 text-[34px] font-bold leading-tight tracking-normal text-[#0f172a]">
                잔여 건수가 부족해도
                <br />
                고객 안내가 끊기지 않게 충전하세요
              </h1>
              <p className="mt-3 max-w-[620px] text-[15px] font-medium leading-7 text-[#475569]">
                플랜 포함 알림톡은 매월 초기화되고, 별도로 구매한 알림톡은 소진 전까지 유지됩니다. 발송 성공 시 1건 차감되며 실패한 발송은 복구됩니다.
              </p>
            </div>
            <div className="grid gap-3">
              <BalanceCard label="총 잔여" value={`${count(creditSummary?.remaining_total)}건`} tone="dark" />
              <div className="grid grid-cols-2 gap-3">
                <BalanceCard label="플랜 포함 잔여" value={`${count(creditSummary?.included_remaining)}건`} />
                <BalanceCard label="구매 잔여" value={`${count(creditSummary?.purchased_remaining)}건`} tone="blue" />
              </div>
            </div>
          </div>

          <div className="px-6 py-6 lg:px-8">
            {message ? (
              <div
                className={cn(
                  "mb-5 flex items-start gap-3 rounded-[12px] border px-4 py-3 text-[14px] font-semibold",
                  message.type === "success"
                    ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                    : "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]",
                )}
              >
                {message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Zap className="mt-0.5 h-4 w-4 shrink-0" />}
                {message.text}
              </div>
            ) : null}

            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-[#0f172a]">충전 상품 선택</h2>
                <p className="mt-1 text-[13px] font-medium text-[#64748b]">모든 금액은 VAT 포함이며, 결제 완료 후 구매 잔여 건수로 충전됩니다.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#dbe6f2] bg-[#f8fafc] px-3 py-2 text-[12px] font-bold text-[#475569]">
                <ShieldCheck className="h-4 w-4 text-[#2563eb]" aria-hidden="true" />
                결제 성공 확인 후 지급
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {alimtalkCreditProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={selectedProduct.id === product.id}
                  loading={purchaseLoading && selectedProduct.id === product.id}
                  onSelect={() => setSelectedProductId(product.id)}
                  onPurchase={() => void handlePurchase(product)}
                />
              ))}
            </div>

            <div className="mt-5 rounded-[12px] border border-[#e2e8f0] bg-[#fbfdff] px-4 py-4">
              <div className="grid gap-3 text-[13px] font-medium leading-5 text-[#64748b] lg:grid-cols-3">
                <p>
                  <span className="font-bold text-[#0f172a]">플랜 포함분</span>
                  <br />
                  다음 결제 주기에 다시 제공되며 남은 건수는 이월되지 않습니다.
                </p>
                <p>
                  <span className="font-bold text-[#0f172a]">구매 충전분</span>
                  <br />
                  사용 전까지 유지되고, 플랜 포함분이 부족할 때 이어서 사용됩니다.
                </p>
                <p>
                  <span className="font-bold text-[#0f172a]">발송 차감</span>
                  <br />
                  성공 발송은 1건 차감, 공급자 실패는 자동 복구됩니다.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
