# Data Safety 공급업체 활성·전송·보관 근거 보완 (r10)

- 업무: `PM_RELEASE_FAST_TRACK_20260908 / 10-production-provider-retention-attestation-r10`
- 확인일: 2026-09-08 KST
- 범위: 소스, 공개 운영 페이지, 비밀 없는 배포 메타데이터, 공식 1차 문서의 읽기 전용 대조
- 제외: 환경변수 값·해시·복사, 고객/DB/Auth 내용, 공급업체 API 호출, 브라우저, Play 입력, 운영 변경·배포
- 판정어: **configured**=현재 운영 활성 근거 있음, **source-only**=호출 코드/환경변수 이름만 있음, **disabled**=현재 운영 비활성 근거 있음, **unknown**=현재 근거로 활성 여부 불명

## 운영·소스 기준선

- Vercel 운영 배포 메타데이터: project `prj_v3zjDSALc0VTY3yLRaNO5Il43uwO`, team `team_049eK6zsAwMJwZnQjREjDc6X`, deployment `dpl_6HPmsSoEThgz6U8gz7WKEpkH6CNe`가 운영 배포 대상으로 확인됨. 환경변수 **이름 목록**은 사용 가능한 메타데이터 응답에서 확인되지 않아 공급업체별 운영 활성 근거로 사용하지 않았다.
- 공식 Supabase changelog(2026-09-08 조회)에는 백업 누락 수정, 복원 후 오래된 DB credential 정리 등 운영 변경이 있으나 이 문서의 공급업체 분류를 뒤집는 breaking change는 확인되지 않았다.
- 공개 운영 개인정보처리방침 `https://www.petmanager.co.kr/privacy`는 2026.09.03/2026-09-03 본문이며 아래 공급업체를 조건부 포함해 공개한다. 반면 현재 저장소 `src/lib/legal/privacy-policy.ts`는 2026-08-05의 축약 본문이라 운영 공개 본문과 정본 불일치 상태다.

## 공급업체별 판정

| 공급업체/경로 | 현재 상태 | 전송 데이터와 기기·백엔드 외 전송 | 전송 암호화 근거 | 역할·보관/삭제 및 제품 정리 | 확정 불가 시 필요한 근거 1개 |
|---|---|---|---|---|---|
| Supabase DB/Auth/Storage | **unknown (source-only)** | 계정, 매장, 직원, 고객, 예약, 결제·알림 메타데이터와 미디어가 서버로 전송되는 데이터 모델 | Supabase shared-responsibility 문서는 전송 중 암호화를 명시 | 제품의 계정삭제 경로는 DB 정리, Auth hard delete, Supabase Storage object 삭제를 수행한다. 공급업체 백업 보관은 플랜별 7/14/30일이며 프로젝트 삭제 시 백업도 제거된다는 공식 문서가 있으나 현재 운영 플랜·PITR 설정은 미확인 | 운영 Supabase 프로젝트의 플랜·PITR/백업 보관 설정을 값 없는 control-plane 증거로 확인 |
| Vercel 호스팅/함수 | **configured** | HTTPS 요청, 함수 입력·응답, 플랫폼 로그에 포함될 수 있는 요청 메타데이터 | Vercel 보안 문서는 TLS 1.3/HTTPS 전송과 AES-256 저장 암호화를 명시 | 현재 team은 Hobby로 관찰되어 Pro/Enterprise에 적용된다고 명시된 현행 Vercel DPA를 그대로 processor 계약 근거로 확정할 수 없다. 로그·배포·백업 보관은 각각 다른 정책이며 실제 프로젝트 설정은 미확인 | 현 Hobby 사용에 적용되는 계약/개인정보 처리 부속서 또는 Pro 전환·DPA 증빙 |
| PortOne 결제 및 NHN KCP PASS | **unknown (source-only)** | 결제 금액·주문·payment/provider order 식별자, 본인확인 입력(이름·생년월일·휴대전화·통신사)과 결과 식별자 | 소스의 PortOne API endpoint는 HTTPS. KCP 공식 개발문서는 본인확인 연동을 확인 | PortOne 약관은 위탁 처리 구조를 설명하고 자체 개인정보처리방침은 결제/계약 5년, 분쟁 3년 등 법정 보관 예시를 공개한다. 그러나 PetManager의 정확한 KCP merchant 계약·PASS 보관/삭제 조건과 실제 활성은 미확인. 제품은 활성 청구/법적 보존을 계정삭제에서 fail-closed 처리 | 현재 merchant 계약의 KCP/PASS 개인정보 처리·보관 부속서 1개 |
| Firebase Cloud Messaging | **unknown (source-only/public-policy)** | push token/Firebase installation ID, event type·generic notification copy가 Google 인프라로 전송될 수 있음 | Firebase 개인정보 문서는 HTTPS 전송 및 FCM 저장 암호화를 명시 | 공식 문서는 Firebase installation ID 삭제 요청 뒤 live/backup 제거가 최대 180일 걸릴 수 있다고 설명. 현재 Production Firebase 프로젝트/빌드 활성 증거는 이 PC 범위에서 확인하지 않음 | 실제 출시 빌드의 Firebase project/config 활성 상태를 값 없는 빌드 증거로 확인 |
| OpenAI price-photo | **unknown (source-only, default-off capable)** | 마스킹·리사이즈된 가격표 이미지 파생물과 추출 지시가 Responses API로 전송될 수 있음 | 소스 endpoint가 `https://api.openai.com/v1/responses` | 소스는 `store:false`를 전송한다. 그러나 OpenAI 공식 data-control 문서상 이것만으로 abuse-monitoring 또는 조직 단위 Zero Data Retention을 증명하지 못하므로 보관 0일 확정 불가. 제품 원본 사진 삭제와 공급업체 보관은 별개 | OpenAI 조직/프로젝트의 ZDR 또는 Modified Abuse Monitoring 적용 상태 1개 |
| Care/slot AI (실제 소스: DeepSeek) | **unknown (source-only)** | 케어 초안·슬롯 추천에 필요한 텍스트, 반려동물/서비스/방문 맥락이 외부 AI API로 전송될 수 있음 | 소스 endpoint가 `https://api.deepseek.com/chat/completions` | 현재 소스에서 care AI의 OpenAI 호출은 확인되지 않았고 DeepSeek 호출이 권위 경로다. 현재 적용되는 DeepSeek API 계약·processor 역할·보관/삭제 공식 근거를 확정하지 못함 | PetManager 계정에 적용되는 DeepSeek API 계약/개인정보 처리 부속서 1개 |
| Cloudflare R2 media | **unknown (source-selectable)** | 업로드 미디어 객체와 object metadata가 R2로 전송될 수 있음 | R2 공식 문서는 TLS 전송과 AES-256 저장 암호화를 명시 | 제품 transient media는 30일 만료·cleanup 대상으로 구현됨. R2 lifecycle은 별도 설정이 필요하며 기본값만으로 30일 삭제를 보장하지 않는다. 또한 현재 terminal account-deletion route의 object 삭제는 Supabase Storage client 직접 호출이라 **R2가 활성일 때 R2 삭제 완료는 미증명** | Production의 `MEDIA_STORAGE_PROVIDER` 선택과 R2 lifecycle/계정삭제 object-cleanup 통합 증거 1개 |
| 브라우저 음성입력 | **unknown** | 마이크 음성과 변환 transcript가 브라우저/OS 음성 서비스로 외부 전송될 수 있음 | Web Speech API 사용만으로 실제 processor·transport를 특정할 수 없음 | PC 소스는 `SpeechRecognition/webkitSpeechRecognition`을 사용하고 자체 raw-audio 업로드 경로는 확인되지 않았다. 실제 브라우저/OS provider와 보관 정책은 배포 환경 의존 | 지원 대상 브라우저/OS의 실제 음성 provider 공식 개인정보·보관 문서 1개 또는 출시 기능 비활성 증거 |
| Billing | **unknown (PortOne source-only)** | 플랜, 결제주기, 금액, order/payment/provider order, billing-key 관련 결과가 결제 backend로 전송될 수 있음 | PortOne backend API는 HTTPS | 제품은 결제 provider 응답과 내부 ledger를 보관하며 활성 billing/법적 보존 시 계정삭제를 막는다. 실제 운영 결제 활성, merchant 법정 보관표, billing-key 삭제 조건은 미확인 | 현재 PortOne merchant 계약/운영 활성 및 billing-key 삭제·보관 문서 1개 |
| Alimtalk (Ssodaa/Kakao) | **unknown (source-only)** | 수신 전화번호, 템플릿/예약·반려동물 관련 메시지, 발송 결과와 내부 credit ledger | endpoint는 환경설정 URL을 사용하며 소스만으로 Production URL의 HTTPS 여부를 확정할 수 없음 | 제품은 중복 방지, opt-out, credit reserve/refund, 발송 이력을 관리하지만 provider 보관·삭제 기간은 미확인 | Ssodaa 계약/DPA와 Production relay/API URL의 `https=true` 보안 boolean 증거 1개 |

## 공식 1차 근거

- Supabase: [shared responsibility / encryption](https://supabase.com/docs/guides/deployment/shared-responsibility-model), [backups](https://supabase.com/docs/guides/platform/backups), [project deletion](https://supabase.com/docs/guides/platform/delete-project)
- Vercel: [security and encryption](https://vercel.com/docs/security/compliance), [deployment retention](https://vercel.com/docs/deployment-retention), [logs](https://vercel.com/docs/logs), [DPA applicability](https://vercel.com/legal/dpa)
- Firebase: [Privacy and Security in Firebase](https://firebase.google.com/support/privacy)
- OpenAI: [API data controls and retention](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
- Cloudflare R2: [data security](https://developers.cloudflare.com/r2/reference/data-security/), [object lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- PortOne/KCP: [PortOne 이용약관](https://terms.portone.io/), [PortOne 개인정보처리방침](https://privacy.portone.io/), [KCP 본인확인 개발 가이드](https://developer.kcp.co.kr/guide/cert)
- Google Play: [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)

## 공개 개인정보처리방침과 차이

1. 공개 운영 본문은 공급업체를 폭넓게 열거하지만 실제 Production 활성 여부, 계약상 processor 역할, 국가·보관기간을 확정하지 않는다. 현재 증거 수준과는 정합하지만 Play의 실제 활성 SDK/전송 기준 답변을 대신할 수 없다.
2. 공개 본문의 “별도의 비로그인 자동 삭제 페이지를 제공하지 않는다”는 설명은 현재 공개 `/account-deletion` 및 비로그인 로그인 CTA와 불일치한다.
3. 저장소 정책 정본은 2026-08-05 축약본이고 운영 공개 본문은 2026-09-03이므로 source/deployment parity가 깨져 있다.
4. R2가 실제 활성이라면 공개 삭제 약속과 terminal account-deletion의 R2 object cleanup 연결을 별도로 증명해야 한다.

최소 수정 범위는 (a) 운영 공개 본문을 저장소의 단일 정본으로 역반영, (b) 외부 계정삭제 페이지 설명 교정, (c) 활성 provider만 표시하는 상태 근거표 유지, (d) R2 활성 시 account-deletion을 storage abstraction으로 연결하고 lifecycle 설정을 검증하는 것이다. 이 단계에서는 수정·배포하지 않았다.

## Play Data Safety 입력 가능 여부

**최종 제출 불가 / 초안 작성 가능.** Google Play는 앱·SDK·WebView를 통해 기기 밖으로 나가는 실제 모든 경로를 신고하고, “전송 중 암호화”는 모든 해당 경로가 암호화될 때만 `예`로 답하도록 요구한다. Vercel/Supabase/R2/Firebase 및 고정 HTTPS API 경로의 기술 근거는 확보했지만, Production 활성 목록과 Alimtalk URL scheme, browser speech provider, DeepSeek/OpenAI 조직 보관 설정, KCP merchant 계약, R2 lifecycle/삭제 통합이 미확인이다. 따라서 provider별 데이터 유형 초안은 만들 수 있으나 암호화·공유·보관·삭제의 최종 boolean은 입력하면 안 된다.

## 소스 증거 해시 (SHA-256)

- `src/lib/server-env.ts`: `C54C8C8E6450D5DDE9897537159730D7ED6C1747FC9D601B29415B0A26668907`
- `src/server/media-storage.ts`: `BB9407852268BA4652448AE8E399CECA1A343851D71CC844DAD3FAA1B9AC3208`
- `src/server/media-service.ts`: `7B0A7BCDBC6D78E3881A532DFE018354140FCDAD7E5E7F6704DA0A73C9608DBE`
- `src/server/price-guide-photo-import.ts`: `C1B4A73999D590925D5A1E17FF54AF99A964CADDA3E8FB255619255B1AAFFCEA`
- `src/server/care-report-ai.ts`: `30BC1785EB13FCFD133A46CE9D942CFA3C41E4AB80BEB48D996BC77347FA7C4D`
- `src/server/alimtalk-provider.ts`: `4B89380212E6572AAB78CAB234A5DA06CA6679EA14266C23DE17CF056C24923F`
- `src/server/owner-billing.ts`: `836F777866602D7F2C28AF15CC7DD47C2A9C6BDD83253BE18F32B70BFE4F30EB`
- `src/app/api/auth/verify-pass/route.ts`: `5B208A79750939F2519CC40ADFFB2D3E88B00040863EFBFDE7817D734068A6BD`
- `src/app/api/owner/account-deletion/route.ts`: `AA5A9947B131F3423A29611D0C9C0F190F58D72F44AD595A16320B6B2BE74E6F`
- `src/components/owner-web/calendar-care-note-input.tsx`: `02D5143EA173423AA08EA000F7CB8A3BA8CA093DAF5B96BB666757DBD61267A1`
- `src/lib/legal/privacy-policy.ts`: `603F9F28F32774580D25E7F0A3D1CD6E86C032EAD1ED7941C87F241C9446F43C`

## 결론과 다음 게이트

- P0: 1건 — 실제 활성 provider/env-name inventory와 모든 외부 경로의 암호화·보관 근거가 닫히지 않아 Play Data Safety 최종 제출 불가.
- P1: 3건 — 공개 삭제 안내 불일치, 정책 source/deployment drift, R2 활성 시 terminal object deletion 미증명.
- 다음 단계: 값 없는 Production provider 활성 inventory 1회, 위 표의 공급업체별 단일 계약/설정 증거 수집, R2 활성 여부에 따른 삭제 경로 판정 후 Data Safety 최종 boolean을 독립 검수한다.
- 외부 쓰기/배포/공급업체 호출/Play 변경: 0.
