"use client";

import { AlertCircle, Ban, CheckCircle2, CreditCard, WalletCards } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { OwnerBillingSuccessCard } from "@/components/owner/owner-billing-flow-shared";
import { OwnerBillingPlanPicker } from "@/components/owner/owner-billing-plan-picker";
import { BillingConsent, PaymentMethodSheet, type PaymentMethodOptionId } from "@/features/billing";
import { billableOwnerPlans, getOwnerPlanDisplayName, type OwnerPlan } from "@/lib/billing/owner-plans";
import { won } from "@/lib/utils";

const PREVIEW_BASE_DATE = new Date("2026-05-04T10:00:00+09:00");

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getBillingCycleLabel(plan: OwnerPlan) {
  return plan.billingType === "one_time" ? "1회 결제" : "매월 자동 결제";
}

function getNextBillingDate(plan: OwnerPlan) {
  if (plan.billingType === "one_time") return "없음";
  return formatDate(addMonths(PREVIEW_BASE_DATE, 1));
}

function getAppliedUntilDate(plan: OwnerPlan) {
  return formatDate(addMonths(PREVIEW_BASE_DATE, plan.months));
}

function getConsentLines(plan: OwnerPlan) {
  if (plan.billingType === "one_time") {
    return [
      "선택한 플랜은 결제 1회로 이용이 시작됩니다.",
      "등록한 카드는 펫매니저 이용요금 결제수단으로 사용됩니다.",
      "카드 등록은 PG사의 보안창을 통해 진행되며, 펫매니저는 카드번호 전체를 직접 저장하지 않습니다.",
    ];
  }

  return [
    "선택한 플랜은 등록된 카드로 매 결제일 자동 결제됩니다.",
    "등록한 카드는 펫매니저 이용요금 결제수단으로 사용됩니다.",
    "카드 등록은 PG사의 보안창을 통해 진행되며, 펫매니저는 카드번호 전체를 직접 저장하지 않습니다.",
  ];
}

function PreviewSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#dfd7ca] bg-white p-5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
      <p className="text-[12px] font-medium tracking-[-0.02em] text-[#1f6b5b]">화면 {step}</p>
      <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[#171411]">{title}</h2>
      <p className="mt-2 text-[13px] leading-[1.55] text-[#6a645d]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProcessCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#e3dbcf] bg-[#fffdfa] p-4">
      <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">{title}</p>
      <p className="mt-1 text-[13px] leading-[1.55] text-[#6b655e]">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-[14px] text-[#6f675d]">{label}</p>
      <p className="text-right text-[15px] tracking-[-0.02em] text-[#171411]">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  primary = false,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex h-[52px] items-center justify-center rounded-[14px] px-4 text-[15px] tracking-[-0.03em] ${
        primary
          ? "bg-[#1f6b5b] font-semibold text-white"
          : "border border-[#ddd5c8] bg-white font-medium text-[#171411]"
      }`}
    >
      {children}
    </button>
  );
}

function PgHandoffCard({ plan }: { plan: OwnerPlan }) {
  return (
    <div className="rounded-[20px] border border-[#e3dbcf] bg-[#fffdfa] p-5">
      <div className="rounded-[14px] border border-[#e6ded2] bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#ddd6ca] bg-[#fffdf8] text-[#1f6b5b]">
            <CreditCard className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">보안창에서 카드 등록이 진행돼요</p>
            <p className="mt-1 text-[13px] leading-[1.6] text-[#6a645d]">
              동의 버튼을 누르면 PortOne/PG 보안창이 열리고, 카드번호와 유효기간, CVC는 해당 보안창에서만 입력됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[#e6ded2] bg-white px-4 py-3.5">
        <Row label="선택 플랜" value={getOwnerPlanDisplayName(plan.code)} />
        <div className="border-t border-[#efe7dc]" />
        <Row label="결제 주기" value={getBillingCycleLabel(plan)} />
      </div>
    </div>
  );
}

export function OwnerBillingProcessPreview() {
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlan["code"]>("yearly");
  const [agreed, setAgreed] = useState(true);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(true);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentMethodOptionId>("saved");
  const sheetTriggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedPlan = useMemo(
    () =>
      billableOwnerPlans.find((plan) => plan.code === selectedPlanCode) ??
      billableOwnerPlans[billableOwnerPlans.length - 1],
    [selectedPlanCode],
  );

  const planLabel = getOwnerPlanDisplayName(selectedPlan.code);
  const nextBillingDate = getNextBillingDate(selectedPlan);
  const appliedUntilDate = getAppliedUntilDate(selectedPlan);
  const previewAmountLabel =
    selectedPlan.billingType === "one_time"
      ? `총 ${won(selectedPlan.totalPrice)}`
      : `월 ${won(selectedPlan.monthlyPrice)}`;

  return (
    <div className="owner-font min-h-screen bg-[#f8f6f2] px-4 py-8 text-[#171411]">
      <div className="mx-auto max-w-[430px]">
        <header className="mb-6">
          <p className="text-[13px] font-medium tracking-[-0.02em] text-[#1f6b5b]">카드사 제출용</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[#171411]">정기결제 프로세스</h1>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#6a645d]">
            플랜 선택부터 정기결제 동의, 카드 등록, 결제 완료, 결제수단 관리, 해지, 결제 실패 안내까지 전체 흐름을 정리한 화면입니다.
          </p>
        </header>

        <div className="space-y-6">
          <PreviewSection
            step={1}
            title="플랜 선택"
            description="실제 오너 플랜 선택 화면입니다. 이용기간, 금액, 결제 주기를 확인한 뒤 원하는 플랜을 고릅니다."
          >
            <div className="overflow-hidden rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa]">
              <OwnerBillingPlanPicker
                plans={billableOwnerPlans}
                selectedPlanCode={selectedPlan.code}
                onSelectPlanCode={setSelectedPlanCode}
                onContinue={() => undefined}
                onBack={() => undefined}
                loading={false}
                message={null}
              />
            </div>
          </PreviewSection>

          <PreviewSection
            step={2}
            title="정기결제 안내 및 동의"
            description="선택한 플랜, 결제 주기, 다음 결제 예정일을 보여주고 정기결제 동의 문구와 체크박스를 함께 노출합니다."
          >
            <div className="overflow-hidden rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa]">
              <BillingConsent
                planLabel={planLabel}
                billingCycleLabel={getBillingCycleLabel(selectedPlan)}
                nextBillingDateLabel={nextBillingDate}
                consentLines={getConsentLines(selectedPlan)}
                agreed={agreed}
                onAgreeChange={setAgreed}
                onContinue={() => undefined}
                onBack={() => undefined}
                continueLabel={
                  selectedPlan.billingType === "one_time" ? "동의하고 결제창 열기" : "동의하고 카드 등록하기"
                }
                message={null}
              />
            </div>
          </PreviewSection>

          <PreviewSection
            step={3}
            title="카드 등록 / 결제수단 선택"
            description="등록된 카드가 없으면 동의 직후 바로 PG 보안창으로 이동하고, 등록된 카드가 있으면 결제수단 선택 바텀시트에서 기존 카드 또는 새 카드 등록을 고를 수 있습니다."
          >
            <div className="space-y-4">
              <ProcessCard
                title="등록 카드가 없는 경우"
                description="중복 확인 화면 없이 동의 직후 바로 보안창으로 연결되는 흐름입니다."
              >
                <PgHandoffCard plan={selectedPlan} />
              </ProcessCard>

              <ProcessCard
                title="등록 카드가 있는 경우"
                description="기존 카드를 바로 사용하거나 새 카드를 등록해 계속 이용할 수 있습니다."
              >
                <div className="rounded-[20px] border border-[#e3dbcf] bg-[#fffdfa] p-4">
                  <button
                    ref={sheetTriggerRef}
                    type="button"
                    onClick={() => setPaymentSheetOpen(true)}
                    className="inline-flex h-[46px] items-center justify-center rounded-[12px] border border-[#ddd5c8] bg-white px-4 text-[14px] font-medium text-[#171411]"
                  >
                    결제수단 선택 시트 보기
                  </button>
                </div>

                <PaymentMethodSheet
                  open={paymentSheetOpen}
                  planLabel={planLabel}
                  amountLabel={previewAmountLabel}
                  nextBillingDateLabel={nextBillingDate}
                  options={[
                    {
                      id: "saved",
                      title: "등록된 카드",
                      description: "하나카드 · •••• 1234",
                    },
                    {
                      id: "new",
                      title: "새 카드 등록",
                      description:
                        selectedPlan.billingType === "one_time"
                          ? "등록 후 바로 결제를 진행합니다."
                          : "등록 후 바로 해당 플랜 결제로 이어집니다.",
                    },
                  ]}
                  selectedOption={selectedPaymentOption}
                  continueLabel="선택한 수단으로 계속하기"
                  returnFocusRef={sheetTriggerRef}
                  onSelectOption={setSelectedPaymentOption}
                  onClose={() => setPaymentSheetOpen(false)}
                  onContinue={() => setPaymentSheetOpen(false)}
                />
              </ProcessCard>
            </div>
          </PreviewSection>

          <PreviewSection
            step={4}
            title="결제 완료 및 플랜 적용"
            description="실제 완료 화면과 동일한 카드로 플랜 적용 완료, 이용기간, 결제수단을 확인할 수 있습니다."
          >
            <div className="overflow-hidden rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa]">
              <OwnerBillingSuccessCard
                plan={selectedPlan}
                endAt={appliedUntilDate.replace(/\./g, "-")}
                paymentMethodLabel="하나카드 ·•••• 1234"
                message="선택하신 플랜이 적용되어 지금 바로 서비스를 이용하실 수 있어요."
                onConfirm={() => undefined}
                onClose={() => undefined}
              />
            </div>
          </PreviewSection>

          <PreviewSection
            step={5}
            title="결제수단 관리"
            description="현재 등록된 카드와 현재 플랜, 다음 결제 예정일을 확인하고 카드 변경을 요청할 수 있는 화면입니다."
          >
            <div className="rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa] p-5">
              <div className="rounded-[14px] border border-[#e6ded2] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <WalletCards className="h-5 w-5 text-[#1f6b5b]" />
                    <div>
                      <p className="text-[15px] font-medium text-[#171411]">현재 등록 카드</p>
                      <p className="mt-1 text-[13px] text-[#6a645d]">하나카드 ·•••• 1234</p>
                    </div>
                  </div>
                  <button type="button" className="text-[14px] font-medium text-[#1f6b5b]">
                    카드 변경
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[14px] border border-[#e6ded2] bg-white px-4 py-3.5">
                <Row label="현재 플랜" value={selectedPlan.title} />
                <div className="border-t border-[#efe7dc]" />
                <Row label="이용기간" value={`${selectedPlan.months}개월 이용`} />
                <div className="border-t border-[#efe7dc]" />
                <Row label="다음 결제 예정일" value={nextBillingDate} />
              </div>
            </div>
          </PreviewSection>

          <PreviewSection
            step={6}
            title="플랜 해지 / 이용 종료"
            description="해지해도 현재 이용기간까지는 사용할 수 있고, 다음 결제일부터 정기결제가 중단된다는 안내를 보여줍니다."
          >
            <div className="rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa] p-5">
              <div className="rounded-[14px] border border-[#e6ded2] bg-[#fffefb] px-4 py-4">
                <div className="flex items-start gap-3">
                  <Ban className="mt-0.5 h-5 w-5 shrink-0 text-[#9f6e45]" />
                  <div className="space-y-1.5 text-[14px] leading-[1.55] text-[#5f5951]">
                    <p className="font-medium text-[#171411]">정기결제를 해지할 수 있어요</p>
                    <p>해지 후에도 현재 이용기간 종료일까지는 서비스를 계속 사용할 수 있습니다.</p>
                    <p>다음 결제일부터는 자동 결제가 중단되며, 추가 청구는 발생하지 않습니다.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <ActionButton primary>해지하기</ActionButton>
                <ActionButton>계속 이용하기</ActionButton>
              </div>
            </div>
          </PreviewSection>

          <PreviewSection
            step={7}
            title="결제 실패 안내"
            description="결제 실패 시 결제수단 변경 또는 다시 결제를 진행할 수 있고, 미결제 상태가 지속되면 서비스 이용이 제한될 수 있음을 안내합니다."
          >
            <div className="rounded-[22px] border border-[#e5ddd1] bg-[#fffdfa] p-5">
              <div className="rounded-[14px] border border-[#ead8cf] bg-[#fffaf7] px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#b45845]" />
                  <div className="space-y-1.5 text-[14px] leading-[1.55] text-[#61574f]">
                    <p className="font-medium text-[#171411]">이번 결제를 완료하지 못했어요</p>
                    <p>등록된 카드 한도 또는 유효기간을 확인한 뒤 다시 결제를 진행해 주세요.</p>
                    <p>미결제 상태가 지속되면 서비스 이용이 제한될 수 있습니다.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <ActionButton>결제수단 변경</ActionButton>
                <ActionButton primary>다시 결제</ActionButton>
              </div>
            </div>
          </PreviewSection>

          <div className="rounded-[22px] border border-[#e4dccf] bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6b5b]" />
              <div className="text-[13px] leading-[1.6] text-[#5e5750]">
                <p className="font-medium text-[#171411]">심사자료 기재 안내</p>
                <p className="mt-1">
                  카드번호 전체와 CVC는 PG 보안창에서만 입력되며, 펫매니저는 빌링용 마스킹 카드 정보만 관리하는 구조로 안내합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
