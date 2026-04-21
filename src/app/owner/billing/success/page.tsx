"use client";

import { Check, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { getOwnerPlanByCode, getOwnerPlanDisplayName, type OwnerPlan } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { won } from "@/lib/utils";

const CONFETTI_PIECES = [
  { left: "12%", top: "16%", rotate: -24, color: "#f0c5ad", width: 14, height: 6, delay: "0.08s" },
  { left: "28%", top: "10%", rotate: 32, color: "#1f5b51", width: 12, height: 6, delay: "0.16s" },
  { left: "74%", top: "12%", rotate: -18, color: "#f2a36d", width: 14, height: 6, delay: "0.12s" },
  { left: "86%", top: "20%", rotate: 30, color: "#d7e7e2", width: 12, height: 6, delay: "0.24s" },
  { left: "18%", top: "38%", rotate: -30, color: "#f2a36d", width: 14, height: 6, delay: "0.3s" },
  { left: "82%", top: "42%", rotate: 20, color: "#1f5b51", width: 12, height: 6, delay: "0.34s" },
];

const FIREWORK_BURSTS = [
  { left: "16%", top: "17%", color: "#f2a36d", delay: "0s", size: 118 },
  { left: "82%", top: "16%", color: "#1f5b51", delay: "0.14s", size: 126 },
  { left: "50%", top: "10%", color: "#f0c5ad", delay: "0.06s", size: 148 },
];

const FIREWORK_RAYS = Array.from({ length: 12 }, (_, index) => ({
  angle: index * 30,
  delay: `${index * 0.025}s`,
}));

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function hasSuccessfulPayment(summary: OwnerSubscriptionSummary) {
  return summary.lastPaymentStatus === "paid" || summary.status === "active";
}

function getPlanSelectionLine(plan: OwnerPlan) {
  if (plan.code === "monthly") {
    return "총 12,900원";
  }
  return plan.totalLabel ?? `총 ${won(plan.totalPrice)}`;
}

function getSnapshotPlan(searchParams: Pick<URLSearchParams, "get">) {
  const rawPlanCode = searchParams.get("plan");
  return rawPlanCode ? getOwnerPlanByCode(rawPlanCode) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function OwnerBillingSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [message, setMessage] = useState("결제 내용을 확인하고 있어요.");

  const snapshotPlan = getSnapshotPlan(searchParams);
  const snapshotEndAt = searchParams.get("endAt");
  const snapshotMethod = searchParams.get("method");
  const hasSnapshot = Boolean(snapshotPlan || snapshotEndAt || snapshotMethod);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("결제 내용을 다시 확인해 주세요.");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login?next=/owner/billing/success" as never);
        router.refresh();
        return;
      }

      const maxAttempts = hasSnapshot ? 4 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
            cache: "no-store",
          });

          if (!active) return;

          if (hasSuccessfulPayment(nextSummary)) {
            setSummary(nextSummary);
            setMessage("선택하신 플랜이 정상적으로 적용되었어요.");
            return;
          }
        } catch (error) {
          if (!active) return;
          const nextMessage = error instanceof Error ? error.message : "결제 내용을 다시 불러오지 못했습니다.";
          if (nextMessage === "로그인이 필요합니다.") {
            router.replace("/login?next=/owner/billing/success" as never);
            router.refresh();
            return;
          }
          setMessage(nextMessage);
        }

        if (attempt < maxAttempts - 1) {
          await sleep(700);
        }
      }

      if (!active) return;

      if (!hasSnapshot) {
        setMessage("결제 결과를 다시 확인해 주세요.");
        return;
      }

      setMessage("결제는 완료되었고 상세 정보만 다시 불러오는 중이에요.");
    }

    void load();
    return () => {
      active = false;
    };
  }, [hasSnapshot, router, supabase]);

  const displayPlan = summary?.currentPlan ?? snapshotPlan ?? getOwnerPlanByCode("monthly");
  const displayPlanLabel =
    summary?.currentPlanCode && getOwnerPlanByCode(summary.currentPlanCode)
      ? getOwnerPlanDisplayName(summary.currentPlanCode)
      : snapshotPlan
        ? getOwnerPlanDisplayName(snapshotPlan.code)
        : "플랜";
  const displayEndAt =
    summary?.currentPeriodEndsAt ?? summary?.nextBillingAt ?? snapshotEndAt ?? summary?.trialEndsAt ?? null;
  const displayMethod = summary?.paymentMethodLabel ?? snapshotMethod;

  if (!displayPlan) {
    return <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">{message}</div>;
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#171411]">
      <style jsx global>{`
        @keyframes owner-success-confetti {
          0% {
            opacity: 0;
            transform: translate3d(0, -10px, 0) rotate(0deg) scale(0.8);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, 120px, 0) rotate(160deg) scale(1);
          }
        }

        @keyframes owner-success-flash {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.12);
          }
          16% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.55);
          }
        }

        @keyframes owner-success-ray {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--ray-rotate)) translateY(0) scaleY(0.12);
          }
          16% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--ray-rotate)) translateY(calc(var(--burst-size) * -0.42)) scaleY(1);
          }
        }

        @keyframes owner-success-badge {
          0% {
            transform: scale(0.7);
            opacity: 0;
          }
          60% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <div className="relative min-h-[88vh] overflow-visible">
        <section className="relative z-10 mt-16 overflow-visible rounded-[30px] border border-[#ded6cb] bg-white px-6 pb-6 pt-5 text-center shadow-[0_18px_48px_rgba(33,30,26,0.12)]">
          <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
            {FIREWORK_BURSTS.map((burst) => (
              <div
                key={`${burst.left}-${burst.top}`}
                className="absolute"
                style={{
                  left: burst.left,
                  top: burst.top,
                  width: burst.size,
                  height: burst.size,
                }}
              >
                <span
                  className="absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: Math.round(burst.size * 0.16),
                    height: Math.round(burst.size * 0.16),
                    backgroundColor: burst.color,
                    boxShadow: `0 0 18px ${burst.color}88`,
                    animation: `owner-success-flash 0.72s ease-out ${burst.delay} both`,
                  }}
                />
                {FIREWORK_RAYS.map((ray) => (
                  <span
                    key={`${burst.left}-${burst.top}-${ray.angle}`}
                    className="absolute left-1/2 top-1/2 origin-center rounded-full"
                    style={{
                      "--ray-rotate": `${ray.angle}deg`,
                      "--burst-size": `${burst.size}px`,
                      width: Math.max(3, Math.round(burst.size * 0.032)),
                      height: Math.max(20, Math.round(burst.size * 0.22)),
                      background: `linear-gradient(to top, ${burst.color}00 0%, ${burst.color} 34%, ${burst.color} 72%, ${burst.color}00 100%)`,
                      boxShadow: `0 0 8px ${burst.color}44`,
                      animation: `owner-success-ray 0.78s ease-out calc(${burst.delay} + ${ray.delay}) both`,
                    } as CSSProperties}
                  />
                ))}
              </div>
            ))}

            {CONFETTI_PIECES.map((piece, index) => (
              <span
                key={`${piece.left}-${piece.top}-${index}`}
                className="absolute rounded-full"
                style={{
                  left: piece.left,
                  top: piece.top,
                  width: piece.width,
                  height: piece.height,
                  backgroundColor: piece.color,
                  transform: `rotate(${piece.rotate}deg)`,
                  animation: `owner-success-confetti 2.6s ease-out ${piece.delay} both`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <button
              type="button"
              onClick={() => router.push("/owner")}
              aria-label="닫기"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7f776d]"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#eef7f3] text-[#1f5b51] shadow-[0_14px_30px_rgba(31,91,81,0.12)]"
              style={{ animation: "owner-success-badge 0.72s ease-out both" }}
            >
              <Check className="h-8 w-8" strokeWidth={2.8} />
            </div>

            <p className="mt-5 text-[12px] font-semibold tracking-[0.08em] text-[#5a8d82]">PAYMENT COMPLETE</p>
            <h1 className="mt-3 text-[31px] font-extrabold leading-[1.16] tracking-[-0.04em] text-[#171411]">
              결제가 완료되었습니다
            </h1>
            <p className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-[#173b33]">
              펫매니저를 선택해주셔서 감사합니다.
            </p>
            <p className="mx-auto mt-5 max-w-[296px] whitespace-pre-line text-[14px] leading-[1.58] tracking-[-0.02em] text-[#666056]">
              {"선택하신 플랜이 적용 되어 지금 바로\n서비스를 이용하실 수 있어요"}
            </p>

            <div className="mt-8 rounded-[24px] border border-[#e5ddd2] bg-[#fcfaf6] px-4 py-4 text-left">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#ece4d8] pb-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#7b7369]">적용 플랜</p>
                  <p className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[#173b33]">{displayPlanLabel}</p>
                  <p className="mt-1 text-[13px] text-[#7b7369]">{getPlanSelectionLine(displayPlan)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-[#7b7369]">월 요금</p>
                  <p className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-[#171411]">월 {won(displayPlan.monthlyPrice)}</p>
                </div>
              </div>

              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#7b7369]">서비스 종료일</p>
                  <p className="text-[15px] font-semibold text-[#171411]">{formatDate(displayEndAt)}</p>
                </div>
                {displayMethod ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-medium text-[#7b7369]">결제수단</p>
                    <p className="text-[15px] font-semibold text-[#171411]">{displayMethod}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <p className="mt-6 text-[13px] leading-[1.5] tracking-[-0.02em] text-[#7a736b]">{message}</p>

            <button
              type="button"
              onClick={() => router.push("/owner")}
              className="mt-8 flex h-[58px] w-full items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[17px] font-semibold text-white shadow-[0_12px_28px_rgba(31,91,81,0.18)]"
            >
              확인
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function OwnerBillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">
          결제 내용을 확인하고 있어요.
        </div>
      }
    >
      <OwnerBillingSuccessPageContent />
    </Suspense>
  );
}
