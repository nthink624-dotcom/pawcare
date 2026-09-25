import type { RefObject } from "react";

export type BillingConsentProps = {
  eyebrow?: string;
  title?: string;
  planLabel: string;
  billingCycleLabel: string;
  nextBillingDateLabel: string;
  consentLines: string[];
  checkboxLabel?: string;
  agreed: boolean;
  loading?: boolean;
  message?: string | null;
  continueLabel: string;
  backLabel?: string;
  onAgreeChange: (next: boolean) => void;
  onContinue: () => void;
  onBack?: () => void;
  continueButtonRef?: RefObject<HTMLButtonElement | null>;
};

export type PaymentMethodOptionId = "saved" | "new";

export type PaymentMethodOption = {
  id: PaymentMethodOptionId;
  title: string;
  description: string;
  disabled?: boolean;
};

export type PaymentMethodSheetProps = {
  open: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  closeLabel?: string;
  planLabel: string;
  amountLabel: string;
  nextBillingDateLabel: string;
  options: PaymentMethodOption[];
  selectedOption: PaymentMethodOptionId;
  loading?: boolean;
  continueLabel: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onSelectOption: (optionId: PaymentMethodOptionId) => void;
  onClose: () => void;
  onContinue: () => void;
};
