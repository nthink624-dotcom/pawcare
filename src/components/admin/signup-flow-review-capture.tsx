"use client";

import { useState } from "react";

import SignupRedesignView, { type SignupProfileStage } from "@/components/auth/signup-redesign-view";
import type { SignupFlowCaptureId } from "@/lib/admin/signup-flow-review-contract";
import type { OwnerSignupTermId } from "@/lib/auth/owner-signup-terms";

const emptyFields = {
  name: "",
  phoneNumber: "",
  email: "",
  password: "",
  passwordConfirm: "",
  shopName: "",
  shopPhone: "",
  shopAddress: "",
};

const emptyAgreements: Record<OwnerSignupTermId, boolean> = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

type CaptureState = {
  stage: SignupProfileStage;
  message: string | null;
  emailStatus?: { text: string; tone: "error" };
  passwordStatus?: { text: string; tone: "error" };
};

function captureState(id: SignupFlowCaptureId): CaptureState {
  const stage: SignupProfileStage = id === "terms" ? "terms" : id === "shop" ? "shop" : "account";
  if (id === "validation-error") {
    return {
      stage,
      message: "입력 정보를 다시 확인해 주세요.",
      emailStatus: { text: "올바른 이메일 주소를 입력해 주세요.", tone: "error" as const },
      passwordStatus: { text: "영문·숫자·특수문자를 포함해 8자 이상 입력해 주세요.", tone: "error" as const },
    };
  }
  if (id === "duplicate-email") {
    return {
      stage,
      message: "이미 사용 중인 이메일입니다.",
      emailStatus: { text: "이미 사용 중인 이메일입니다.", tone: "error" as const },
    };
  }
  if (id === "reused-identity") {
    return {
      stage,
      message: "이미 가입된 계정이 있어요. 이메일 찾기 또는 비밀번호 찾기를 이용해 주세요.",
    };
  }
  return { stage, message: null };
}

export default function SignupFlowReviewCapture({ captureId }: { captureId: SignupFlowCaptureId }) {
  const fixture = captureState(captureId);
  const [fields, setFields] = useState(emptyFields);
  const [agreements, setAgreements] = useState(emptyAgreements);

  return (
    <div data-review-fixture="true" data-capture-id={captureId}>
      <SignupRedesignView
        stage={fixture.stage}
        fields={fields}
        agreements={agreements}
        shopDetailAddress=""
        shopPhoneSameAsOwner={false}
        loading={false}
        message={fixture.message}
        emailStatus={fixture.emailStatus}
        passwordStatus={fixture.passwordStatus}
        onBack={() => undefined}
        onChangeField={(key, value) => setFields((current) => ({ ...current, [key]: value }))}
        onChangeAgreement={(id, checked) => setAgreements((current) => ({ ...current, [id]: checked }))}
        onChangeShopDetailAddress={() => undefined}
        onChangeShopPhoneSameAsOwner={() => undefined}
        onContinueTerms={() => undefined}
        onNextAccount={() => undefined}
        onOpenAddress={() => undefined}
        onSubmit={() => undefined}
      />
    </div>
  );
}
