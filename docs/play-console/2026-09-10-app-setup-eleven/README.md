# Google Play 앱 설정 11개 준비 묶음

- 업무: `PM_GOOGLE_PLAY_APP_SETUP_ELEVEN_20260910`
- 기준일: 2026-09-10 KST
- 범위: 현재 `D:\petmanager`, `D:\petmanager-app`, `D:\petmanager-shared` 소스와 Google 공식 문서의 읽기 전용 대조
- 실행하지 않은 것: Play Console 입력·저장·제출, 심사 계정 생성, AAB 업로드, 외부 API/DB/Auth 호출

## 현재 판정

- Play Console 완료: **0/11** (대표가 제공한 현재 Dashboard 상태)
- 최종 제출 가능한 답: **0/11** — 로컬 정책 parity와 Android consumption-only 소스는 닫혔지만 공개 배포본, exact release AAB, 대표 사실, provider 보관·공유·암호화, 심사 계정이 함께 닫힌 항목은 아직 없습니다.
- 입력 초안 준비: **11/11** — 각 항목의 제안 답, 근거, 보류 조건, Console 경로를 `console-answer-pack.md`에 정리했습니다.
- 스토어 문구 초안: **2/2** — 80자 이내 짧은 설명과 4,000자 이내 상세 설명은 `store-listing-ko.md`에 있습니다.
- 필수 그래픽 업로드본: **0세트** — 1300×1300 로고 원본 후보는 있으나 현재 checkout에 승인 가능한 스토어 스크린샷 세트가 없고, Google Play 규격·개인정보·현재 release UI 검수를 마친 최종 파일도 없습니다.

## 파일 구성

1. `console-answer-pack.md`: 11개 항목별 실제 입력 초안과 중단 조건
2. `store-listing-ko.md`: 한국어 앱 이름·짧은 설명·상세 설명·스크린샷 문구
3. `store-asset-manifest.md`: 필수 자산 규격, 현재 후보, 제작·검수 목록
4. `representative-question-sequence.md`: 대표에게 한 번에 하나씩 확인할 질문 순서와 secure 입력 경계
5. `evidence-basis.md`: 확인한 리비전·소스 해시와 증거 한계
6. `production-provider-official-attestation.md`: 운영 provider별 공식 기본정책, 계정 `UNKNOWN`, Data Safety acceptance matrix

## 가장 중요한 선행 차단

1. PC·모바일 로컬 정책은 2026-09-10 본문으로 일치시켰지만 공개 `/privacy` 배포·readback과 exact release 앱 결속이 남았습니다.
2. 비식별 심사 전용 계정과 결제/PASS/2FA 없이 재현 가능한 심사 접근 방법이 없습니다.
3. 운영 provider 사용 목록은 대표 확정으로 닫혔지만 이는 계약·계정 설정 증거가 아닙니다. Data Safety는 수집 `예`가 확실하고 공유·전 구간 암호화·보존·삭제와 음성 인식 처리는 여전히 미확정입니다.
4. Android consumption-only 소스와 독립 QA P0/P1=0은 닫혔습니다. exact release AAB가 같은 mutation 선차단·Billing SDK/permission 없음 계약을 포함하는지 결속 증명이 남았습니다.
5. 현재 모바일 checkout은 dirty이고 accepted source manifest의 여러 해시와 달라 내부 테스트 v5가 현재 어떤 소스를 포함하는지 확정되지 않았습니다.

## 다음 실행 순서

`쏘다 HTTPS 전 구간 확인` → `provider 계약·계정 설정 readback` → `정합 정책 공개 배포·readback` → `clean release 후보와 merged manifest/AAB 감사` → `심사 계정 별도 승인·생성` → `Data Safety 최종 분류` → `스토어 그래픽 제작·독립 검수` → `Play Console 입력·저장 승인`
