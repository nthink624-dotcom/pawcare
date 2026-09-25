# 공통 폴더 위치와 화면 부품 추출

## 대표 요청과 범위

- 공통 폴더를 apps 안에 두고 웹·모바일이 함께 쓰는 컴포넌트를 분리한다.
- 적용 구조: apps/web, apps/mobile, apps/shared/{components,contracts,lib}.
- 알림톡 계약은 packages/contracts/index.ts에서 apps/shared/contracts/alimtalk.ts로 이동. 문구/변수/버튼 내용 변경 없음.
- 기존 미커밋 작업, 기존 서버, DB, 외부 발송/운영 환경, Git 원격을 변경하지 않는다.
- 기존 통합 작업의 고객 직접 취소 발송 문제는 별건으로 유지한다. 이번 UI 추출에서 발송 동작을 바꾸지 않는다.

## 분리 근거

| 대상 | 이전 책임과 차이 | 이번 변경 | 기능 위험 |
|---|---|---|---|
| form-field | 동일한 label/helper/error 표시, 약 35줄 | 공통 파일 1개, 앱은 재내보내기 | 낮음 |
| mobile-back-button | 동일한 버튼/링크/앵커, 약 80줄 | 공통 파일 1개, 앱은 재내보내기 | 낮음, 링크 속성 보존 검사 |
| app-button | 동일한 렌더링, 크기/글자 스타일만 다름, 약 60줄 | 단일 구현 + 웹/모바일 스타일 선택 | 낮음, ref/이벤트 보존 검사 |
| app-input | 동일한 입력 동작, 글자/포커스 스타일 차이, 약 30줄 | 단일 구현 + 웹/모바일 스타일 선택 | 낮음, ref/이벤트 보존 검사 |

매장 소개 페이지는 소스가 같더라도 앱별 타입·의존 컴포넌트에 연결돼 있어 제외한다. 다른 기본 UI도 플랫폼별 차이를 분석하지 않고 강제로 병합하지 않는다.

## 현재 검증과 복구

- 원본 8개 UI 파일과 이전 계약 폴더는 `.migration-backup/20260925/shared-layout`에 보존했다.
- 추출 전 소스의 서버 렌더링 결과를 해시로 기록한 `scripts/monorepo/shared-ui-before.json`을 사용한다. 현재 결과를 정답으로 다시 기록하지 않는다.
- 웹/모바일 타입 검사 통과. 원본 대비 HTML/스타일/접근성 42가지 + 이벤트/ref 전달 1가지, 총 43개 통과.
- 구조/의존 경계·계약 내용·CSS 생성 검사 10개, HTML/스타일/접근성·이벤트/ref 검사 43개로 총 53개 통과.
- 모바일 정식 build 통과. 웹/모바일의 실제 PostCSS 처리 결과에 공통 스타일이 포함되는 것을 확인했다.
- 원본 보존 검사 1,148개 통과. 의도한 공통 import, UI 연결 파일, CSS 탐색 경로 외 기존 제품 소스는 보존했다.
- npm ci 오프라인 dry-run 통과. 추가 라이브러리 버전 업그레이드나 원격 다운로드 없이 workspace 연결을 변경했다.
- 실제 브라우저 비교와 Android 실기기 검증은 아직 실행하지 않았다. 검사 결과를 그 증거로 대신하지 않는다.
- 기존 전체 통합의 웹 build 차단 문제(고객 직접 취소 시 발송 잔존) 및 정본 서버 전환은 여전히 별개로 남아 있다.

## 담당/진행 정보

work_id: petmanager-shared-components-20260925
risk_tier: NORMAL
write_scope: apps/shared, 앱별 UI 연결 파일 8개, workspace/빌드/CSS 경로, 검증 도구와 문서
acceptance_route: 기존 웹/모바일 화면, 화면 동작 변경 없음
focused_check: npm run test:workspace; npm run typecheck; npm run build:mobile
budget_class: NORMAL

제품 작성자: 주담당 1명. 하위 에이전트 생성 없음.
