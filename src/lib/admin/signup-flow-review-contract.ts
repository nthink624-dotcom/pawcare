export type SignupFlowCaptureId =
  | "terms"
  | "account"
  | "shop"
  | "validation-error"
  | "duplicate-email"
  | "reused-identity";

export type SignupFlowReviewItem = {
  id: string;
  group: "happy_path" | "important_state";
  stepNumber: number | null;
  screenName: string;
  purpose: string;
  route: string;
  primaryCta: string;
  nextStep: string;
  status: "captured" | "not_captured" | "implementation_waiting";
  captureId?: SignupFlowCaptureId;
  captureUrl?: string;
  source: "actual_local_capture" | "source_inventory";
  viewport: "390x844" | null;
  pixelDimensions: "780x1688" | null;
  deviceScaleFactor: 2 | null;
  fixture: true;
  note?: string;
};

export type SignupFlowReviewManifest = {
  generatedAt: string | null;
  inventoryCount: number;
  capturedInventoryCount: number;
  items: SignupFlowReviewItem[];
};

export const signupFlowCaptureIds: SignupFlowCaptureId[] = [
  "terms",
  "account",
  "shop",
  "validation-error",
  "duplicate-email",
  "reused-identity",
];

export const signupFlowReviewItems: SignupFlowReviewItem[] = [
  {
    id: "step-1-terms",
    group: "happy_path",
    stepNumber: 1,
    screenName: "약관 동의",
    purpose: "필수·선택 약관을 구분하고 가입 진행 동의를 받습니다.",
    route: "/signup",
    primaryCta: "계속하기",
    nextStep: "계정 정보",
    status: "captured",
    captureId: "terms",
    captureUrl: "/admin/reviews/signup-flow/assets/terms.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
  },
  {
    id: "step-2-account",
    group: "happy_path",
    stepNumber: 2,
    screenName: "계정 정보",
    purpose: "이메일과 비밀번호를 확인한 뒤 KCP 본인인증을 시작합니다.",
    route: "/signup",
    primaryCta: "다음",
    nextStep: "KCP 본인인증 후 매장 정보",
    status: "captured",
    captureId: "account",
    captureUrl: "/admin/reviews/signup-flow/assets/account.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
  },
  {
    id: "step-3-shop",
    group: "happy_path",
    stepNumber: 3,
    screenName: "매장 정보",
    purpose: "인증된 가입자와 연결할 매장명·연락처·주소를 입력합니다.",
    route: "/signup",
    primaryCta: "가입 완료",
    nextStep: "세션이 있으면 오너 화면, 없으면 로그인 화면",
    status: "captured",
    captureId: "shop",
    captureUrl: "/admin/reviews/signup-flow/assets/shop.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
    note: "현재 코드에는 가입 완료 전용 페이지가 없고 성공 후 이동만 있습니다.",
  },
  {
    id: "state-validation-error",
    group: "important_state",
    stepNumber: null,
    screenName: "필드 검증 오류",
    purpose: "이메일·비밀번호 입력 오류를 필드 가까이에서 안내합니다.",
    route: "/signup",
    primaryCta: "다음",
    nextStep: "오류 수정 후 본인인증",
    status: "captured",
    captureId: "validation-error",
    captureUrl: "/admin/reviews/signup-flow/assets/validation-error.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
  },
  {
    id: "state-duplicate-email",
    group: "important_state",
    stepNumber: null,
    screenName: "중복 이메일",
    purpose: "이미 사용 중인 이메일을 가입 전에 차단합니다.",
    route: "/signup",
    primaryCta: "다음",
    nextStep: "다른 이메일 입력",
    status: "captured",
    captureId: "duplicate-email",
    captureUrl: "/admin/reviews/signup-flow/assets/duplicate-email.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
  },
  {
    id: "state-reused-identity",
    group: "important_state",
    stepNumber: null,
    screenName: "기존 가입자 안내",
    purpose: "이미 가입된 본인인증 정보로 신규 체험 계정을 만들지 않도록 안내합니다.",
    route: "/signup",
    primaryCta: "다음",
    nextStep: "이메일 찾기 또는 비밀번호 찾기",
    status: "captured",
    captureId: "reused-identity",
    captureUrl: "/admin/reviews/signup-flow/assets/reused-identity.png",
    source: "actual_local_capture",
    viewport: "390x844",
    pixelDimensions: "780x1688",
    deviceScaleFactor: 2,
    fixture: true,
  },
  ...[
    ["state-ai-price-partial", "AI 요금표 일부 인식", "분석 결과 일부만 인식된 상태"],
    ["state-ai-price-error", "AI 요금표 분석 오류", "사진 분석 실패 상태"],
    ["state-ai-price-manual", "요금표 수동 복구", "자동 분석에서 직접 입력으로 전환한 상태"],
  ].map(([id, screenName, purpose]): SignupFlowReviewItem => ({
    id,
    group: "important_state",
    stepNumber: null,
    screenName,
    purpose,
    route: "/owner/services",
    primaryCta: "없음",
    nextStep: "회원가입 경로 연결 계약 필요",
    status: "implementation_waiting",
    source: "source_inventory",
    viewport: null,
    pixelDimensions: null,
    deviceScaleFactor: null,
    fixture: true,
    note: "현재 실제 회원가입 route/component에는 포함되지 않아 이미지 없이 구현 대기로 표시합니다.",
  })),
];

export function buildSignupFlowReviewManifest(generatedAt: string | null): SignupFlowReviewManifest {
  const inventory = signupFlowReviewItems.filter((item) => item.group === "happy_path");
  return {
    generatedAt,
    inventoryCount: inventory.length,
    capturedInventoryCount: inventory.filter((item) => item.status === "captured").length,
    items: signupFlowReviewItems,
  };
}
