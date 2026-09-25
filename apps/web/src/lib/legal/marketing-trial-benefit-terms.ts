import {
  OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
  OWNER_MARKETING_TRIAL_BENEFIT_CODE,
} from "@/lib/auth/owner-signup-terms";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export const MARKETING_TRIAL_BENEFIT_TERMS = `마케팅 수신 동의 30일 추가 체험 안내
문서 버전: ${OWNER_MARKETING_CONSENT_DOCUMENT_VERSION}
시행일자: 2026년 9월 14일

1. 혜택 내용
신규 회원가입에서 필수 약관과 분리된 「마케팅 정보 수신 동의」를 선택한 매장은 기본 14일 무료 체험에 30일을 추가하여 총 44일을 이용할 수 있습니다.

2. 지급 조건과 시점
- 신규 가입 완료 시 선택 동의가 유효해야 합니다.
- 계정, 대상 shop_id, 동의 감사 기록과 기본 체험이 서버에서 함께 확정된 후 지급합니다.
- 혜택 코드: ${OWNER_MARKETING_TRIAL_BENEFIT_CODE}
- 지급 일수: 30일

3. 최초 1회와 중복 방지
혜택은 매장 1곳당 최초 1회만 지급합니다. 같은 가입 요청의 반복, 동의 철회 후 재동의, 탈퇴 후 재가입 또는 중복 요청으로 다시 지급하지 않습니다. 기존 가입자에게 소급 지급하지 않습니다.

4. 동의 철회
PC 설정 또는 ${LEGAL_OPERATOR_NAME} 고객센터에서 언제든지 마케팅 수신 동의를 철회할 수 있습니다. 철회 후 ${LEGAL_SERVICE_NAME}의 이후 마케팅 발송 대상에서 즉시 제외됩니다. 이미 확정된 30일 혜택은 회수하지 않으며 체험 종료일도 앞당기지 않습니다.

5. 미동의 불이익 없음
마케팅 동의는 선택 사항입니다. 동의하지 않아도 회원가입, 기본 14일 무료 체험과 핵심 서비스 이용에 불이익이 없습니다.`;
