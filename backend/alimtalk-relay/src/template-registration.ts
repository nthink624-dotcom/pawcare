export type RegistrationTemplateSnapshot = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  buttons: Array<{ type: string | null; name: string | null; linkMobile: string | null; linkPc: string | null }>;
};

export type RegistrationRequest = {
  templateCode: string;
  templateName: string;
  templateContent: string;
  buttons: Array<{ buttonType: string; buttonName: string; linkMobile: string; linkPc?: string | null }>;
  requestReview: boolean;
};

export class TemplateRegistrationError extends Error {
  constructor(
    readonly stage: "lookup" | "conflict" | "review" | "status",
    readonly registered: boolean | null,
    readonly reviewRequested: boolean,
    readonly retryable: boolean,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

function matchesSnapshot(existing: RegistrationTemplateSnapshot, input: RegistrationRequest) {
  const expectedButtons = input.buttons.map(button => ({
    type: button.buttonType,
    name: button.buttonName,
    linkMobile: button.linkMobile,
    linkPc: button.linkPc || button.linkMobile,
  }));
  return existing.templateCode === input.templateCode
    && existing.templateName === input.templateName
    && existing.templateContent === input.templateContent
    && existing.buttons.length === expectedButtons.length
    && expectedButtons.every((button, index) => {
      const actual = existing.buttons[index];
      return actual?.type === button.type && actual.name === button.name
        && actual.linkMobile === button.linkMobile && actual.linkPc === button.linkPc;
    });
}

/** Idempotently resumes a provider registration after an interrupted owner request. */
export async function registerTemplateSafely(input: RegistrationRequest, operations: {
  find: (code: string) => Promise<RegistrationTemplateSnapshot | null>;
  add: () => Promise<unknown>;
  requestReview: () => Promise<unknown>;
}) {
  let existing: RegistrationTemplateSnapshot | null;
  try {
    existing = await operations.find(input.templateCode);
  } catch {
    throw new TemplateRegistrationError("lookup", null, false, true, "쏘다 등록 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.");
  }

  let registered = Boolean(existing);
  if (existing) {
    if (!matchesSnapshot(existing, input)) {
      throw new TemplateRegistrationError("conflict", true, false, false, "같은 등록 요청의 내용이 쏘다에 저장된 내용과 달라 안전을 위해 중단했습니다.", 409);
    }
    const state = existing.inspectionStatus?.trim().toUpperCase();
    if (["REQ", "ING", "APR"].includes(state ?? "")) {
      return { registered: true, reviewRequested: true, alreadySubmitted: true };
    }
    if (state === "REJ") {
      throw new TemplateRegistrationError("status", true, false, false, "쏘다에서 반려된 문안입니다. 내용을 수정해 새 문안으로 다시 요청해 주세요.", 409);
    }
    if (state !== "REG") {
      throw new TemplateRegistrationError("status", true, false, true, "쏘다 등록 상태를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.");
    }
  } else {
    try {
      await operations.add();
      registered = true;
    } catch {
      // The provider may have committed the add even if its response was lost.
      throw new TemplateRegistrationError("lookup", null, false, true, "쏘다 등록 결과를 확인하지 못했습니다. 상태를 다시 확인하면 중복 등록 없이 이어집니다.");
    }
  }

  if (!input.requestReview) return { registered, reviewRequested: false, alreadySubmitted: false };
  try {
    await operations.requestReview();
    return { registered: true, reviewRequested: true, alreadySubmitted: false };
  } catch {
    throw new TemplateRegistrationError("review", true, false, true, "문안 등록은 됐지만 검수 요청 결과를 확인하지 못했습니다. 상태를 다시 확인해 이어서 처리할 수 있습니다.");
  }
}
