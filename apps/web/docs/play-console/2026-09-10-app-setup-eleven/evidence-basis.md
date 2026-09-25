# 확인 근거와 provenance

기준 시각: 2026-09-10 KST. 이 파일은 값·credential·개인정보를 기록하지 않습니다.

## 저장소 기준선

| 영역 | 확인값 | 의미 |
|---|---|---|
| PC/shared authority | `D:\petmanager`, HEAD `22d0b02b59483f8a32965308e24860e5643d645e` | 현재 소스 확인 기준. dirty 작업은 수정하지 않음 |
| Mobile authority | `D:\petmanager-app`, HEAD `b7d24a3109a1b8e0dbc8019b1f9c25de27348efe` | 현재 소스 확인 기준. porcelain 230건으로 dirty |
| Accepted mobile manifest | `docs/release-control/PM_MOBILE_ANDROID_PRODUCTION_RELEASE_20260901.accepted-source-manifest-r4.md` | SHA-256 `1B55B3B0A05AACEB4D862184506EA155CED0E1181D94CDD1AB65B599F1F93F02`; 다수 current path가 divergent로 기록됨 |

현재 내부 테스트 v5 또는 제출 대상 AAB가 어느 exact source/tree를 담는지는 이 단계에서 확인하지 않았습니다. 따라서 current source 또는 accepted manifest만으로 실제 AAB 동작을 완료 판정하지 않습니다.

## 핵심 파일 해시

| 근거 | SHA-256 | 확인한 의미 |
|---|---|---|
| `D:\petmanager\src\lib\legal\privacy-policy.ts` | `8583E8C4B622BDE3EF758FE333AF50D6585D10C2F2620FF7D1D99597C7031CF7` | 2026-09-10 PC 공개 정본 소스; 전체 데이터 흐름·UNKNOWN 경계 |
| `D:\petmanager-app\src\lib\legal\privacy-policy.ts` | `D76244B69D3B33DB14881DDFBFE7A0574C79F0D93A8312E424A9D44146F703D3` | 2026-09-10 모바일 내장 정책; 줄바꿈 정규화 후 PC 정본 본문 byte-equivalent |
| `D:\petmanager\tests\server\owner-account-deletion-contract.test.mjs` | `018F15AEDCDBD091320204673308588226ACF9A83CDDFE2BC488D32F886AC717` | 공개 정책·계정삭제의 확정/미확정 경계 계약 |
| `D:\petmanager-app\tests\mobile-owner-account-deletion-contract.test.mjs` | `FF0B85F34FEE1B7E5B7283D5059071102550AE0A1FCBCA34581D199B4403FEB6` | 모바일 내장 정책 parity·계정삭제 계약 |
| `D:\petmanager-app\tests\mobile-android-consumption-only-contract.test.mjs` | `6F41B091168F4453054DEE39816ABCABA623F34EB92E6D3152E7F556134DF072` | Android 상태 조회 전용·mutation 선차단 계약 |
| `D:\petmanager-app\src\lib\brand.ts` | `29BEF74EBF9C2647654BA88E11558CBA80C3A00544447D8C4C07B45AB8A44467` | 앱 이름과 기본 설명 후보 |
| `D:\petmanager-app\android\app\src\main\AndroidManifest.xml` | `490FB94674C8D2141A1EE3CE6C9E1D5EB2A7148DECE12D9C8E0284F635101962` | INTERNET, CAMERA, RECORD_AUDIO, POST_NOTIFICATIONS 권한 |
| `D:\petmanager-app\android\app\build.gradle` | `066F4874E0E0114F59B1076D84B9E0B11E03555AAC7931DA2508498DD531B639` | package/version/target SDK source 근거 |
| `D:\petmanager-app\capacitor.config.ts` | `5674DFED338F58ECA51C7F4CA411FD806DD918FA3B5BC638422AD92E4A1936BD` | hybrid app runtime 구성 근거 |
| `D:\petmanager-app\package.json` | `36B383BC0C9A7A254F774B7562DFDBE3494344815ABF5CF0D7B57237AECA46B6` | push/Firebase/PortOne 관련 dependency 근거 |
| `D:\petmanager-app\docs\android-play-release-checklist.md` | `03FF96EA5D9D9993FDE39A9F0B0711632369F1606682AEEB86C1FE79DFCBEF5F` | Android consumption-only 출시 계약 |
| `D:\petmanager-app\src\server\owner-push-delivery.ts` | `C506C7F783856461848CAC9BFE4AE88678B9251D9980C6C29CC180746FA9A493` | FCM notification/data payload, high priority, private visibility, 24시간 TTL |
| `D:\petmanager-app\src\lib\push\owner-push-notifications.ts` | `9493969E6B472DAD4F38910D8E16C250AA4E19B591329D7D41FA038B056ADB0C` | 기본 off, 권한 후 token 등록, off 시 registry 삭제·unregister 경계 |
| `D:\petmanager\src\server\alimtalk-provider.ts` | `4B89380212E6572AAB78CAB234A5DA06CA6679EA14266C23DE17CF056C24923F` | 쏘다 relay/direct payload와 runtime URL 경계; HTTPS scheme 강제 없음 |
| `D:\petmanager-app\public\images\brand\nemchin-day-logo-square.png` | `FD12F0DDE49B688E8385EE334E83F00663D32A98B7AD1A27D4D8BB83DF168017` | 1300×1300 로고 원본 후보 |

## 확인한 제품 경계

- 로그인 필요: owner mobile route는 비로그인에서 로그인 화면으로 이동하며 reviewer credential은 준비되지 않았습니다.
- 광고: source dependency/manifest에서 광고 SDK 근거를 찾지 못했지만 exact AAB와 WebView runtime 확인 전 `광고 없음` 확정 금지입니다.
- 정책 parity: PC와 모바일은 2026-09-10 본문으로 정합화되었고, 줄바꿈 정규화 후 export 본문 일치가 확인되었습니다. 공개 배포본과 exact release AAB 반영 여부는 별도 확인 대상입니다.
- 결제: 수용된 Android consumption-only 소스와 독립 QA P0/P1=0에 따라 상태 조회만 허용하고 모든 결제 mutation을 transport/SDK load 전에 차단합니다. exact release AAB 결속은 별도 확인 대상입니다.
- 데이터: Auth, 매장·고객·반려동물·예약·직원, 사진·private metadata, OpenAI 1회 파생 이미지, 활성 시 DeepSeek text-only care facts, FCM token·일반 알림, PC 결제 상태, 계정삭제, 문의·선택 캡처가 있어 Data Safety 최상위 `수집 예`가 확정 출발점입니다.
- provider 사용 여부: 대표는 Supabase, Cloudflare R2, Firebase Cloud Messaging, OpenAI, DeepSeek, PortOne/NHN KCP/PASS, 쏘다 알림톡의 운영 사용을 확정했습니다. 이 확인은 계약 법인·DPA·region·TLS·보존·학습·삭제 설정을 확정하지 않습니다.
- provider 보존·공유·암호화: 공식 기본정책과 PetManager 계정 설정을 분리한 결과는 `production-provider-official-attestation.md`에 있습니다. source의 HTTPS 또는 provider 마케팅 문구만으로 TLS 전 구간·공유 예외·계약상 보존 기간을 확정하지 않습니다.
- FCM 필수성: 앱 종료/background·잠금화면 알림 기능은 release 필수지만 Android 권한과 앱 설정은 사용자 선택입니다. 따라서 token/기기 ID는 `예 / 선택 / 앱 기능`이며 강제 등록으로 해석하지 않습니다.

## 외부 동작

- Play Console 읽기·쓰기: 0
- AAB 생성·업로드: 0
- DB/Auth/provider/API 호출·쓰기: 0
- 심사 계정 생성: 0
- C: worktree/artifact: 0
