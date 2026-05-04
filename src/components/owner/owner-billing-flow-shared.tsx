"use client";

import { Check, CheckCircle2, CreditCard, X } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

import { getOwnerPlanDisplayName, type OwnerPlan } from "@/lib/billing/owner-plans";
import { addMonthsIso } from "@/lib/billing/owner-subscription";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function getPlanSelectionLine(plan: OwnerPlan) {
  if (plan.code === "monthly") {
    return "총 12,900원";
  }
  return plan.totalLabel ?? `총 ${won(plan.totalPrice)}`;
}

function getRecurringBillingDate(plan: OwnerPlan, anchorIso?: string | null) {
  if (plan.billingType === "one_time") return null;
  return formatDate(addMonthsIso(anchorIso ?? new Date().toISOString(), 1));
}

function BillingSectionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-[13px] text-[#6f675d]">{label}</p>
      <p className="text-right text-[14px] font-medium tracking-[-0.02em] text-[#171411]">{value}</p>
    </div>
  );
}

function BillingActionButton({
  children,
  primary = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[54px] items-center justify-center rounded-[14px] px-4 text-[15px] tracking-[-0.03em] disabled:opacity-60 ${
        primary
          ? "bg-[#1f5b51] font-semibold text-white"
          : "border border-[#ddd5c8] bg-white font-medium text-[#171411]"
      }`}
    >
      {children}
    </button>
  );
}

export function OwnerBillingAgreementStep({
  selectedPlan,
  agreed,
  onAgreeChange,
  onContinue,
  onBack,
  loading = false,
  message = null,
  title = "정기결제 안내 및 동의",
}: {
  selectedPlan: OwnerPlan;
  agreed: boolean;
  onAgreeChange: (next: boolean) => void;
  onContinue: () => void;
  onBack?: () => void;
  loading?: boolean;
  message?: string | null;
  title?: string;
}) {
  const nextBillingDate = getRecurringBillingDate(selectedPlan);

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-7 text-[#171411]">
      <section className="rounded-[24px] border border-[#e1dacd] bg-[#fffdf8] px-5 pb-6 pt-5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
        <p className="text-[13px] font-medium tracking-[-0.02em] text-[#1f5b51]">정기결제 동의</p>
        <h1 className="mt-2 text-[29px] font-semibold leading-[1.1] tracking-[-0.05em] text-[#171411]">{title}</h1>

        <div className="mt-5 rounded-[14px] border border-[#e6ded2] bg-white px-4 py-3.5">
          <BillingSectionRow label="선택 플랜" value={getOwnerPlanDisplayName(selectedPlan.code)} />
          <div className="border-t border-[#efe7dc]" />
          <BillingSectionRow
            label="결제 주기"
            value={selectedPlan.billingType === "one_time" ? "1회 결제" : "매월 자동 결제"}
          />
          <div className="border-t border-[#efe7dc]" />
          <BillingSectionRow label="다음 결제 예정일" value={nextBillingDate ?? "없음"} />
        </div>

        <div className="mt-4 rounded-[18px] border border-[#e6ded2] bg-[#fffefb] px-4 py-4">
          <div className="space-y-1.5 text-[13px] leading-[1.55] tracking-[-0.02em] text-[#5e5750]">
            {selectedPlan.billingType === "one_time" ? (
              <>
                <p>선택한 플랜은 현재 결제 1회로 이용이 시작됩니다.</p>
                <p>등록한 카드는 펫매니저 이용요금 결제수단으로 사용됩니다.</p>
                <p>카드 등록은 PG사의 보안창을 통해 진행되며, 펫매니저는 카드번호 전체를 직접 저장하지 않습니다.</p>
              </>
            ) : (
              <>
                <p>선택한 플랜은 등록된 카드로 매 결제일 자동 결제됩니다.</p>
                <p>등록한 카드는 펫매니저 이용요금 결제수단으로 사용됩니다.</p>
                <p>카드 등록은 PG사의 보안창을 통해 진행되며, 펫매니저는 카드번호 전체를 직접 저장하지 않습니다.</p>
              </>
            )}
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-[14px] border border-[#e3dbcf] bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => onAgreeChange(event.target.checked)}
              className="h-[18px] w-[18px] rounded border-[#cfc6b7] text-[#1f5b51] focus:ring-[#1f5b51]"
            />
            <span className="text-[14px] tracking-[-0.02em] text-[#171411]">위 정기결제 안내에 동의합니다.</span>
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          <BillingActionButton primary disabled={loading || !agreed} onClick={onContinue}>
            {selectedPlan.billingType === "one_time" ? "동의하고 결제수단 선택" : "동의하고 카드 등록으로 이동"}
          </BillingActionButton>
          {onBack ? <BillingActionButton onClick={onBack}>이전 단계로</BillingActionButton> : null}
        </div>

        {message ? (
          <p className="mt-4 rounded-[14px] border border-[#d8d1c5] bg-white px-4 py-3 text-[14px] leading-[1.55] text-[#4a4640]">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function OwnerBillingCardRegistrationStep({
  selectedPlan,
  onContinue,
  onBack,
  loading = false,
  message = null,
}: {
  selectedPlan: OwnerPlan;
  onContinue: () => void;
  onBack?: () => void;
  loading?: boolean;
  message?: string | null;
}) {
  const usesOneTimePayment = selectedPlan.billingType === "one_time";

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-7 text-[#171411]">
      <section className="rounded-[20px] border border-[#e1dacd] bg-[#fffdf8] px-5 pb-6 pt-5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
        <p className="text-[13px] font-medium tracking-[-0.02em] text-[#1f5b51]">카드 등록</p>
        <h1 className="mt-2 text-[29px] font-semibold leading-[1.1] tracking-[-0.05em] text-[#171411]">
          결제카드를 등록해 주세요
        </h1>

        <div className="mt-5 rounded-[14px] border border-[#e6ded2] bg-white px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#ddd6ca] bg-[#fffdf8] text-[#1f5b51]">
              <CreditCard className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">보안창에서 카드 등록이 진행돼요</p>
              <p className="mt-1 text-[13px] leading-[1.6] text-[#6a645d]">
                카드 등록하기를 누르면 PG사의 보안창이 열리고, 카드번호와 유효기간, CVC는 해당 보안창에서만 입력됩니다.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[12px] border border-[#e6ded2] bg-[#fffefb] px-4 py-3.5">
          <BillingSectionRow label="선택 플랜" value={getOwnerPlanDisplayName(selectedPlan.code)} />
          <div className="border-t border-[#efe7dc]" />
          <BillingSectionRow label="총 결제" value={getPlanSelectionLine(selectedPlan)} />
        </div>

        <div className="mt-4 rounded-[14px] border border-[#e6ded2] bg-[#fffefb] px-4 py-4 text-[13px] leading-[1.6] text-[#5e5750]">
          펫매니저는 카드번호 전체를 직접 저장하지 않으며, 카드사 심사 기준에 맞춰 PG사 보안창과 빌링키만 이용합니다.
        </div>

        <div className="mt-5 grid gap-3">
          <BillingActionButton primary disabled={loading} onClick={onContinue}>
            {loading ? "처리 중..." : usesOneTimePayment ? "결제창 열기" : "카드 등록하기"}
          </BillingActionButton>
          {onBack ? <BillingActionButton onClick={onBack}>이전 단계로</BillingActionButton> : null}
        </div>

        {message ? (
          <p className="mt-4 rounded-[12px] border border-[#d8d1c5] bg-white px-4 py-3 text-[14px] leading-[1.55] text-[#4a4640]">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

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

export function OwnerBillingSuccessCard({
  plan,
  endAt,
  paymentMethodLabel,
  message,
  onConfirm,
  onClose,
}: {
  plan: OwnerPlan;
  endAt: string | null;
  paymentMethodLabel?: string | null;
  message: string;
  onConfirm?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#171411]">
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
                    style={
                      {
                        "--ray-rotate": `${ray.angle}deg`,
                        "--burst-size": `${burst.size}px`,
                        width: Math.max(3, Math.round(burst.size * 0.032)),
                        height: Math.max(20, Math.round(burst.size * 0.22)),
                        background: `linear-gradient(to top, ${burst.color}00 0%, ${burst.color} 34%, ${burst.color} 72%, ${burst.color}00 100%)`,
                        boxShadow: `0 0 8px ${burst.color}44`,
                        animation: `owner-success-ray 0.78s ease-out calc(${burst.delay} + ${ray.delay}) both`,
                      } as CSSProperties
                    }
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
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7f776d]"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}

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
                  <p className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[#173b33]">
                    {getOwnerPlanDisplayName(plan.code)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#7b7369]">{getPlanSelectionLine(plan)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-[#7b7369]">월 요금</p>
                  <p className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-[#171411]">
                    월 {won(plan.monthlyPrice)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#7b7369]">서비스 종료일</p>
                  <p className="text-[15px] font-semibold text-[#171411]">{formatDate(endAt)}</p>
                </div>
                {paymentMethodLabel ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-medium text-[#7b7369]">결제수단</p>
                    <p className="text-[15px] font-semibold text-[#171411]">{paymentMethodLabel}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <p className="mt-6 text-[13px] leading-[1.5] tracking-[-0.02em] text-[#7a736b]">{message}</p>

            <button
              type="button"
              onClick={onConfirm}
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
