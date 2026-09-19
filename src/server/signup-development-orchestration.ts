export type SignupRequestRecord = {
  requestId: string;
  payloadHash: string;
  status: "claimed" | "auth_created" | "completed" | "compensation_pending" | "failed_compensated";
  authUserId: string | null;
  shopId: string | null;
  trialEligible: boolean | null;
  trialDays: 0 | 14 | 44 | null;
  billingRequired: boolean | null;
};

export class SignupFlowError extends Error {
  public readonly code:
    | "PAYLOAD_MISMATCH"
    | "REQUEST_IN_PROGRESS"
    | "AUTH_CREATE_FAILED"
    | "ATOMIC_WRITE_FAILED"
    | "COMPENSATION_PENDING";

  public readonly status: number;

  constructor(
    code:
      | "PAYLOAD_MISMATCH"
      | "REQUEST_IN_PROGRESS"
      | "AUTH_CREATE_FAILED"
      | "ATOMIC_WRITE_FAILED"
      | "COMPENSATION_PENDING",
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type AtomicSignupResult = {
  shopId: string;
  reused: boolean;
  trialEligible: boolean;
  trialDays: 0 | 14 | 44;
  billingRequired: boolean;
};

export type SignupOrchestrationDependencies = {
  claimRequest: (input: { requestId: string; payloadHash: string }) => Promise<{
    action: "claimed" | "completed" | "in_progress" | "compensation_pending" | "payload_mismatch";
    record: SignupRequestRecord | null;
  }>;
  createAuthUser: () => Promise<{ userId: string }>;
  markAuthCreated: (input: { requestId: string; payloadHash: string; authUserId: string }) => Promise<void>;
  writeAtomicSignup: (authUserId: string) => Promise<AtomicSignupResult>;
  deleteAuthUser: (authUserId: string) => Promise<boolean>;
  markCompensationPending: (input: {
    requestId: string;
    payloadHash: string;
    authUserId: string;
    reason: string;
  }) => Promise<void>;
  markFailureCompensated: (input: {
    requestId: string;
    payloadHash: string;
    reason: string;
  }) => Promise<void>;
};

export async function orchestrateDevelopmentSignup(input: {
  requestId: string;
  payloadHash: string;
  dependencies: SignupOrchestrationDependencies;
}) {
  const claim = await input.dependencies.claimRequest({ requestId: input.requestId, payloadHash: input.payloadHash });
  const previous = claim.record;
  if (claim.action === "payload_mismatch" || (previous && previous.payloadHash !== input.payloadHash)) {
    throw new SignupFlowError(
      "PAYLOAD_MISMATCH",
      "같은 요청 번호로 다른 가입 내용이 전송되었습니다. 처음부터 다시 확인해 주세요.",
      409,
    );
  }
  if (claim.action === "completed" && previous?.status === "completed" && previous.shopId) {
    if (
      typeof previous.trialEligible !== "boolean" ||
      (previous.trialDays !== 0 && previous.trialDays !== 14 && previous.trialDays !== 44) ||
      typeof previous.billingRequired !== "boolean"
    ) {
      throw new SignupFlowError(
        "ATOMIC_WRITE_FAILED",
        "기존 가입 요청의 체험 상태를 확인하지 못했습니다. 운영팀에 문의해 주세요.",
        503,
      );
    }
    return {
      authUserId: previous.authUserId,
      shopId: previous.shopId,
      reused: true,
      trialEligible: previous.trialEligible,
      trialDays: previous.trialDays,
      billingRequired: previous.billingRequired,
    };
  }
  if (claim.action === "in_progress" || claim.action === "compensation_pending") {
    throw new SignupFlowError(
      claim.action === "in_progress" ? "REQUEST_IN_PROGRESS" : "COMPENSATION_PENDING",
      claim.action === "in_progress"
        ? "같은 회원가입 요청을 처리하고 있습니다. 잠시 후 다시 시도해 주세요."
        : "이전 실패를 안전하게 정리하고 있습니다. 운영 확인 후 다시 시도해 주세요.",
      409,
    );
  }

  let authUserId: string;
  try {
    authUserId = (await input.dependencies.createAuthUser()).userId;
  } catch (cause) {
    await input.dependencies.markFailureCompensated({
      requestId: input.requestId,
      payloadHash: input.payloadHash,
      reason: "AUTH_CREATE_FAILED",
    });
    throw new SignupFlowError(
      "AUTH_CREATE_FAILED",
      cause instanceof Error ? cause.message : "계정을 만들지 못했습니다.",
      409,
    );
  }

  try {
    await input.dependencies.markAuthCreated({
      requestId: input.requestId,
      payloadHash: input.payloadHash,
      authUserId,
    });
    const result = await input.dependencies.writeAtomicSignup(authUserId);
    return { authUserId, ...result };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "원자적 가입 저장에 실패했습니다.";
    const deleted = await input.dependencies.deleteAuthUser(authUserId);
    if (!deleted) {
      await input.dependencies.markCompensationPending({
        requestId: input.requestId,
        payloadHash: input.payloadHash,
        authUserId,
        reason,
      });
      throw new SignupFlowError(
        "COMPENSATION_PENDING",
        "가입 저장에 실패했고 생성된 계정 정리가 필요합니다. 운영팀이 확인할 수 있도록 기록했습니다.",
        503,
      );
    }
    await input.dependencies.markFailureCompensated({
      requestId: input.requestId,
      payloadHash: input.payloadHash,
      reason,
    });
    if (reason.includes("PM_SIGNUP_PAYLOAD_MISMATCH")) {
      throw new SignupFlowError(
        "PAYLOAD_MISMATCH",
        "같은 요청 번호로 다른 가입 내용이 전송되었습니다. 처음부터 다시 확인해 주세요.",
        409,
      );
    }
    if (reason.includes("PM_SIGNUP_DUPLICATE_EMAIL")) {
      throw new SignupFlowError(
        "ATOMIC_WRITE_FAILED",
        "이미 사용 중인 이메일입니다.",
        409,
      );
    }
    if (reason.includes("PM_SIGNUP_EXISTING_PARTIAL_DATA")) {
      throw new SignupFlowError(
        "ATOMIC_WRITE_FAILED",
        "기존 가입 데이터가 일부 남아 있어 자동으로 덮어쓰지 않았습니다. 운영팀에 확인해 주세요.",
        409,
      );
    }
    throw new SignupFlowError("ATOMIC_WRITE_FAILED", "가입 정보를 저장하지 못했습니다. 다시 시도해 주세요.", 503);
  }
}
