# PetManager Release Checklist

PetManager 업데이트 전후로 확인할 운영 점검표입니다. 목적은 배포 성공 여부가 아니라, 실제 원장과 고객이 쓰는 핵심 흐름이 깨지지 않았는지 확인하는 것입니다.

## Release Levels

업데이트 크기에 따라 점검 범위를 다르게 가져갑니다.

- 소규모 UI/문구 수정: 기본 자동 점검 + 핵심 스모크 테스트
- 로그인, 예약, 스케줄, 상태, 사진 수정: 기본 자동 점검 + 핵심 수동 회귀 테스트
- DB, API, 알림톡, 결제, 권한 수정: 전체 점검표 수행
- production Supabase 쓰기 작업 포함: 작업 전 대상 프로젝트, 테이블, 샵, 날짜, 변경 목적을 먼저 명시

## Pre-Deploy Automated Checks

배포 전에 로컬에서 먼저 실행합니다.

```bash
npm run check:supabase-env
npm run lint
npm run typecheck
npm run build
```

미디어/사진 관련 변경이 있으면 추가로 실행합니다.

```bash
npm run check:media-architecture
npm run media:schema-rest-check
```

로컬 서버를 띄운 뒤 원장 로그인 스모크 테스트를 실행합니다.

```bash
npm run server:up
npm run smoke:owner-login
npm run server:down
```

기대 결과:

- Supabase 환경이 development 또는 production 한 프로젝트로만 일치한다.
- TypeScript, lint, Next build가 모두 통과한다.
- 원장 로그인 API가 세션 access token과 refresh token을 반환한다.
- 미디어 관련 변경 시 스키마와 아키텍처 검사가 통과한다.

## Environment Safety

production Supabase에 쓰기 작업을 하기 전 반드시 아래를 먼저 확인합니다.

- 대상 프로젝트 ref
- 대상 테이블 또는 migration
- 대상 shop id
- 대상 날짜 또는 예약 id
- schema-only 작업인지 data-changing 작업인지
- 테스트 데이터가 production에 들어가지 않는지
- 로컬 `.env.local`이 production Supabase를 기본으로 가리키지 않는지

정상 운영 기본값:

- local/development: 개발, 테스트, seed, 스크린샷, 파괴적 실험
- production: 실제 원장, 고객, 예약, 결제, 알림 데이터
- 별도 Supabase Dev 프로젝트는 owner가 명시적으로 재도입하지 않는 한 사용하지 않음

자세한 규칙은 `docs/supabase-environment-separation.md`를 따릅니다.

## Login And Account

- 원장 로그인 성공
- 잘못된 아이디 입력 시 자연스러운 실패 메시지
- 잘못된 비밀번호 입력 시 자연스러운 실패 메시지
- 로그인 후 보호 페이지 접근 가능
- 로그아웃 정상 동작
- 로그아웃 후 보호 페이지 접근 차단
- 브라우저 새로고침 후 세션 유지
- 세션 만료 시 로그인 화면 또는 재인증 흐름으로 이동
- 다른 기기 로그인 후 주요 화면 접근 가능
- 아이디 찾기 동작
- 비밀번호 찾기 요청 동작
- 비밀번호 재설정 링크 진입 동작
- 만료되었거나 잘못된 재설정 링크 안내 메시지
- 새 비밀번호 설정 후 새 비밀번호로 로그인 가능
- 비밀번호 변경 후 기존 비밀번호로 로그인 불가

## Customer Booking

- 고객 예약 페이지 접속
- 샵 정보 표시
- 서비스 목록 표시
- 서비스별 가격/소요시간 표시
- 날짜 선택
- 영업일만 예약 가능
- 휴무일 예약 불가
- 영업시간 밖 예약 불가
- 직원 근무시간 밖 예약 불가
- 서비스 소요시간이 예약 가능 시간 계산에 반영
- 동시 수용 인원 초과 예약 불가
- 같은 직원에게 시간이 겹치는 예약 생성 불가
- 고객명, 연락처, 반려동물 정보 필수값 검증
- 잘못된 전화번호 입력 처리
- 예약 완료 화면 표시
- 예약 완료 후 원장 PC 화면에 반영
- 예약 완료 후 원장 모바일 화면에 반영
- 모바일 Safari와 Android Chrome에서 입력창, 날짜 선택, 버튼이 정상 동작

## Owner PC Schedule

- 원장 PC 로그인 후 스케줄 진입
- 오늘 날짜 스케줄 표시
- 이전 날짜 chevron 버튼 동작
- 다음 날짜 chevron 버튼 동작
- 가운데 날짜 텍스트 버튼 동작
- 직원 컬럼 표시
- 시간 grid 라인 표시
- 예약 카드가 예약 시간 위치에 표시
- 같은 직원의 예약 카드가 서로 겹치지 않음
- 예약 카드가 흰 배경, 부드러운 neutral border, 8px radius 기준을 유지
- 상태는 카드 전체 색상이 아니라 작은 dot로 표시
- 선택/드래그/포커스 상태가 과한 ring이나 `border-2`를 쓰지 않음
- 진행 중 또는 픽업 준비 예약 중 현재 시간 안에 있는 가장 이른 예약이 current-work anchor가 됨
- 시간이 지난 active status 예약이 current-work anchor가 되지 않음
- 외부 상태 변경이 PC 화면에 주기적으로 반영
- 예약 생성, 변경, 취소 후 화면 데이터가 갱신

## Owner Mobile

- 모바일 원장 로그인
- 오늘 예약 목록 표시
- 예약 상세 진입
- 예약 상태 변경
- 상태 변경 후 PC 스케줄에 반영
- PC에서 변경한 상태가 모바일에 반영
- 미용 시작 상태 변경 전 사진 요구
- 픽업 준비 상태 변경 전 사진 요구
- 사진 없이 필수 상태 변경 불가
- 360px대 작은 화면에서 버튼/텍스트 겹침 없음
- 390-430px 기준 주요 원장 작업 가능
- 태블릿 세로/가로에서 주요 화면이 깨지지 않음

## Appointment Status

- 예약 확정 상태 표시
- 미용 시작 상태 표시
- 픽업 준비 상태 표시
- 완료 상태 표시
- 취소 상태 표시
- PC와 모바일이 같은 appointment API를 통해 같은 상태를 표시
- API 직접 호출로도 사진 필수 상태 규칙이 우회되지 않음
- demo, mock, seed 데이터도 같은 상태 규칙을 따름
- 상태 변경 실패 시 원장에게 실패 이유 표시
- 중복 클릭 시 중복 상태 변경이 발생하지 않음

## Photo And Media

- 미용 시작 사진 촬영 또는 선택
- 픽업 준비 사진 촬영 또는 선택
- 모바일 카메라 촬영
- 모바일 갤러리 선택
- PC 파일 선택
- 업로드 중 로딩 표시
- 업로드 실패 시 재시도 가능
- 큰 이미지 업로드 시 클라이언트 압축 또는 안내 동작
- 잘못된 파일 형식 처리
- 업로드 완료 후 예약 상세에서 사진 표시
- PC에서 사진 확인
- 모바일에서 사진 확인
- Supabase Storage 권한 정상
- 사진 metadata 저장 정상
- notification attachment 연결 정상
- production에서 테스트 사진이 실제 고객 예약에 잘못 연결되지 않음

## Alimtalk And Customer Notifications

PetManager 기본 정책은 owner-action/manual 발송입니다. owner가 다시 승인하지 않는 한 background cron, scheduled auto-send, automatic reminder dispatch를 추가하지 않습니다.

- 알림톡 발송 버튼 표시
- 원장이 직접 누른 경우에만 발송
- 예약 확정 알림톡 발송
- 예약 변경 알림톡 발송
- 예약 취소 알림톡 발송
- 미용 시작 알림톡 발송
- 픽업 준비 알림톡 발송
- 사진 첨부 알림 동작
- 고객 전화번호 오류 시 실패 처리
- 알림 provider 오류 시 실패 처리
- 발송 성공/실패 상태 표시
- 발송 이력 저장
- 중복 클릭 시 중복 발송 방지
- 실제 고객 번호 테스트 전 내부 테스트 번호로 먼저 확인
- 자동 예약 알림 또는 자동 리마인더가 새로 생기지 않았는지 확인

## Staff Weekly Schedule

- 주간 근무표 페이지 진입
- 탭이 테이블 위에 표시
- active tab이 neutral selected style 유지
- inactive tab은 plain text와 subtle hover 유지
- 날짜 이동 row가 별도 bordered surface로 표시
- 왼쪽 chevron, 가운데 plain date text, 오른쪽 chevron 패턴 유지
- staff weekly schedule date range에 bordered date chip이나 calendar icon을 쓰지 않음
- 컬럼은 `스태프명`, `월`, `화`, `수`, `목`, `금`, `토`, `일`
- 직원명은 bold, 역할/서비스는 작은 muted text
- 근무 cell은 soft green fill, green border/text
- 휴무 cell은 soft gray fill, gray-blue border/text
- cell height는 `h-9` 기준 유지
- 기본 근무 설정은 기본 접힘 상태
- dropdown header 클릭 후 요일/시간 설정 표시
- 근무/휴무 선택 color-coded 표시
- 저장 후 새로고침해도 유지
- 근무시간 변경 후 고객 예약 가능 시간이 반영
- 기존 예약과 충돌하는 근무 변경 처리 확인

## Customer-Facing Pages

- 고객 예약 링크 접속
- 샵 소개/운영정보 표시
- 서비스 선택 가능
- 예약 가능한 날짜/시간만 표시
- 예약 완료 후 확인 화면 표시
- 예약 조회 또는 예약 관리 화면이 있다면 진입 가능
- 고객 개인정보가 다른 샵에 노출되지 않음
- iPhone Safari에서 키보드가 올라와도 주요 버튼 접근 가능
- Android Chrome에서 날짜/시간 선택 동작

## Admin And Operations

- admin 로그인
- 알림톡 runtime 상태 확인
- 알림톡 template 등록/조회 화면 확인
- owner admin 계정 관리 화면 확인
- 환경 상태 확인 화면 확인
- 운영자가 owner 계정을 잘못 변경하지 않도록 확인 메시지 또는 로그 확인

## Billing And Payments

결제 기능을 수정한 배포에서 확인합니다.

- 요금제 조회
- 결제수단 등록
- 결제 성공 후 구독 상태 반영
- 결제 실패 안내
- 결제 취소 또는 중단 시 상태 보존
- 구독 만료 처리
- 테스트 결제 key와 production 결제 key 혼동 없음
- 결제 webhook 처리
- webhook 재시도 또는 중복 수신 시 idempotency 확인

## Security And Permissions

- 비로그인 사용자가 원장 페이지 접근 불가
- 다른 샵 데이터 접근 불가
- API 직접 호출에도 shop 권한 검증
- service role key가 클라이언트 bundle에 노출되지 않음
- 브라우저 콘솔에 민감한 token, key, 개인정보 출력 없음
- 사진 URL 접근 범위가 의도와 일치
- 고객 전화번호, 사진, 예약정보가 다른 샵에 노출되지 않음
- Supabase RLS 또는 server-side authorization이 우회되지 않음

## Browser And Device Matrix

최소 확인 기기:

- PC Chrome
- PC Edge
- iPhone Safari
- Android Chrome
- iPad 또는 Android tablet
- 360px대 작은 모바일
- 390-430px 기본 모바일
- 태블릿 세로
- 태블릿 가로

## Post-Deploy Smoke Test

배포 직후 production에서 최소 한 번 확인합니다.

- 메인 페이지 접속
- 원장 로그인
- 오늘 스케줄 조회
- 내부 테스트 고객으로 예약 1건 생성
- 원장 PC에서 예약 확인
- 원장 모바일에서 예약 확인
- 예약 상태 변경
- 필수 상태에서 사진 업로드
- 내부 테스트 번호로 알림톡 수동 발송
- 고객 예약 페이지 접속
- 서버/API 에러 로그 확인
- 브라우저 콘솔 에러 확인
- Supabase 로그 확인

production에서 테스트 예약을 만들었다면 점검 후 즉시 운영 정책에 맞게 취소 또는 정리합니다.

## Rollback Readiness

- 이전 배포 버전 확인
- Vercel rollback 가능 여부 확인
- DB migration이 backward-compatible인지 확인
- 되돌릴 수 없는 migration이면 사전 backup 또는 별도 승인 필요
- 알림톡/결제 provider 설정 변경 내역 기록
- 배포 후 장애 발생 시 owner 공지 문구 준비

## Automated Test Strategy

자동 테스트는 가능합니다. 다만 모든 것을 100% 자동화하기보다 아래처럼 나누는 것이 현실적입니다.

### Already Available

현재 repo에서 바로 사용할 수 있는 자동 점검:

- `npm run check:supabase-env`: Supabase 환경 혼합 방지
- `npm run lint`: 정적 lint
- `npm run typecheck`: TypeScript 타입 검사
- `npm run build`: production build
- `npm run smoke:owner-login`: 개발 owner 생성 후 로그인 API smoke test
- `npm run check:media-architecture`: 미디어 구조 점검
- `npm run media:schema-rest-check`: 미디어 schema/API readiness 점검

### Recommended Next Automation

추가하면 좋은 자동 테스트:

- Playwright E2E: 브라우저에서 원장 로그인, 고객 예약, 원장 스케줄 확인
- Playwright mobile viewport: 390x844, 430x932, tablet viewport 확인
- API integration test: 예약 생성, 예약 변경, 상태 변경, 사진 필수 규칙 검증
- Availability test: 영업시간, 휴무, 서비스 duration, 동시 capacity, 직원별 non-overlap 검증
- Password reset test: reset request API와 callback route 검증
- Media upload smoke: upload intent, complete, variant, attachment 연결 검증
- Notification dry-run test: 실제 발송 대신 provider mock으로 payload와 이력 저장 검증
- Production smoke test: 배포 URL 기준 읽기/로그인 중심의 짧은 테스트

추천 script 예시:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:mobile": "playwright test --project=mobile-chrome",
    "test:api": "node scripts/smoke-api-release.cjs",
    "release:preflight": "npm run check:supabase-env && npm run lint && npm run typecheck && npm run build"
  }
}
```

### What To Automate First

1. 원장 로그인
2. 고객 예약 생성
3. 원장 PC 스케줄에 예약 표시
4. 예약 상태 변경
5. 사진 없이 미용 시작/픽업 준비가 실패하는지
6. 사진 첨부 후 상태 변경이 성공하는지
7. 알림톡 provider mock으로 수동 발송 API가 성공 이력을 남기는지
8. 같은 직원에게 겹치는 예약이 막히는지

이 8개가 자동화되면 업데이트 후 가장 위험한 회귀를 빠르게 잡을 수 있습니다.

### What Should Stay Manual Or Semi-Manual

아래는 자동화만 믿으면 안 됩니다.

- 실제 알림톡이 휴대폰에 도착하는지
- 알림톡 템플릿이 provider 심사/운영 설정과 맞는지
- 실제 모바일 카메라 권한과 촬영 UX
- iOS Safari 키보드, 파일 선택, 카메라 edge case
- Android 제조사별 카메라/갤러리 edge case
- 실제 결제 승인/취소
- owner가 보는 문구가 운영 현장에서 자연스러운지

이 항목은 자동 테스트 결과와 함께 release day checklist로 사람이 확인합니다.

## Suggested Release Routine

소규모 업데이트:

```bash
npm run check:supabase-env
npm run lint
npm run typecheck
npm run build
```

핵심 기능 업데이트:

```bash
npm run check:supabase-env
npm run lint
npm run typecheck
npm run build
npm run server:up
npm run smoke:owner-login
npm run server:down
```

사진/알림톡/DB 업데이트:

```bash
npm run check:supabase-env
npm run check:media-architecture
npm run media:schema-rest-check
npm run lint
npm run typecheck
npm run build
```

자동 테스트가 추가된 이후에는 배포 전 `release:preflight`, `test:e2e`, `test:api`를 CI와 로컬에서 같이 실행하는 것을 목표로 합니다.
