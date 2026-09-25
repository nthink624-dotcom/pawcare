# Play Console 11개 항목 답변 팩

상태 표기:

- `근거 준비`: 소스 답안은 있으나 대표 확인 또는 release AAB 확인 전에는 저장하지 않음
- `대표 사실 필요`: 사업·연령·법적 사실을 작업팀이 추정할 수 없음
- `secure 입력 필요`: credential/연락처는 채팅·문서가 아니라 Play Console 보안 입력란에 대표가 직접 입력
- `미준비`: 제품·운영 근거 또는 업로드 자산을 먼저 만들어야 함

## 1. 개인정보처리방침 — 근거 준비, 공개 배포·release 확인 전 저장 금지

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 개인정보처리방침`
- 제안 입력 URL: `https://www.petmanager.co.kr/privacy`
- 현재 근거: PC 공개 정본 소스와 모바일 인앱 소스가 모두 2026-09-10 시행 본문으로 정합화되었습니다. 계정·PASS, 매장·고객·반려동물·예약·직원, 결제 상태, 사진·미디어 메타데이터, OpenAI·DeepSeek, FCM, 문의·피드백, 음성, 계정삭제를 같은 의미로 설명합니다.
- 확정된 경계: Android 결제는 PC·서버 상태 조회만 하며 변경 요청은 전송 전에 차단합니다. 가격표 원본·변형·메타데이터는 외부 AI 요청 전 hard purge하고, 사용자가 동의한 파생 이미지 1장만 OpenAI Responses에 store:false·자동 재시도 없이 보냅니다. 케어리포트는 활성 시 DeepSeek에 텍스트 사실만 보내고 사진·원음은 보내지 않습니다.
- 대표 확정: Supabase, Cloudflare R2, Firebase Cloud Messaging, OpenAI, DeepSeek, PortOne/NHN KCP/PASS, 쏘다 알림톡을 운영에서 사용합니다. 이는 사용 여부만 닫으며 계약 법인·국외 처리·로그·backup·학습·삭제 조건은 `production-provider-official-attestation.md`의 `UNKNOWN`을 유지합니다.
- 정책 gap: 현재 공개/인앱 source의 R2 `선택된 경우`, DeepSeek `활성화된 경우`, FCM `사용자가 켠 경우` 중 provider 활성 여부와 사용자 기능 실행 조건을 분리해야 합니다. R2·DeepSeek·FCM provider는 운영 중이고, 사진 AI·care-report·앱 알림의 개별 실행·권한은 선택입니다.
- secure 입력: 연락처는 Play Console에서 대표가 직접 확인·입력합니다. 채팅에 새 연락처나 개인정보를 보내지 않습니다.
- 필요한 작업: 정합화된 PC 소스를 공개 URL에 배포한 뒤 HTTPS 200·본문 readback을 확인하고, exact release 앱의 내장 본문·외부 링크·계정삭제 경로를 같은 리비전에 결속합니다.
- 중단 조건: 공개 URL 접근 불가, 배포 본문 또는 앱 내 본문 drift, Data Safety와 provider·보존 설명 불일치.
- 완료 판정: 배포 URL 200 + exact release 앱 내 동일 의미 + 실제 provider·보존 사실 확정 + 대표 검토.

## 2. 앱 액세스(Sign-in details) — 미준비

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 앱 액세스(로그인 세부정보)`
- 제안 답: `일부 또는 모든 기능이 제한됨 / 로그인 필요`
- 현재 근거: `/owner/mobile`은 비로그인 사용자를 로그인으로 보냅니다. 전용 reviewer 계정은 없습니다.
- 작업팀 준비 가능: 비식별 review shop/customer/pet/appointment만 가진 전용 계정의 생성·삭제 절차와 아래 영문 안내.
- 대표 사실: 실제 심사 기간, 연락 가능한 지원 채널, 심사 계정 생성에 대한 별도 외부 쓰기 승인.
- secure 입력: 이메일·비밀번호는 Play Console credential field에만 대표가 직접 입력합니다. 채팅/소스/이 파일에 기록하지 않습니다.
- 필요한 수정: PASS·OTP·2FA·카드 결제 없이 반복 로그인 가능한 entitlement를 안전하게 준비해야 합니다. 제품의 실제 인증을 우회하는 hidden bypass는 만들지 않습니다.
- 중단 조건: 실제 고객 데이터 사용, 만료/OTP/2FA 필요, 결제 요구, credential을 문서나 채팅에 복사해야 하는 흐름.
- 완료 판정: 별도 승인된 reviewer 계정으로 로그인·핵심 화면 접근·거절 권한 흐름 검증 후 secure field 저장.

영문 입력 초안:

```text
Login is required to access the app.
Use the dedicated review account entered in the secure credentials fields in Play Console.
The account contains fictitious test data only and does not require a payment, card, phone verification, OTP, or MFA.
1. Open the app and sign in with the supplied review credentials.
2. Review the dashboard, reservations, customers and pets, staff/settings, photo permission flow, and notification settings.
3. Camera, microphone, and notification permissions are optional. Declining them does not block the remaining review flow.
If access fails, use the support contact entered in Play Console.
```

## 3. 광고 — 근거 준비, AAB 확인 전 저장 금지

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 광고`
- 제안 답: `아니요` (조건부)
- 현재 근거: `package.json`, Capacitor Gradle, Android manifest에서 광고 SDK를 찾지 못했습니다. Firebase는 push/admin 용도로 존재합니다.
- 대표 사실: WebView 화면에도 배너·전면·네이티브·스폰서·자사 앱 광고가 없다는 사실을 확인해야 합니다.
- 필요한 검증: exact release AAB의 merged manifest/dependencies/SDK index와 운영 WebView 콘텐츠를 확인합니다.
- 중단 조건: 광고 SDK, 광고 ID, 광고 네트워크 호출, 광고성 placement가 하나라도 발견됨.
- 완료 판정: release AAB와 runtime 모두 광고 없음 + 대표 확인 후 `아니요`.

## 4. 콘텐츠 등급 — 대표 사실 필요

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 콘텐츠 등급 > 설문 시작`
- 제안 기준: 반려동물 미용샵 업무 도구. 폭력·성적 콘텐츠·도박·약물·욕설을 제품 기능으로 제공한다는 근거는 없습니다.
- 확인 필요: 직원이 입력하는 자유 메모·사진은 공개 소셜 콘텐츠가 아니지만 사용자 생성 콘텐츠 관련 실제 IARC 질문에는 정확히 답해야 합니다. 결제/구독, 고객 커뮤니케이션, AI 생성 문구도 질문 문맥에 따라 확인합니다.
- 대표 사실: 실제 운영에서 허용하는 콘텐츠, 공개 공유 기능 유무, 타깃 국가.
- 중단 조건: Console 질문을 보지 않고 전 항목 `아니요`로 일괄 답변.
- 완료 판정: exact questionnaire 캡처 없는 값 기록 금지; 대표 사실과 release 기능을 문항별 대조한 뒤 등급 발급.

## 5. 타깃층 및 콘텐츠 — 대표 사실 필요

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 타깃층 및 콘텐츠`
- 제안 방향: `성인 미용샵 운영자·직원용 비즈니스 앱`, 연령대는 대표 확정 전 선택하지 않습니다.
- 현재 근거: 예약·고객·직원·서비스/요금 관리와 사업자 가입/PASS/구독 흐름이 있습니다. 아동용 디자인·콘텐츠 근거는 없습니다. 그러나 소스에 명시적인 18세 미만 차단 계약은 확인되지 않았습니다.
- 대표 사실: 서비스 이용약관상 최소 연령과 실제 미성년 사업자/직원 허용 여부.
- 필요한 수정: 18세 이상으로 선언한다면 약관·가입 검증·스토어 설명과 실제 동작이 일치해야 합니다.
- 중단 조건: 제품 제한 없이 편의를 위해 18+ 선택, 또는 아동 대상이 아닌데 아동 연령을 선택.
- 완료 판정: 대표의 연령 정책 1개 확정 + 제품/약관/Console 일치.

## 6. Data Safety — 부분 근거 준비, provider·release 증거 전 저장 금지

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 데이터 보안`
- 최상위 답: `사용자 데이터 수집 또는 공유: 예` — 계정·운영·사진·메모·푸시 등록 데이터가 서버로 전송되는 소스 근거가 있어 확정 가능합니다.
- 공유: `UNKNOWN`; 운영 provider 목록은 확정됐지만 Supabase, Vercel, Firebase, PortOne/KCP/PASS, 쏘다/Kakao, OpenAI, DeepSeek, 음성 인식, 이메일 처리의 실제 계약상 역할과 Google 공유 예외 적용은 미확정입니다. `공유 없음` 금지.
- 전송 암호화: `UNKNOWN`; 여러 provider 공식 문서는 TLS를 밝히지만 쏘다 relay/direct Production hop과 exact release 앱, WebView, SDK, 이메일·OS 음성의 모든 경로를 닫지 못했습니다. `예` 금지.
- 삭제 요청: `예 후보`; 공개 `/account-deletion`과 앱 내 삭제 adapter, 미디어 residue 확인·세션 해지·Auth 삭제 소스 계약은 있으나 exact release와 Production E2E 후 확정합니다.

| Google 데이터 유형 | 수집 답안 | 필수/선택·목적 | 공유 | 보존·삭제 근거 |
|---|---|---|---|---|
| 개인정보: 이름, 이메일, 사용자 ID, 전화번호, 주소, 생년월일 등 | 예 | 계정 생성·본인확인은 필수, 고객·직원 정보는 기능 사용 시 앱 기능·계정 관리·보안 | UNKNOWN | 계정 삭제 원칙, 법정 예외 항목·기간 UNKNOWN |
| 금융 정보: 구매 이력 | 예 후보 | PC 결제·구독 사용 시 앱 기능·계정 관리; Android는 확정 상태만 조회 | UNKNOWN | 결제·환불·분쟁 보존 항목·기간 UNKNOWN |
| 금융 정보: 사용자 결제 정보 | UNKNOWN | Android는 입력·변경을 차단하나 PC/PortOne·KCP 경로와 Google 분류 확인 필요 | UNKNOWN | 카드번호 원문은 회사 저장 안 함; provider 조건 UNKNOWN |
| 사진 | 예 | 카메라·갤러리, 미용·프로필·메시지·가격표·문의 캡처를 쓸 때 선택, 앱 기능 | UNKNOWN | 가격표 원본·변형·metadata는 AI 전 hard purge; 일반 서비스 사진·provider backup 기간 UNKNOWN |
| 메시지: 기타 앱 내 메시지 | 예 | 고객 알림톡·문의·답변을 사용할 때 선택, 커뮤니케이션·앱 기능 | UNKNOWN | 운영·provider 보관 기간 UNKNOWN |
| 기타 사용자 생성 콘텐츠 | 예 | 고객·반려동물·예약·미용·직원·케어 사실·메모 입력 시 앱 기능 | UNKNOWN | 계정 삭제 원칙, 법정·provider 예외 UNKNOWN |
| 기기 또는 기타 ID | 예 | 오너 push를 켠 경우 선택, 알림·앱 기능. 앱 종료/background·잠금화면 표시 기능은 release 필수이나 Android 권한 거부 가능 | UNKNOWN | FCM token registry 삭제와 unregister는 있으나 FID 삭제 API·provider backup 제거 E2E UNKNOWN |
| 오디오 파일·음성 | UNKNOWN | 음성 입력은 선택; 원음은 서비스 데이터로 저장하지 않음 | UNKNOWN | OS speech의 off-device 처리·보관 UNKNOWN |
| 앱 상호작용·비정상 종료 로그·진단 | UNKNOWN | 보안·장애 대응 후보 | UNKNOWN | Vercel/Firebase/runtime 실제 범위·기간 UNKNOWN |
| 위치, 기기 연락처, SMS·통화 기록 | 아니요 후보 | 매장 우편 주소·고객 전화번호는 각각 개인정보 주소·전화번호이며 기기 위치/주소록 수집 근거는 없음 | UNKNOWN | exact AAB merged manifest와 runtime 최종 확인 필요 |

- 가격표 AI 세부 답: `Photos = Yes / Optional / App functionality`. 개인정보 없음 확인과 JIT 동의 후 metadata 제거·재인코딩한 파생 이미지 1장을 OpenAI에 1회 전송하며 `store:false`, 자동 재시도 없음. provider 보관·학습·국가·하위처리자·DPA는 UNKNOWN입니다.
- 케어리포트 세부 답: `Other user-generated content = Yes / 기능 사용 시 선택 / App functionality`. 운영 provider는 DeepSeek로 확정됐고, 사용자가 care-report 기능을 실행할 때 서비스명·소요 시간·care facts만 text-only로 전송하며 사진·원음은 제외합니다. provider 보존·학습·국가·DPA는 UNKNOWN입니다.
- FCM 세부 답: 운영 provider는 FCM으로 확정됐습니다. token·앱 생성 device ID·앱/플랫폼/locale/timezone·역할·설정을 처리하고, notification은 high priority/private visibility, TTL 24시간입니다. data payload의 불투명 업무 식별자를 누락하지 않습니다. Android 권한과 앱 preference는 사용자 선택입니다.
- private 미디어: 운영 저장 provider로 Cloudflare R2 사용이 확정됐고 source는 private 접근과 provider-aware 삭제를 요구합니다. bucket jurisdiction, lifecycle, version/backup purge는 UNKNOWN입니다.
- 현재 외부 처리: Supabase, Vercel, PortOne/NHN KCP/PASS, Firebase FCM, Cloudflare R2, 쏘다/Kakao 알림톡, OpenAI, DeepSeek, 기기/OS 음성 인식, 설정 시 문의 이메일. provider 사용 확정과 계약·account 설정 확정을 혼동하지 않습니다.
- 중단 조건: source-only로 공유=`아니요`, 암호화=`예`, 즉시삭제 또는 retention 기간을 추정하거나 WebView/SDK/PC 연계 처리를 누락.
- provider 공식/계정 matrix: `production-provider-official-attestation.md`.
- 완료 판정: exact release AAB + Production provider 경로 + 계약상 processor/share + 전송 암호화 + 보존·삭제·backup 증거를 하나의 matrix로 닫음.

### Provider r7 출시 판정

- 문서 범위 P0/P1: `0/0` — 공식 기본값과 account `UNKNOWN`을 분리했고 확정되지 않은 PASS를 만들지 않았습니다.
- release P0: 쏘다 Production hop HTTPS, provider별 processor/share, 정책의 활성 provider 표현, FCM 앱 종료/background·잠금화면 exact release E2E, 공개 정책/Data Safety/삭제 parity.
- release P1: Supabase region/backup, R2 jurisdiction/lifecycle, Firebase FID delete, OpenAI sharing/ZDR, DeepSeek opt-out/DPA, PortOne/KCP merchant 계약의 secret-free readback.

## 7. 정부 앱 — 근거 준비, 대표 확인 필요

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 정부 앱`
- 제안 답: `정부기관이 제작·위탁한 앱이 아니며 정부 정보를 제공하는 앱이 아님`.
- 현재 근거: 미용샵 예약·고객관리 기능이며 정부기관 연계·정부 정보 전달 소스를 찾지 못했습니다.
- 대표 사실: 정부기관의 제작비 지원·위탁·공식 제휴·정부 정보 제공이 실제로 없는지 확인.
- 중단 조건: 사업자 등록/법률 안내가 있다는 이유만으로 정부 앱 여부를 작업팀이 대신 단정.
- 완료 판정: 대표 확인 후 해당 없음 저장.

## 8. 금융 기능 — 근거 준비, exact questionnaire·AAB 확인 전 저장 금지

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 금융 기능`
- 현재 근거: PC/backend에는 PortOne/NHN KCP 결제·정기결제·payment history가 있습니다. 수용된 Android consumption-only 계약과 독립 QA는 P0/P1=0이며, Android는 현재 플랜·이용 상태·종료일 조회만 제공합니다.
- Android 경계: 모든 구독·플랜·결제수단·일회성 결제 mutation은 transport 또는 결제 SDK load 전에 차단되고, native inventory에는 Billing SDK·BILLING permission·결제 deep link가 없으며 legacy callback/preview도 Production에서 fail closed입니다.
- 제안 답: 금융상품·대출·송금·투자 서비스는 `아니요` 후보입니다. 다만 Console의 정확한 `모바일 결제/디지털 지갑` 질문 문구와 exact release AAB가 source 계약과 같은지 확인하기 전 확정하지 않습니다.
- 대표 사실: 앱의 사업 목적이 미용샵 운영과 PC에서 확정된 서비스 이용 상태 확인이며 금융상품·송금·투자·지갑 기능을 제공하지 않는다는 제품 경계.
- 중단 조건: 일반 카드결제라는 이유만으로 금융 기능 `아니요` 또는 `예`를 추정, Play Billing 적용 여부를 확인하지 않음.
- 완료 판정: exact release AAB에서 consumption-only 경계 재확인 + Play 결제 정책 검토 + Console 문항별 답 확정.

## 9. 건강 앱 — 대표 사실 필요

- Console 경로: `정책 및 프로그램 > 앱 콘텐츠 > 건강 앱`
- 제안 답: `건강 기능을 제공하지 않음` 후보.
- 현재 근거: 사람의 건강·의료·피트니스 기능은 확인되지 않았습니다. 다만 반려동물 체중·건강 특이사항·미용 후 상태 메모가 있어 단순 문자열 검색만으로 `아니요`를 확정하지 않습니다.
- 대표 사실: 진단·치료·수의료·건강 추천을 제공하지 않고 미용 기록만 다룬다는 제품 경계.
- 중단 조건: 실제 수의/의료 기능이나 건강 주장·추천이 있는데 해당 없음 선택.
- 완료 판정: 대표가 제품 경계를 확정하고 스토어 문구에도 의료 효능 주장이 없음.

## 10. 카테고리·연락처 — 근거 준비 + secure 입력 필요

- Console 경로: `사용자 늘리기 > 스토어 등록정보 > 스토어 설정`
- 제안: 앱 유형 `앱`, 카테고리 `비즈니스`, 태그는 Console에서 실제 제공되는 항목 중 예약/소기업 운영과 직접 관련된 것만 최대 5개.
- 근거: 반려동물 미용샵의 예약·고객·직원·서비스/요금 관리 서비스.
- 연락처: 현재 법적 정보 소스에 값은 있으나 최신성·공개 동의는 대표가 확인합니다. 이 팩에는 값을 복사하지 않습니다.
- secure 입력: 지원 이메일/전화/웹사이트는 Play Console에서 대표가 직접 입력·확인합니다.
- 중단 조건: 개인 연락처를 채팅에 전달, 실제 앱과 무관한 인기 태그 선택.
- 완료 판정: 대표가 공개 연락처 확인 + 비즈니스 카테고리/태그 저장.

## 11. 스토어 등록정보 — 문구 준비, 그래픽 미준비

- Console 경로: `사용자 늘리기 > 스토어 등록정보 > 기본 스토어 등록정보`
- 앱 이름 제안: `넘친데이 펫매니저`
- 짧은/상세 설명: `store-listing-ko.md`의 초안 사용.
- 그래픽: `store-asset-manifest.md` 기준으로 512 아이콘, 1024×500 feature graphic, 최소 2개 phone screenshots 필요.
- 현재 근거: 1300×1300 로고 원본 후보는 있으나 현재 checkout에는 upload-ready 스토어 스크린샷 세트가 없습니다.
- 중단 조건: 실제 고객/직원/연락처가 보이는 화면, demo/fixture를 실제 운영 데이터처럼 오인시키는 캡처, 오래된 UI, 잘못된 비율.
- 완료 판정: 문구 대표 승인 + sanitized exact release 화면 4장 권장 + 필수 그래픽 규격/alt text/브랜드 검수.

## 공식 Google 근거

- [앱 검토 준비와 App content](https://support.google.com/googleplay/android-developer/answer/9859455?hl=ko)
- [Data Safety 작성](https://support.google.com/googleplay/android-developer/answer/10787469?hl=ko)
- [정부 앱 선언](https://support.google.com/googleplay/android-developer/answer/9514050?hl=ko)
- [금융 기능 선언](https://support.google.com/googleplay/android-developer/answer/13849271?hl=ko)
- [건강 앱 선언](https://support.google.com/googleplay/android-developer/answer/14738291?hl=ko)
- [타깃층 및 콘텐츠](https://support.google.com/googleplay/android-developer/answer/9867159?hl=ko)
- [콘텐츠 등급](https://support.google.com/googleplay/android-developer/answer/9859655?hl=ko)
- [앱 카테고리와 태그](https://support.google.com/googleplay/android-developer/answer/9859673?hl=ko)
- [기본 스토어 등록정보](https://support.google.com/googleplay/android-developer/answer/9859152?hl=ko)
- [그래픽 및 스크린샷 규격](https://support.google.com/googleplay/android-developer/answer/9866151?hl=ko)
- [Google Play 결제 정책](https://support.google.com/googleplay/android-developer/answer/9858738?hl=ko)

## 준비도 요약

| 판정 | 수량 | 항목 |
|---|---:|---|
| Console 완료 | 0/11 | 대표 사실·secure 입력·release 검증 없이 완료로 표시하지 않음 |
| 답변 초안 준비 | 11/11 | 본 문서에 제안 답·근거·중단 조건·완료 판정 작성 |
| 근거 준비 | 5/11 | 개인정보, 광고, 정부 앱, 금융, 카테고리·연락처(배포·대표 확인·release 검증 또는 secure 입력 필요) |
| 미준비/대표 사실 필요 | 6/11 | 앱 액세스, 콘텐츠 등급, 타깃층, Data Safety, 건강, 스토어 등록정보 |

`readyCount`는 Console에서 제출 가능한 최종 완료 수를 뜻하므로 현재 `0/11`입니다. 답안 초안 작성 수(`11/11`)와 혼동하지 않습니다.
