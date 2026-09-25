# Android 출시 심사·개인정보·Data safety 초안

- 업무: `PM_MOBILE_ANDROID_PRODUCTION_RELEASE_20260901` / Stage 03
- 작성일: 2026-09-02 (KST)
- 상태: **제출 초안 — P0 해소 전 Play Console 제출 금지**
- 범위: `D:\petmanager-app` Android 앱과 `D:\petmanager` 공용 backend의 현재 소스만 읽어 작성. 계정 생성·AAB/Console 제출·외부 전송·제품 소스 수정은 하지 않았다.

## 1. 판정과 기준

### 현재 판정

| 항목 | 판정 | 이유 |
| --- | --- | --- |
| 개인정보처리방침 공개 | 불가 | 운영 PC 정책과 모바일 정책의 시행일·내용이 다르고, 실제 고객/반려동물/사진/푸시/AI 처리와 삭제 경로가 충분히 공개되지 않았다. |
| Google Play Data safety | 초안 가능, 제출 불가 | 실제 데이터 유형은 파악했으나 Stage 1 삭제·보존과 Stage 2 운영 AAB/FCM/PASS/전송암호화 최종값이 미확정이다. |
| App access | 초안 가능, 제출 불가 | 비식별 심사 계정과 재현 가능한 PASS/로그인 방법이 없다. |

### 사실 상태 표기

- **CURRENT EVIDENCE**: 현재 저장소에서 직접 확인한 사실.
- **Stage 1 final value pending**: 오너 계정 삭제와 법정 보존 matrix가 확정·운영 적용되기 전에는 제출 답을 확정할 수 없는 항목.
- **Stage 2 final value pending**: 운영 Android AAB/환경/PASS callback/FCM 설정이 실제 검증되기 전에는 제출 답을 확정할 수 없는 항목.

## 2. 데이터 인벤토리

| 처리 항목 | 실제 데이터·목적 | CURRENT EVIDENCE | 외부 전송/수탁 후보 | 제출 상태 |
| --- | --- | --- | --- | --- |
| 오너 계정·인증 | 이메일, 비밀번호(인증 서비스), 이름, 생년월일, 휴대폰번호, 매장명·주소, 사용자 ID, 로그인 세션. 가입·로그인·계정 보호·본인확인. | `src/lib/auth/owner-signup-terms.ts`, `supabase/migrations/202603290001_owner_profiles.sql`, `D:\petmanager-app/src/app/api/auth/signup/route.ts` | Supabase(Auth/DB), PortOne 본인확인 | CURRENT, 보존·삭제는 Stage 1 pending |
| PASS 본인확인 | 이름, 생년월일, 휴대폰번호, PortOne 인증 ID/상태, CI·DI가 저장 가능한 schema. 중복가입·본인확인. | `src/server/owner-identity-verification.ts`, `supabase/migrations/202604230001_owner_identity_verification_security.sql`, `D:\petmanager-app/src/app/api/auth/verify-pass/route.ts` | PortOne, PASS 연동사 | CURRENT 설계; 운영 PASS 503은 Stage 2 pending |
| 매장·직원 운영 정보 | 매장 정보, 영업시간, 휴무, 직원 프로필·근무 정보, 서비스/가격/소요시간. 예약 운영. | `supabase/migrations/202603160001_init.sql`, `D:\petmanager-app/src/components/owner/owner-settings-panel.tsx` | Supabase | CURRENT |
| 고객·반려동물·예약 | 보호자 이름·전화번호·메모, 반려동물 이름/품종/생일/메모, 예약 일시·서비스·상태·메모, 미용 기록/결과. 매장 운영과 예약 제공. | `supabase/migrations/202603160001_init.sql`, `D:\petmanager-app/src/components/owner/owner-app.tsx`, `D:\petmanager-app/src/app/api/payments/complete-booking/route.ts` | Supabase; 알림 발송이 실제 켜진 경우 알림톡 제공자 | CURRENT; 알림 제공자·보존은 pending |
| 사진·카메라 | 매장/직원/반려동물/미용 전후·결과·가격표 사진 및 파일 메타데이터. 사진 저장·표시·일부 고객 공유. CAMERA 권한은 선택 기능. | `D:\petmanager-app/android/app/src/main/AndroidManifest.xml`, `supabase/migrations/202605180003_media_assets_and_notification_attachments.sql`, `src/lib/media/owner-media-client.ts` | Supabase Storage; OpenAI 가격표 사진 분석을 사용·활성화한 경우 OpenAI | CURRENT; AI 실제 운영 활성 여부·국외 이전은 pending |
| 결제·구독 | 월 구독 상태, 결제 ID, 결제 금액/상태/일시, 암호화된 billing key 가능 값. 구독 결제·환불·부정 방지. 원 카드번호는 제품 DB에 저장하지 않는 구조이나 PG 처리 확인 필요. | `src/server/owner-billing.ts`, `supabase/migrations/202604210001_owner_billing_security.sql`, `D:\petmanager-app/src/app/api/payments/complete-booking/route.ts` | PortOne/NHN KCP, Supabase | CURRENT; 보존 matrix는 Stage 1 pending |
| 푸시 기기 정보 | FCM 토큰, 임의 기기 ID, 플랫폼, 앱 ID/버전, 언어, 시간대, 알림 환경설정. 새 예약 알림. | `D:\petmanager-app/src/lib/push/owner-push-notifications.ts`, `D:\petmanager-app/src/app/api/owner/push-tokens/route.ts`, `D:\petmanager-app/supabase/migrations/202606300001_owner_push_tokens.sql` | Firebase Cloud Messaging, Supabase | 코드 존재. FCM 운영 credential·AAB 연결은 Stage 2 pending |
| AI 처리 | 예약 가능 시간 후보의 순위, 케어 리포트 텍스트, 가격표 사진. AI 초안/추천. 실제 API key·기능 활성화 여부에 따라 전송. | `src/server/ai-slot-recommendations.ts`, `src/server/care-report-ai.ts`, `src/server/price-guide-photo-import.ts` | DeepSeek, OpenAI | CURRENT 코드 존재; Android 경로/운영 활성·입력 최소화·국외이전은 pending |
| 알림톡 | 보호자 전화번호, 예약·반려동물·일정·메시지 내용, 발송 상태. 예약 안내·운영 알림. | `src/lib/server-env.ts`, `docs/admin-alimtalk-operation-guide.md`, `supabase/migrations/202605180003_media_assets_and_notification_attachments.sql` | 설정된 알림톡 제공자(코드상 Ssodaa 가능) | 제공자·운영 enablement·위탁/국외이전은 pending |
| 진단·분석 SDK | Firebase Admin/FCM은 푸시용 의존성·코드가 있다. Sentry/PostHog/Mixpanel/Amplitude/Crashlytics/광고 SDK의 의존성·코드 사용은 이번 저장소 검색에서 확인하지 못했다. | `D:\petmanager-app/package.json`, `D:\petmanager-app/android/app/capacitor.build.gradle` | Firebase(푸시) | 광고·분석·Crash SDK는 **현재 선언에 넣지 않음**; 릴리스 AAB 의존성 스캔으로 재확인 필요 |

## 3. 공개 개인정보처리방침 delta (최종 문안 전 교체 요구사항)

현재 PC의 공개 본문은 `src/lib/legal/privacy-policy.ts`, 모바일 소스는 `D:\petmanager-app/src/lib/legal/privacy-policy.ts`이다. 두 문서의 시행일과 문구가 달라 단일 본문으로 통일해야 한다. 공개 링크 기준은 `https://www.petmanager.co.kr/privacy` (`D:\petmanager-app/src/lib/legal/public-legal-links.ts`)다.

최종 문안에는 아래를 빠짐없이, 실제 확정값만 넣는다.

1. **처리자·연락처·공개 URL**: 운영자, 개인정보 문의 이메일/전화, 정책 시행일, 계정 삭제 웹 경로.
2. **항목별 처리**: 오너 계정/PASS, 매장·직원, 보호자·반려동물·예약·미용기록, 사진, 결제·구독, 푸시 토큰/기기 정보, 알림톡, 선택 AI 처리의 항목·목적·필수/선택 구분.
3. **수탁·제3자·국외이전 구분**: Supabase, Vercel, PortOne/NHN KCP, Firebase, 실제 알림톡 제공자, 실제 사용/활성인 DeepSeek/OpenAI에 대해 사업자명·업무·보관 위치/국가·기간·계약 근거를 확정 후 표기. “제3자 제공 없음”만으로 수탁/국외이전을 대신하지 않는다.
4. **보유·파기**: 탈퇴 시 삭제 범위와 법령·분쟁·결제 보존 대상의 항목별 기간·근거·파기 방법. **Stage 1 final value pending**.
5. **권리 행사**: 열람·정정·삭제·처리정지와, 로그인한 앱/웹에서의 계정 삭제 요청 및 로그인하지 못한 사람의 외부 웹 요청 경로. 삭제 전 구독 해지 등 추가 단계가 있으면 명확히 알린다. **Stage 1 final value pending**.
6. **권한**: Android CAMERA·POST_NOTIFICATIONS는 각각 사진 촬영·새 예약 알림이며 선택이고, 거부해도 핵심 예약 운영은 가능한 범위를 명시한다. 위치 권한은 Android manifest에 없으므로 현재 위치 수집 기능으로 쓰지 않는다.

### 공개 본문에 넣을 보수적 문구 초안

> 펫매니저는 예약·매장 운영을 위해 오너 계정 정보, 매장·직원 정보, 매장이 입력한 보호자·반려동물·예약·미용기록, 선택적으로 업로드한 사진과 알림 수신용 기기 토큰을 처리합니다. 결제와 본인확인은 해당 결제·본인확인 제공자의 처리 경로를 통해 수행됩니다. 계정 삭제와 보존 대상의 세부 범위·기간은 서비스 내/웹의 계정 삭제 안내에서 확인할 수 있습니다.

위 문구는 **최종 정책이 아니며**, 수탁자·국외이전·보존 matrix·계정 삭제 경로 확정 뒤에만 공개한다.

## 4. Google Play Data safety 답변 matrix

Google Play는 앱·SDK가 기기 밖으로 전송하는 데이터와 모든 배포 버전의 관행을 정확히 선언하도록 요구한다. 따라서 “앱에 직접 SDK가 없다”만으로 미선언 처리하면 안 된다.

| Play 질문/데이터 유형 | 초안 답 | 필수/선택 | 목적 초안 | 일시 처리 | 공유 | 근거·제출 전 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| 사용자 데이터 수집 또는 공유 | **예** | 해당 없음 | 서비스 제공 | 해당 없음 | provider 계약별 확정 | 계정·예약·사진·푸시·결제 처리 코드 존재 |
| 전송 중 암호화 | **미확정 — 제출 금지** | 해당 없음 | 보안 | 해당 없음 | 해당 없음 | Stage 2에서 실제 production AAB, HTTPS endpoint, Supabase/PortOne/FCM/AI 전송 경로를 점검 후 “예”만 선택 |
| 삭제 요청 방법 제공 | **아니오 — 현재 제출 금지** | 해당 없음 | 권리 행사 | 해당 없음 | 해당 없음 | 앱 내/외부 계정 삭제 경로가 없고 Stage 1 contract는 보존 정책 없으면 fail-closed |
| 개인 정보: 이름 | 예 | 오너 가입·본인인증은 필수, 보호자 이름은 매장 입력 | 계정/서비스 제공 | 아니오 | 수탁 계약별 확정 | 가입·고객 관리 |
| 개인 정보: 이메일 주소 | 예 | 필수 | 계정 관리, 로그인·고지 | 아니오 | 수탁 계약별 확정 | Supabase Auth/이메일 확인 |
| 개인 정보: 전화번호 | 예 | 오너 인증은 필수, 보호자 번호는 매장 입력 | 본인확인, 예약 연락·알림 | 아니오 | 알림/본인확인 수탁 범위 확정 | PASS·고객 관리·알림톡 |
| 개인 정보: 주소 | 예 | 매장 주소는 필수 | 매장/예약 서비스 제공 | 아니오 | 수탁 계약별 확정 | 가입 정책·매장 데이터 |
| 개인 정보: 생년월일·기타 개인 정보 | 예 | 본인확인 필수 | 본인확인/부정 이용 방지 | 아니오 | PortOne 처리 범위 확정 | identity verification schema |
| 금융 정보: 결제 정보 | 예 | 유료 결제 시 선택 | 결제·구독·환불 | 아니오 | PortOne/NHN KCP 처리 범위 확정 | PG가 결제정보를 직접 처리; billing key/결제 ledger가 코드상 존재 |
| 사진 및 동영상: 사진 | 예 | 선택 | 사진 저장·미용기록·가격표/AI 기능 | 아니오 | Storage, AI 활성 시 OpenAI 확정 | CAMERA 권한·media_assets |
| 앱 활동: 사용자 생성 콘텐츠 | 예 | 매장 입력/선택 | 예약·미용·고객 관리 | 아니오 | 수탁 계약별 확정 | 메모, 스타일 노트, 예약 데이터 |
| 앱 활동: 앱 내 검색/상호작용 | **미확정** | 해당 없음 | 운영 기능 | 해당 없음 | 해당 없음 | 별도 analytics SDK는 미확인. 서버 access log/analytics를 이 유형으로 쓸지 production logging policy 확인 |
| 앱 정보 및 성능: 진단 | **아니오 초안** | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | Sentry/Crashlytics/분석 SDK 미확인. 릴리스 AAB 의존성 스캔 재확인 전 확정 금지 |
| 기기 또는 기타 ID | 예 | 푸시 동의·권한 허용 시 선택 | 푸시 알림 전달·기기 관리 | 아니오 | Firebase/Supabase 처리 범위 확정 | FCM token, deviceId, appId, metadata |
| 위치 | 아니오 | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | Android manifest에 위치 permission 없음. 정책의 위치기반 서비스 문구는 제거 또는 실제 기능과 맞춤 필요 |
| 연락처·건강·SMS/통화·오디오·파일 일반 | 아니오 초안 | 해당 없음 | 해당 없음 | 해당 없음 | 아니오 | manifest와 의존성에서 해당 권한/SDK 미확인. 사진 파일은 별도 사진 항목으로 선언 |

### 공유(share) 판단 보류 규칙

Data safety의 “공유”는 외부 제공자가 단순 처리위탁자인지, 독립된 제3자인지에 따라 달라질 수 있다. 현재는 Supabase/Vercel/PortOne/NHN KCP/Firebase/알림톡/AI 각각의 실제 계약·처리 위치를 확정하지 않았으므로 **모든 행의 공유 답을 임의로 ‘아니오’로 제출하지 않는다**. 제공자가 서비스 제공자를 대신해 처리만 한다는 계약 근거가 확정된 후 Form 정의에 맞게 선택한다.

## 5. Play App access 심사 메모 초안

### 심사자에게 제공할 안내 (계정 준비 후 영어로 입력)

```text
App access: login required.

Use the dedicated review account supplied in the Play Console credentials field.
This account contains fictitious, non-personal test shop, customer, pet, appointment, and image data only.

1. Open the app and sign in with the supplied email and password.
2. Do not use phone/PASS verification during review: the dedicated review account is pre-verified and has no MFA or one-time-code challenge.
3. The account has an active review entitlement, so no card, billing key, payment, subscription purchase, or external payment flow is required.
4. Review the dashboard, customer/pet records, reservations, settings, photo permission flow, and notification preference screens.
5. The app may request optional Camera and Notifications permissions. Declining either permission does not block review of the remaining features.

If credentials fail, contact: [production support email].
```

### 심사 계정 운영안

| 단계 | 운영 규칙 |
| --- | --- |
| 생성 전 | Stage 2 PASS/deep link 및 production auth allowlist를 먼저 검증한다. 실제 고객/직원/전화번호/카드/결제수단을 사용하지 않는다. |
| 계정 | task-owned 오너 1개, 전용 비식별 이메일·강한 비밀번호·가상 매장·가상 보호자/반려동물/예약/사진만 사용한다. 비밀번호·토큰·API key는 이 문서/채팅/소스에 기록하지 않는다. |
| 인증 | 심사 계정은 실제 PASS 우회 기능을 제품에 넣지 않는다. 계정을 사전에 정상적으로 검증하거나, Play 심사자에게 반복 재현 가능한 승인 방법을 제공한다. 현재 방식은 없음. |
| 권한/결제 | 리뷰용 entitlement만 부여하고 실제 카드·billing key·외부 결제·수신 가능한 전화번호를 넣지 않는다. |
| 전달 | Play Console의 App access credential field에만 제출한다. 별도 메일·DM·문서 링크로 자격증명을 보내지 않는다. |
| 유지 | 심사 기간 내 로그인/데이터/entitlement를 유지하고 만료 30일 전 점검한다. 심사 종료 또는 거절 후 즉시 권한·푸시 토큰을 회수하고 계정/seed data를 Stage 1 정책에 맞게 삭제한다. |

## 6. 정확한 P0/P1 및 다음 순서

### P0 — 제출 차단

1. **Stage 1**: 오너 계정 삭제 UI/외부 웹 리소스와 법정 보존 matrix가 확정·운영 적용되지 않았다. `supabase/migrations/20260901143000_owner_account_deletion_contract.sql`은 보존 대상 결제 기록이 있으면 `RETENTION_POLICY_REQUIRED`로 fail-closed한다. 모바일 앱에는 삭제 요청 UI/경로를 찾지 못했다.
2. **Stage 2**: Production PASS 검증은 알려진 503 상태이며 Android deep-link callback과 Supabase Auth allowlist가 확인되지 않았다.
3. **Stage 2**: 실제 FCM credential/`google-services.json`/production AAB와 push delivery를 확인하지 않았다. 코드 존재만으로 Data safety 보안 답을 확정할 수 없다.
4. 공개 개인정보처리방침의 실제 처리·수탁/국외이전·보유기간·계정삭제 경로가 일치하지 않는다. 모바일 정책은 특히 오래된 시행일/내용이다.
5. 비식별 Play 심사 계정과 결제 없이 재현 가능한 review entitlement가 없다.

### P1 — 출시 전 해소 권장

1. 실제 운영되는 AI/알림톡 provider와 입력 데이터 최소화·국외이전/수탁 문구를 확정한다. 사용하지 않는 AI/SDK는 공개 정책과 Data safety에 넣지 않는다.
2. release AAB의 manifest·의존성·네트워크 보안 구성으로 광고/분석/Crash SDK 부재 및 권한을 재검증한다.
3. PC/모바일 정책 단일 원문·시행일을 동기화하고, `https://www.petmanager.co.kr/privacy` 및 계정 삭제 웹 URL을 공개 후 실제로 열리는지 점검한다.

### 다음 단계

Stage 1과 Stage 2 완료 보고를 받은 뒤, (1) 최종 운영값을 이 matrix에 반영, (2) 비식별 심사 계정/seed lifecycle을 실제로 검증, (3) 공개 정책 URL과 Android AAB를 독립 확인, (4) 그때에만 Play Console Data safety/App access 입력·제출 승인 요청 순으로 진행한다.

## 7. 확인한 공식 외부 근거 (2026-09-02)

- Google Play, [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469): SDK 포함 실제 데이터 관행, 전송 암호화와 삭제 요청 여부를 선언.
- Google Play, [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311): 계정 생성 앱은 앱 내와 앱 외부에서 발견 가능한 삭제 요청 수단이 필요.
- Google Play, [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111): 계정과 연계 데이터를 삭제하고, 보존 사유/추가 절차를 명확히 고지.
- Google Play, [sign-in details for review](https://support.google.com/googleplay/android-developer/answer/15748846): 유효·재사용 가능한 심사 계정과 영어 안내가 필요.
- Google Play, [Play Console Requirements](https://support.google.com/googleplay/android-developer/answer/10788890): 개인정보처리방침, Data safety, 심사 접근 정보를 제출 전 제공.
