# 운영 provider 공식 근거 대조

- 기준일: 2026-09-10 KST
- 범위: 공개된 provider 공식 문서와 현재 PC/mobile source의 읽기 전용 대조
- 대표 확정: 운영은 Supabase, Cloudflare R2, Firebase Cloud Messaging, OpenAI, DeepSeek, PortOne/NHN KCP/PASS, 쏘다 알림톡을 사용함
- 대표 확정의 한계: 위 문장은 **사용 여부만** 닫습니다. PetManager 계정의 계약 상대 법인, DPA 수락, region, 보존·backup, 학습 opt-in, 삭제 설정, Production endpoint scheme은 별도 증거 없이는 `UNKNOWN`입니다.
- 실행하지 않은 것: provider 계정 로그인, credential 확인, API/DB/Auth 호출, 파일 업로드, Play Console 저장·제출

## 판정 규칙

| 표기 | 의미 |
|---|---|
| `READY-OFFICIAL` | provider가 공개한 일반 정책·제품 문서에서 확인됨 |
| `READY-SOURCE` | 현재 PetManager source에서 확인됨. Production 계정·실행 증거를 뜻하지 않음 |
| `OWNER-CONFIRMED` | 대표가 운영 사용 여부만 확정함 |
| `UNKNOWN-ACCOUNT` | PetManager 계정·계약·설정의 비밀 없는 readback이 없음 |
| `HOLD-PLAY` | 해당 값을 근거로 Play 답을 확정하거나 저장하면 안 됨 |

Google Play에서 기기 밖 전송은 일시 처리와 SDK 경로를 포함해 원칙적으로 수집에 포함됩니다. 제3자 전송이라도 개발자의 지시에 따라 처리하는 서비스 제공업체이면 `공유` 공개 예외가 될 수 있지만, 그 역할은 실제 계약과 처리 목적에 맞아야 합니다. 전송 중 암호화는 모든 사용자 데이터 경로에 대해 답해야 합니다. 따라서 provider 제품 소개나 source의 HTTPS 문자열만으로 `공유 없음`, `모든 데이터 암호화`, `즉시 삭제`를 확정하지 않습니다. 근거: [Google Play Data Safety 공식 안내](https://support.google.com/googleplay/android-developer/answer/10787469?hl=ko).

## Play 최상위 답 현황

| 질문 | 현재 답 | 근거와 중단 조건 |
|---|---|---|
| 사용자 데이터 수집 또는 공유 | `예` | 계정·운영·사진·AI·push·결제/본인확인·알림톡 데이터가 기기 밖으로 전송됨 |
| 제3자 공유 | `UNKNOWN / HOLD-PLAY` | 각 provider의 실제 processor/service-provider 계약, 목적 제한, downstream 전달을 한꺼번에 닫지 못함 |
| 모든 사용자 데이터 전송 중 암호화 | `UNKNOWN / HOLD-PLAY` | 여러 공식 서비스는 TLS를 밝히지만 쏘다 relay/direct Production hop과 전체 WebView·이메일·OS 음성 경로가 미확정 |
| 삭제 요청 방법 제공 | `예 후보 / HOLD-PLAY` | 앱·공개 삭제 경로 source는 있으나 Production E2E와 provider residue/backup 경계가 미확정 |

## 1. Supabase

### PetManager 경로

- `OWNER-CONFIRMED`: Auth, 서비스 데이터베이스, 설정된 미디어 경로에 사용.
- 처리 데이터: 계정 식별자와 인증 정보, 매장·직원·고객·반려동물·예약·서비스·요금·메모, 알림 설정·token registry, 결제 상태, media metadata와 provider selector.

### 공식 기본값

- 법인: `Supabase Pte. Ltd` — [Data Processing Addendum](https://supabase.com/legal/customer-resources/data-processing-addendum).
- 역할: 공개 DPA는 고객이 controller이면 Supabase가 processor, 고객이 processor이면 Supabase가 subprocessor가 되는 구조와 고객 지시 범위 처리를 정합니다. [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum).
- 하위처리자: 공식 목록과 변경 알림 절차가 있습니다. [Subprocessor List](https://supabase.com/legal/customer-resources/subprocessor-list).
- 전송·저장: DPA는 네트워크 통신에 TLS 1.2 이상 현대 표준을 쓰고 backup을 전송·저장 중 암호화한다고 설명합니다. [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum). HTTP API는 SSL을 사용하지만 direct Postgres SSL enforcement는 설정 항목입니다. [SSL Enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).
- 위치: project primary region 선택이 본 DB/Auth/Storage 위치를 좌우하고, 로그·backup·Edge Function·하위처리자는 별도 범위가 될 수 있습니다. [Regions](https://supabase.com/docs/guides/platform/regions), [GDPR and data residency](https://supabase.com/docs/guides/security/gdpr-compliance).
- 보존·backup: 공개 문서는 project plan과 PITR에 따라 backup 보존이 달라짐을 설명합니다. 계약 종료 후 DPA상 30일의 반환 기간이 지나면 Supabase와 승인 하위처리자가 covered data 사본을 삭제합니다. 이는 PetManager 사용자의 계정삭제 즉시 purge 보장이 아닙니다. [Backups](https://supabase.com/docs/guides/platform/backups), [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: PetManager 계약 고객 법인, DPA 적용/readback, project primary region, plan, PITR, direct database SSL enforcement, Storage 사용 범위, log/backup 실제 보존, 계정삭제 후 provider 사본 경계.
- `공유`: 서비스 제공업체 예외 **후보**이나 계약 당사자·지시 범위 증거 전 `UNKNOWN`.
- `전송 암호화`: Supabase 구간의 공식 기본값은 강한 근거지만 전 앱 최상위 답을 단독으로 닫지 못함.

## 2. Cloudflare R2

### PetManager 경로

- `OWNER-CONFIRMED`: private 사진 객체와 metadata 저장·삭제 provider로 사용.
- `READY-SOURCE`: 기본 S3 endpoint는 HTTPS이며 provider-aware 삭제와 가격표 원본·파생·metadata hard purge 계약이 있음. 환경변수로 endpoint를 바꿀 수 있으므로 Production scheme은 별도 확인 대상.

### 공식 기본값

- 법인: `Cloudflare, Inc.` — [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).
- 역할·2차 이용: 공개 DPA는 Cloudflare를 processor로 두고 고객 지시 범위 처리를 요구하며 개인정보를 marketing/advertising에 쓰지 않는다고 정합니다. [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).
- 하위처리자: [Cloudflare Subprocessors](https://www.cloudflare.com/gdpr/subprocessors/).
- 전송·저장: R2 객체와 metadata는 AES-256-GCM으로 저장 암호화되고 client↔R2는 TLS를 사용합니다. plaintext HTTP 차단은 custom domain의 `Always Use HTTPS` 설정과 관련되므로 account readback이 필요합니다. [R2 Data Security](https://developers.cloudflare.com/r2/reference/data-security/).
- 위치: 기본은 Automatic이고 jurisdiction restriction/힌트는 별도 설정입니다. [R2 Data Location](https://developers.cloudflare.com/r2/reference/data-location/).
- 보존·삭제: 객체 lifecycle은 bucket별 규칙입니다. 기본 7일 정리는 incomplete multipart upload에 관한 것이며 일반 객체의 보존기간이 아닙니다. DPA의 delete/return은 계약 종료 또는 서비스 완료 조건으로, 사용자 단위 hard delete의 물리 backup SLA를 정하지 않습니다. [Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: DPA 적용/readback, bucket jurisdiction, custom domain/Always HTTPS, lifecycle rules, versioning 또는 잔여 사본, audit/log 보존, 사용자 삭제 이후 provider backup purge SLA.
- `공유`: service-provider 예외 후보이나 실제 계약·목적 제한 확인 전 `UNKNOWN`.
- `전송 암호화`: 공식 R2 TLS만으로 Production custom endpoint와 모든 경로를 닫지 못함.

## 3. Firebase Cloud Messaging

### PetManager 경로와 필수 release 계약

- `OWNER-CONFIRMED`: FCM을 사용하며 앱 종료·background와 잠금화면에서 예약 알림이 표시되는 기능은 release 필수.
- `READY-SOURCE`: 사용자가 앱 알림을 켜고 Android 알림 권한을 허용한 뒤에만 token 등록. 기본 앱 preference는 꺼짐이며, 끄면 서버 token registry 삭제 요청과 plugin unregister를 수행함.
- `READY-SOURCE`: server payload는 notification + 업무용 식별자 data이며 Android priority high, notification visibility private, TTL 24시간.
- 필수 기능과 동의는 구분합니다. Android 13+에서는 `POST_NOTIFICATIONS` runtime permission을 사용자가 거부할 수 있으므로, Play의 `Device or other IDs`는 `예 / 선택 / 앱 기능`을 유지합니다. 권한 거부를 우회하거나 FCM 등록을 강제하지 않습니다. [Android notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission).

### 공식 기본값

- 법인: Firebase Data Processing Terms의 계약 법인은 고객 위치·계약에 따라 Google LLC, Google Ireland Limited, Google Asia Pacific Pte. Ltd 또는 해당 affiliate가 될 수 있어 PetManager 법인은 account 계약으로만 확정합니다. [Firebase Data Processing Terms](https://firebase.google.com/terms/data-processing-terms).
- 역할: 위 조건의 적용 범위에서는 Google이 customer personal data processor로 처리합니다. 실제 계약 체결 주체와 서비스 범위는 account readback 대상입니다.
- 하위처리자: [Firebase Subprocessors](https://firebase.google.com/terms/subprocessors).
- 데이터·보존: FCM은 Firebase installation ID를 delivery에 사용하며, 고객이 API로 ID 삭제를 시작할 때까지 보유하고 삭제 호출 뒤 live와 backup에서 제거되기까지 최대 180일이라고 설명합니다. [Firebase Privacy and Security](https://firebase.google.com/support/privacy/).
- 메시지 보존: FCM은 기기가 offline이면 TTL 동안 메시지를 저장할 수 있습니다. 제품 source의 TTL은 24시간이며 provider 문서상 가능한 기본/최대값을 그대로 적용하지 않습니다. [FCM message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan).
- 전송·저장: Firebase는 서비스 전송에 HTTPS를 쓰며 FCM을 저장 암호화 서비스로 열거합니다. [Firebase Privacy and Security](https://firebase.google.com/support/privacy/).
- 위치: FCM은 global infrastructure에서 처리될 수 있습니다. [Firebase project locations](https://firebase.google.com/docs/projects/locations), [Firebase Privacy and Security](https://firebase.google.com/support/privacy/).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: 실제 계약 법인/DPA 범위, project settings, FID delete API 호출 여부, account-level logs/export, 정확한 처리 국가와 하위처리자, token/FID 삭제 Production E2E.
- 앱의 token registry 삭제와 `unregister()`는 FID 삭제 API 완료 증거가 아닙니다. `즉시 삭제`라고 쓰지 않습니다.
- `공유`: service-provider 예외 후보이나 계약 증거 전 `UNKNOWN`.
- release P0: 권한 허용·알림 활성 상태에서 앱 종료/background와 잠금화면 알림이 exact release AAB·Production에서 통과해야 함. 이는 Data Safety의 선택 수집 판정을 필수 수집으로 바꾸지 않습니다.

## 4. OpenAI

### PetManager 경로

- `OWNER-CONFIRMED`: 가격표 분석에 OpenAI를 사용.
- `READY-SOURCE`: 개인정보 없음 확인과 JIT 동의 뒤 metadata 제거·재인코딩한 파생 JPEG 1장과 분석 지시를 `/v1/responses` HTTPS endpoint에 1회 전송. `store:false`, 자동 재시도 없음. 사용자가 검토·편집한 structured 서비스·요금만 저장.

### 공식 기본값

- 법인·역할: 공개 DPA는 일반적으로 OpenAI OpCo, LLC를, EEA·Swiss 고객에는 OpenAI Ireland Ltd를 processor로 규정합니다. PetManager 계약 법인은 account/계약 readback으로 확정합니다. [OpenAI DPA](https://openai.com/policies/data-processing-addendum/).
- 학습: API 입력·출력은 기본적으로 모델 학습에 사용되지 않지만 조직이 명시적으로 data sharing에 opt-in할 수 있습니다. [API Data Controls](https://developers.openai.com/api/docs/guides/your-data).
- 보존: `/v1/responses`는 공식 표상 abuse monitoring logs가 기본 최대 30일일 수 있습니다. `store:false`는 application state 저장을 줄이는 source 설정이지 Zero Data Retention 승인을 뜻하지 않습니다. ZDR/Modified Abuse Monitoring은 조직 승인이 필요한 별도 제어입니다. [API Data Controls](https://developers.openai.com/api/docs/guides/your-data).
- 보안: OpenAI는 business/API data의 전송·저장 암호화를 설명합니다. [Security and Privacy](https://openai.com/security-and-privacy/).
- 하위처리자·위치: 공식 목록에 글로벌 processing location이 공개됩니다. [Subprocessor List](https://openai.com/policies/sub-processor-list/).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: 계약 법인, DPA 적용, data sharing opt-in 상태, ZDR/MAM 승인, project retention controls, 실제 model/region, 현재 하위처리자 적용 범위.
- `공유`: service-provider 또는 사용자 시작 작업 예외 후보이나 실제 계약·동의와 처리 목적을 확인하기 전 `UNKNOWN`.
- 정책에는 `store:false`를 provider 무보존·무학습 보장으로 확장해 쓰지 않습니다.

## 5. DeepSeek

### PetManager 경로

- `OWNER-CONFIRMED`: 활성 care-report AI에 DeepSeek를 사용.
- `READY-SOURCE`: 서비스명·실제 소요 시간·사용자가 입력·확인한 care facts를 text-only로 `https://api.deepseek.com/chat/completions`에 전송. 사진과 원음은 제외하며 결과는 사용자 검토 뒤 구조화 care report로 저장·전송.

### 공식 기본값과 한계

- 법인: `Hangzhou DeepSeek Artificial Intelligence Co., Ltd.` — [DeepSeek Open Platform Terms](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html).
- 개발자 의무: Open Platform Terms는 downstream 앱 운영자가 최종 사용자에게 처리 규칙을 고지하고 동의 또는 다른 법적 근거를 확보해야 한다고 명시합니다. 또한 DeepSeek의 일반 privacy policy가 downstream 앱 최종 사용자 데이터 처리 규칙을 포괄하지 않는다고 밝힙니다. [Open Platform Terms](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html).
- 학습·2차 이용: 일반 Terms에는 입력·출력을 서비스와 모델 개선에 제한적으로 사용할 수 있다는 조항과 opt-out 설명이 있으나, PetManager API 계정·downstream end-user data에 적용되는 정확한 범위와 opt-out 상태는 확인되지 않았습니다. [DeepSeek Terms of Use](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html).
- 보존: 공식 API의 disk cache 설명은 cache miss 감소용 key/value tensor가 통상 수시간~수일 후 정리된다는 범위일 뿐 prompt/content abuse log, backup, 계정삭제 SLA를 닫지 않습니다. [DeepSeek Context Caching](https://api-docs.deepseek.com/news/news0802/).
- API endpoint: 공식 API 문서는 HTTPS endpoint를 안내합니다. [DeepSeek API Docs](https://api-docs.deepseek.com/).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: API 전용 DPA/processor 약정, downstream input retention, backup/delete, 학습 opt-out 실제 상태, 처리 국가, 하위처리자, TLS와 저장 암호화의 계약 보장.
- 공개 1차 자료 범위에서 API 전용 DPA·하위처리자 목록을 확인하지 못했습니다. 부재를 계약 부재로 단정하지 않고 `UNKNOWN`으로 둡니다.
- `공유`: service-provider 예외 적용 근거가 불충분하므로 `UNKNOWN / HOLD-PLAY`.
- 개인정보처리방침은 현재의 `활성화된 경우` 표현을 운영 확정 사실과 맞춰 `care-report AI 기능을 사용할 때`로 바꿀 필요가 있습니다. 제품 정책 source 변경은 이 단계 범위 밖입니다.

## 6. PortOne · NHN KCP · PASS

### PetManager 경로

- `OWNER-CONFIRMED`: PortOne과 NHN KCP/PASS를 결제·본인확인 경로에서 사용.
- `READY-SOURCE`: Android는 결제 mutation을 전송 전에 차단하고 PC/server의 확정 결제 상태만 소비. 가입/PASS 경로는 이름, 생년월일, 성별, 내·외국인, 휴대폰번호, 통신사, CI/DI 등 본인확인 결과를 처리할 수 있음.
- `READY-SOURCE`: PortOne server request는 `https://api.portone.io`를 사용. exact browser SDK·redirect·PG hop은 release/Production E2E 대상.

### PortOne 공식 기본값

- 법인: `주식회사 코리아포트원` — [코리아포트원 개인정보처리방침](https://privacy.portone.io/).
- 처리·보존: 공개 방침은 buyer/payment·본인확인·member 정보별 목적과 기간, 법정 보존, 파기 사유 발생 뒤 원칙적 5영업일 이내 파기를 구분합니다. 이는 PetManager 최종 사용자 데이터 전체의 일괄 보존기간이나 계정삭제 SLA가 아닙니다.
- 제공·국외 처리: 공개 방침에는 PG/간편결제 제공과 일부 plugin·서비스의 국외 처리 항목이 함께 있으므로, PetManager가 실제 사용하는 PG/product만 contract/account로 골라야 합니다.
- 계약: 공개 [서비스 이용약관](https://terms.portone.io/)과 [REST API V2](https://developers.portone.io/api/rest-v2)를 확인했지만, PetManager merchant의 개인정보 처리 부속 합의와 정확한 product path는 `UNKNOWN`.

### NHN KCP/PASS 공식 기본값

- 법인: `엔에이치엔케이씨피 주식회사` — [KCP 휴대폰 본인확인 개인정보처리방침](https://kcp.co.kr/renewPolicy?type=3).
- 본인확인 데이터·보존: 이름, 생년월일, 성별, 통신사, 휴대폰번호, 내·외국인, CI/DI, IP 등 공개 항목을 본인확인과 문의 대응 목적으로 1년 보유한다고 설명합니다. 따라서 앱 계정삭제와 동시에 KCP 사본이 모두 지워진다고 표시하면 안 됩니다.
- 제공: 공개 방침은 본인확인을 위해 SKT/KT/LG U+와 처리하고 이용기관에 결과를 전달하는 구조를 설명합니다. 사용자별 통신사와 PetManager 계약 범위는 다를 수 있습니다.
- 전송: 공식 개발자 문서는 HTTPS endpoint와 인증결과 암호화/복호화 절차를 안내합니다. [KCP 본인확인 연동](https://developer.kcp.co.kr/guide/cert), [인증결과 수신](https://developer.kcp.co.kr/reference/result).
- 결제 보존은 별도 KCP 결제 방침의 거래 금액·법정 근거별 기간을 따라 달라질 수 있습니다. [KCP 전자금융 개인정보처리방침](https://kcp.co.kr/renewPolicy?type=2).

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: PortOne/KCP merchant 계약 법인, DPA/위수탁·제3자 제공 구분, 실제 PG·PASS product, 처리 국가, downstream 제공자, 법정/계약 보존, provider deletion API/E2E, browser redirect 전체 TLS.
- `공유`: processor 예외 또는 사용자가 시작한 본인확인/결제 예외 후보지만 계약과 disclosure/consent를 확인하기 전 `UNKNOWN`.
- Android consumption-only는 Android 결제 mutation만 닫으며 PC 결제·가입 PASS 데이터의 Data Safety 포함 여부를 없애지 않습니다.

## 7. 쏘다 알림톡 · Kakao

### PetManager 경로

- `OWNER-CONFIRMED`: 쏘다 알림톡을 실제 운영 발송에 사용.
- `READY-SOURCE`: relay 또는 direct provider에 수신 전화번호, message, template 식별/유형, sender profile/channel, 선택적 수신자명·metadata·media attachment·button을 보내고 provider 응답 ID를 처리할 수 있음.
- `READY-SOURCE`: `ALIMTALK_RELAY_URL`과 direct API URL은 runtime 환경값이며 source가 `https:` scheme을 강제하지 않습니다. 값이나 host를 이 문서에 기록하지 않습니다.

### 공식 기본값과 한계

- Kakao 공식 안내는 알림톡이 공식 딜러사를 통해 제공되고, 이용자가 적법하게 확보한 전화번호와 승인된 정보성 template을 사용해야 한다고 설명합니다. [Kakao 알림톡](https://business.kakao.com/info/infotalk/), [Kakao Business Guide](https://kakaobusiness.gitbook.io/main/ad/infotalk).
- 이번 공개 1차 자료 범위에서는 쏘다의 정확한 계약 법인, 공식 개인정보처리방침/DPA, 처리 국가, TLS, 보존·backup·삭제, 2차 이용, 하위처리자 목록을 식별하지 못했습니다. 이를 곧바로 법적 문서 부재로 단정하지 않고 account/contract 증거 전부를 `UNKNOWN`으로 둡니다.
- Kakao가 최종 전달 채널이라는 일반 구조만으로 쏘다의 법인·처리자 역할이나 PetManager의 계약 범위를 대신 확정할 수 없습니다.

### 계정별 미확인과 Play 판정

- `UNKNOWN-ACCOUNT`: 쏘다 계약 상대 법인, processor/제3자 역할, 공식 DPA·privacy URL, relay 운영자, relay→쏘다→Kakao 각 hop의 HTTPS, 처리 국가, 하위처리자, message/media/log/backup 보존과 삭제 SLA, 2차 이용.
- `공유`: `UNKNOWN / HOLD-PLAY`.
- `전송 암호화`: Production relay/direct URL의 scheme과 downstream 전 구간 readback 전 `UNKNOWN / HOLD-PLAY`.
- 이 provider 한 곳만으로도 Play 최상위 `모든 데이터가 전송 중 암호화됨=예`와 `공유 없음`을 확정할 수 없습니다.

## 계정 증거 acceptance matrix

| Provider | 활성 사용 | 공식 법인/기본 정책 | processor/share | 국가·국외 처리 | TLS 전 구간 | 보존·backup·삭제 | 학습·2차 이용 | DPA·하위처리자 | Play 상태 |
|---|---|---|---|---|---|---|---|---|---|
| Supabase | 닫힘 | 닫힘 | 계정 미확인 | project 미확인 | 일부 공식, 설정 미확인 | plan/PITR 미확인 | DPA 범위 후보 | 계정 수락 미확인 | HOLD |
| Cloudflare R2 | 닫힘 | 닫힘 | 계정 미확인 | bucket 미확인 | 공식 TLS, endpoint 설정 미확인 | lifecycle/backup 미확인 | DPA상 광고 이용 금지 후보 | 계정 수락 미확인 | HOLD |
| Firebase FCM | 닫힘 | 계약 법인 미확인 | 계정 미확인 | global, exact 국가 미확인 | 공식 HTTPS | FID delete 호출·180일 경계 미확인 | account/service-data 범위 미확인 | 계약 법인·범위 미확인 | HOLD |
| OpenAI | 닫힘 | 조건부 법인만 확인 | 계정 미확인 | 하위처리자 위치 공개, actual 미확인 | 공식 암호화 | 기본 abuse log 최대 30일, account 제어 미확인 | 기본 no-training, opt-in 미확인 | 계약 법인·DPA 미확인 | HOLD |
| DeepSeek | 닫힘 | 법인 확인 | 미확인 | 미확인 | source HTTPS, 계약 보장 미확인 | 미확인 | 일반 약관과 account opt-out 적용 미확인 | 공개 API DPA/목록 미확인 | HOLD |
| PortOne/KCP/PASS | 닫힘 | 법인·provider 정책 확인 | merchant 계약 미확인 | actual product 미확인 | source/공식 endpoint HTTPS, 전체 hop 미확인 | 항목별 기간은 있으나 actual 범위 미확인 | 계약 목적 외 이용 미확인 | merchant 합의 미확인 | HOLD |
| 쏘다/Kakao | 닫힘 | Kakao 구조만 확인, 쏘다 법인 미확인 | 미확인 | 미확인 | Production hop 미확인 | 미확인 | 미확인 | 미확인 | HOLD |

## 정책·제품 후속과 blocker

### P0 — release 제출 전 필수

1. 쏘다 relay/direct Production 경로의 모든 hop이 HTTPS인지 비밀 없는 boolean readback으로 확인. source가 scheme을 강제하지 않으므로 실패 시 제품 수정이 필요하지만 이 단계에서는 수정하지 않음.
2. 쏘다·DeepSeek를 포함한 실제 계약상 processor/제3자 역할과 목적 제한을 확인해 Data Safety `공유`를 데이터 유형별로 확정.
3. owner-confirmed 활성 R2·DeepSeek·FCM을 공개/인앱 정책의 조건부 provider 선택 표현과 일치시키는 정책 delta 작성·배포·readback. 사용자가 기능을 켜거나 실행하는 조건은 유지.
4. exact release AAB·Production에서 FCM 권한 허용 후 앱 종료/background·잠금화면 표시와 24시간 TTL, 권한 거부·앱 알림 끄기 경로를 검증.
5. 공개 정책, Data Safety, 계정삭제에서 provider 보존·법정 예외를 같은 의미로 맞추고 검증되지 않은 즉시삭제·공유0·전부 암호화 문구를 사용하지 않음.

### P1 — 제출 답 정확도·운영 증거

1. Supabase region/plan/PITR/SSL, R2 jurisdiction/lifecycle/Always HTTPS, Firebase 계약 법인/FID delete, OpenAI sharing/ZDR, DeepSeek opt-out, PortOne/KCP merchant 범위를 secret-free control readback으로 수집.
2. 각 DPA 수락 버전과 적용 customer entity, 하위처리자 목록 확인일을 evidence manifest에 결속.
3. provider별 사용자 삭제 이후 live/log/backup residue와 실제 법정 보존 항목을 계정삭제 E2E에 기록.
4. 이 owner 결정에 포함되지 않은 Vercel hosting, OS 음성 인식, 문의 이메일 경로도 전 앱 최상위 공유·암호화 답을 위해 기존 `UNKNOWN`으로 유지.

## 대표에게 필요한 다음 사실 하나

**쏘다 Production 발송 경로의 `PetManager server → relay(있는 경우) → 쏘다 API` 각 hop이 모두 HTTPS인지 `예/아니요`로만 확인해 주세요.** URL, host, token, credential은 보내지 않습니다. `아니요`이거나 확인할 수 없으면 Play의 `모든 사용자 데이터가 전송 중 암호화됨=예`를 선택할 수 없고, 별도 제품 수정 stage가 필요합니다.

