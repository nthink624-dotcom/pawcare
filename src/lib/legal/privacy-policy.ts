import { LEGAL_BUSINESS_INFO, LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export const PUBLIC_PRIVACY_POLICY = `개인정보처리방침
시행일자: 2026년 3월 31일

${LEGAL_OPERATOR_NAME}(이하 "회사")는 ${LEGAL_SERVICE_NAME} 서비스 운영과 관련하여 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.

1. 수집하는 개인정보 항목
- 필수: 아이디, 비밀번호, 이름, 생년월일, 휴대폰번호, 매장명, 매장 주소
- 자동수집: 접속 IP, 로그인 기록, 기기 및 브라우저 정보, 쿠키, 서비스 이용 기록

2. 개인정보 이용 목적
- 회원 가입 및 본인확인
- 서비스 제공, 고객 응대, 고지사항 전달
- 부정 이용 방지, 계정 보호, 서비스 개선

3. 보유 및 이용 기간
- 회원 탈퇴 시까지
- 단, 관련 법령에 따라 보관이 필요한 경우 해당 기간동안 보관합니다.

4. 개인정보 처리 위탁
회사는 원활한 결제 및 본인인증 연동 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.
- 수탁업체: ${LEGAL_BUSINESS_INFO.privacyTrusteeName}
- 위탁업무: ${LEGAL_BUSINESS_INFO.privacyTrusteeTask}

5. 이용자의 권리
이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.

6. 문의처
- 운영주체: ${LEGAL_OPERATOR_NAME}
- 고객센터: ${LEGAL_BUSINESS_INFO.customerServicePhone}
- 이메일: ${LEGAL_BUSINESS_INFO.customerServiceEmail}`;
