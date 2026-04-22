# UI Refactor Priority

## 1. 리팩토링 우선순위

1. `src/components/owner/owner-app.tsx`
2. `src/components/owner/owner-settings-panel.tsx`
3. `src/components/owner/owner-billing-screen.tsx`
4. `src/components/admin/owner-admin-screen.tsx`
5. `src/components/customer/customer-booking-page.tsx`
6. `src/components/auth/signup-form.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/social-signup-complete-form.tsx`
7. 랜딩/법적/데모 페이지

---

## 2. 파일별 문제 요약

### 2.1 `src/components/owner/owner-app.tsx`

- 현재 문제
  - 홈, 예약 조회, 고객관리, 설정 진입, 리스트, 상세, 편집 상태가 한 파일 안에 과도하게 모여 있다.
  - 같은 역할의 섹션 헤더, 상태 배지, empty state, row 블록이 반복된다.
  - 화면군 기준으로는 오너 모바일 앱 문법을 따라야 하는데, 섹션마다 밀도와 구조가 조금씩 다르다.
- 왜 위험한지
  - 작은 UI 변경이 탭 전환, 예약 상태 변경, 고객 선택, 연락 액션에 영향을 줄 수 있다.
- 먼저 분리할 컴포넌트
  - `SectionHeader`
  - `StatusBadge`
  - `EmptyState`
  - 반복 row 블록
- 나중에 분리할 컴포넌트
  - 고객 상세 편집 뷰
  - 예약 상세 편집 뷰
  - 홈 통계 카드
- 코드 수정 시 주의점
  - 예약 상태 변경, 고객 선택/삭제/복구, 알림톡, 빠른 연락 액션 로직 금지

### 2.2 `src/components/owner/owner-settings-panel.tsx`

- 현재 문제
  - 매장 기본 정보, 대표 이미지, 운영시간, 서비스, 계정, 플랜 영역이 한 파일에 같이 있다.
  - 목차형 구조가 약하고, 섹션별 시각 문법이 완전히 고정되지 않았다.
- 왜 위험한지
  - 대표 이미지 업로드, 주소 검색, 운영시간 저장, 서비스 관리 로직이 UI와 가깝다.
- 먼저 분리할 컴포넌트
  - `SettingsSection`
  - `FormField`
  - 운영시간 row
- 나중에 분리할 컴포넌트
  - 대표 이미지 업로드 블록
  - 서비스 관리 리스트
- 코드 수정 시 주의점
  - 업로드, 주소 검색, 운영시간 저장, 서비스 저장 로직 금지

### 2.3 `src/components/owner/owner-billing-screen.tsx`

- 현재 문제
  - 플랜 보기, 비교, 선택 확인, 결제 단계, 서비스 종료 안내가 한 파일에 같이 있다.
  - 모바일 결제 화면 문법은 있어야 하지만 상태별 UI 차이가 커서 일관성이 흔들린다.
- 왜 위험한지
  - PortOne 결제, 성공/실패 분기, 구독 상태 계산과 연결되어 있다.
- 먼저 분리할 컴포넌트
  - `BillingStateCard`
  - 플랜 요약 블록
  - 결제 하단 CTA 블록
- 나중에 분리할 컴포넌트
  - 플랜 비교 테이블
  - 서비스 종료 안내 변형 화면
- 코드 수정 시 주의점
  - 결제 진입, 성공/실패, 환불, 구독 상태 계산 로직 금지

### 2.4 `src/components/admin/owner-admin-screen.tsx`

- 현재 문제
  - 관리자 웹 콘솔 기준이어야 하는데 목록/상세/검색/위험 액션이 한 컴포넌트에 강하게 몰려 있다.
  - 모바일식 정보 카드 표현과 웹 콘솔 밀도 표현이 일부 섞여 있다.
- 왜 위험한지
  - 서비스 기간 변경, 정지/해제, 환불, 결제 상태 동기화와 직접 닿아 있다.
- 먼저 분리할 컴포넌트
  - 검색 바
  - 오너 목록 row
  - 상세 패널 헤더
  - 결제 이력 카드
- 나중에 분리할 컴포넌트
  - 서비스 기간 편집 폼
  - 위험 액션 블록
- 코드 수정 시 주의점
  - 환불, 정지/해제, 서비스 기간 저장, 결제 상태 동기화 로직 금지

### 2.5 `src/components/customer/customer-booking-page.tsx`

- 현재 문제
  - 소비자 예약 단계형 플로우가 한 파일에 과도하게 모여 있다.
  - 선택 카드, 입력 폼, 요약 블록, CTA가 상태별로 달라진다.
- 왜 위험한지
  - 예약 가능 시간 계산, 서비스 duration, validation, 단계 전환과 붙어 있다.
- 먼저 분리할 컴포넌트
  - 단계 헤더
  - 서비스 선택 블록
  - 시간 선택 블록
  - 예약 요약 블록
- 나중에 분리할 컴포넌트
  - 고객 정보 입력 컨테이너
  - 단계별 footer
- 코드 수정 시 주의점
  - 예약 생성, validation, 시간 계산, 단계 전환 로직 금지

### 2.6 `src/components/auth/signup-form.tsx`, `login-form.tsx`, `social-signup-complete-form.tsx`

- 현재 문제
  - 오너 인증은 모바일 기준이어야 하는데, 로그인/회원가입/소셜 가입의 시각 문법이 일부 분리돼 있다.
  - 입력, 약관, 소셜 버튼, 단계 구조가 파일별로 조금씩 다르다.
- 왜 위험한지
  - auth validation, provider callback, 본인인증 흐름과 붙어 있다.
- 먼저 분리할 컴포넌트
  - 입력 field wrapper
  - 약관 row
  - 소셜 버튼 wrapper
- 나중에 분리할 컴포넌트
  - 단계 컨테이너
  - 약관 전용 화면 블록
- 코드 수정 시 주의점
  - validation, provider 처리, 본인인증, callback 로직 금지

### 2.7 랜딩/법적/데모 페이지

- 현재 문제
  - 랜딩은 마케팅 문법, 법적 페이지는 문서 문법, 데모는 시연 문법이어야 한다.
  - 앱 UI 기준을 그대로 들이대면 문법이 섞일 위험이 있다.
- 왜 위험한지
  - 서비스 신뢰도와 정보 전달 속도에 바로 영향이 간다.
- 먼저 분리할 컴포넌트
  - 랜딩 섹션 헤더
  - legal page layout
  - 데모 안내 블록
- 나중에 분리할 컴포넌트
  - 공통 CTA 배너
- 코드 수정 시 주의점
  - 마케팅 카피 구조, 법적 문구 구조 금지

---

## 3. 내비게이션/헤더/CTA 통일 점검 항목

### 3.1 `src/components/owner/owner-app.tsx`

- 화면군 분류: 오너 모바일 앱
- 모바일 기준인지 PC 기준인지: 모바일 기준
- 뒤로가기 위치: 메인 탭 화면은 없음, 하위 상세/편집은 좌측 상단 기준 유지 여부 확인
- 닫기 위치: 바텀시트/모달일 때만 우측 상단 사용 여부 확인
- 페이지 제목 위치: 좌측 정렬 유지 여부 확인
- 상단 우측 액션 사용 여부: 저장/확정 같은 메인 CTA가 상단 우측에 들어가 있지 않은지 확인
- 하단 CTA 사용 여부: 저장/주요 행동은 하단 full-width 또는 섹션 하단인지 확인
- 목록/상세/편집 전환 방식: 탭 전환과 인라인 전환이 과하게 섞이지 않는지 확인
- 모달/바텀시트/사이드패널/페이지전환 구분: 바텀시트 우선, 모바일에서 사이드패널 금지
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - 상태 배지
  - 섹션 헤더
  - empty state 문구
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - 하단 탭
  - 모바일 바텀시트
  - full-width CTA 배치 문법
- 주의:
  - 고객관리는 현재 모바일 기준
  - 향후 고객관리 PC 버전과 혼동하지 말 것

### 3.2 `src/components/owner/owner-settings-panel.tsx`

- 화면군 분류: 오너 모바일 앱
- 모바일 기준인지 PC 기준인지: 모바일 기준
- 뒤로가기 위치: 좌측 상단 뒤로가기
- 닫기 위치: 설정 상세 모달/시트에서만 우측 상단
- 페이지 제목 위치: 좌측 정렬
- 상단 우측 액션 사용 여부: 저장 CTA 상단 우측 배치 금지
- 하단 CTA 사용 여부: 저장 CTA는 하단 기준
- 목록/상세/편집 전환 방식: 설정 목차 → 상세/편집 진입 구조 유지
- 모달/바텀시트/사이드패널/페이지전환 구분: 모바일 상세/편집은 페이지 전환 또는 바텀시트
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - field wrapper
  - status badge
  - section title hierarchy
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - 하단 저장 CTA 문법
  - 모바일 섹션 카드 구조
- 주의:
  - 설정 상세/편집은 좌측 상단 뒤로가기 + 하단 저장 CTA 기준

### 3.3 `src/components/owner/owner-billing-screen.tsx`

- 화면군 분류: 오너 모바일 결제
- 모바일 기준인지 PC 기준인지: 모바일 기준
- 뒤로가기 위치: 좌측 상단 뒤로가기 또는 단계 내 고정 위치
- 닫기 위치: 결제 중단 레이어 상황에서만 우측 상단
- 페이지 제목 위치: 좌측 정렬
- 상단 우측 액션 사용 여부: 결제/확인 CTA 상단 우측 배치 금지
- 하단 CTA 사용 여부: 결제 단계 CTA는 하단 full-width
- 목록/상세/편집 전환 방식: 플랜 보기 → 선택 → 확인 → 결제 단계 유지
- 모달/바텀시트/사이드패널/페이지전환 구분: 단계 전환 중심, 바텀시트는 보조 수단
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - 상태 카드
  - 플랜 정보 블록
  - 상태 배지
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - 하단 full-width 결제 CTA
  - 모바일 단계 footer
- 주의:
  - 결제 단계 CTA는 하단 full-width 기준

### 3.4 `src/components/admin/owner-admin-screen.tsx`

- 화면군 분류: 관리자 PC 웹 콘솔
- 모바일 기준인지 PC 기준인지: PC 기준
- 뒤로가기 위치: 모바일 뒤로가기 금지
- 닫기 위치: 상세 패널 우측 상단
- 페이지 제목 위치: 상단 헤더 좌측 또는 breadcrumb 하단
- 상단 우측 액션 사용 여부: 허용, 단 메인 액션/필터/도구 구분 필요
- 하단 CTA 사용 여부: 상세 패널 하단 danger block 또는 저장 영역에서만 사용
- 목록/상세/편집 전환 방식: 목록 + 상세 패널 구조 유지
- 모달/바텀시트/사이드패널/페이지전환 구분:
  - 사이드패널 우선
  - 바텀시트 금지
  - 위험 액션은 confirm dialog 허용
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - 검색 바
  - 상태 배지
  - 테이블 row / 상세 패널 section
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - full-width CTA
  - 모바일 카드형 리스트
- 주의:
  - 모바일 뒤로가기 금지
  - 상세 패널/검색/목록/위험 액션 기준 적용

### 3.5 `src/components/customer/customer-booking-page.tsx`

- 화면군 분류: 소비자 예약 모바일
- 모바일 기준인지 PC 기준인지: 모바일 기준
- 뒤로가기 위치: 단계 안에서 고정
- 닫기 위치: 예약 중단/조회 종료 같은 레이어 상황에서만 우측 상단
- 페이지 제목 위치: 단계 제목은 좌측 정렬, 진행 상태 위치 고정
- 상단 우측 액션 사용 여부: 메인 CTA 상단 우측 배치 금지
- 하단 CTA 사용 여부: 다음/예약하기 하단 full-width
- 목록/상세/편집 전환 방식: 단계형 플로우 유지
- 모달/바텀시트/사이드패널/페이지전환 구분:
  - 단계 전환 우선
  - 바텀시트는 보조 선택 레이어
  - 사이드패널 금지
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - 상태 배지
  - 요약 블록 정보 위계
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - 하단 예약 CTA 배치 문법
  - 모바일 단계 footer
- 주의:
  - 단계형 플로우 기준 적용

### 3.6 `src/components/auth/signup-form.tsx`, `login-form.tsx`, `social-signup-complete-form.tsx`

- 화면군 분류: 오너 인증/가입 모바일
- 모바일 기준인지 PC 기준인지: 모바일 기준
- 뒤로가기 위치: 좌측 상단 또는 단계 흐름에 맞춘 고정 위치
- 닫기 위치: 약관/보조 레이어에서만 우측 상단
- 페이지 제목 위치: 좌측 정렬
- 상단 우측 액션 사용 여부: 메인 CTA 상단 우측 금지
- 하단 CTA 사용 여부: 로그인/가입/다음 단계 CTA는 하단 기준
- 목록/상세/편집 전환 방식: 단계 분리 우선
- 모달/바텀시트/사이드패널/페이지전환 구분:
  - 모바일 단계형
  - 관리자 사이드패널 문법 금지
- 향후 PC 확장 시 재사용 가능한 컴포넌트:
  - field wrapper
  - 상태 배지
  - empty state 문구
- 향후 PC 확장 시 재사용하면 안 되는 모바일 전용 컴포넌트:
  - 소셜 로그인 버튼 배치 문법
  - 모바일 하단 CTA 배치
- 주의:
  - 오너 인증은 모바일 기준
  - 관리자 인증과 문법 혼합 금지

---

## 4. 공통 컴포넌트 후보

### AppButton

- 목적: 버튼 의미를 통일
- props 후보: `variant`, `size`, `fullWidth`, `disabled`, `leadingIcon`, `trailingIcon`
- 쓸 화면: 오너 모바일, 소비자 예약, 관리자 일부
- 모바일/웹 공용 여부: 공용, 단 배치 규칙은 화면군별 분리

### AppInput

- 목적: 기본 input 문법 통일
- props 후보: `label`, `helperText`, `errorText`, `placeholder`, `type`, `value`, `onChange`
- 쓸 화면: 인증, 설정, 관리자 상세
- 모바일/웹 공용 여부: 공용

### AppTextarea

- 목적: textarea 규격 통일
- props 후보: `label`, `helperText`, `errorText`, `placeholder`, `rows`, `value`, `onChange`
- 쓸 화면: 설정, 메모, 관리자 메모
- 모바일/웹 공용 여부: 공용

### SectionHeader

- 목적: 섹션 제목/설명/보조 액션 통일
- props 후보: `title`, `description`, `actionLabel`, `onAction`
- 쓸 화면: 오너 앱, 소비자 예약, 관리자 상세 패널
- 모바일/웹 공용 여부: 공용

### StatusBadge

- 목적: 상태 문구/색상 통일
- props 후보: `status`, `labelOverride`, `size`
- 쓸 화면: 예약, 결제, 구독, 관리자 상태
- 모바일/웹 공용 여부: 공용

### ListRow

- 목적: 리스트 정보 위계 통일
- props 후보: `title`, `subtitle`, `meta`, `leading`, `trailing`, `onClick`
- 쓸 화면: 고객 목록, 예약 목록, 설정 메뉴
- 모바일/웹 공용 여부: 공용

### InfoCard

- 목적: 요약 카드 통일
- props 후보: `title`, `value`, `description`, `footer`, `tone`
- 쓸 화면: 홈 요약, 결제 상태, 관리자 상세
- 모바일/웹 공용 여부: 공용

### ActionBar

- 목적: 검색/필터/선택 관리 바 통일
- props 후보: `leading`, `trailing`, `compact`, `tone`
- 쓸 화면: 고객관리, 예약조회, 관리자 목록
- 모바일/웹 공용 여부: 공용

### BottomSheet

- 목적: 모바일 선택/보조 레이어 통일
- props 후보: `open`, `title`, `description`, `children`, `onClose`
- 쓸 화면: 오너 모바일, 소비자 예약 모바일
- 모바일/웹 공용 여부: 모바일 전용

### SidePanel

- 목적: 관리자 상세 패널 통일
- props 후보: `open`, `title`, `children`, `onClose`, `width`
- 쓸 화면: 관리자 콘솔, 향후 고객관리 PC
- 모바일/웹 공용 여부: 웹 전용

### EmptyState

- 목적: 빈 화면 문구/행동 통일
- props 후보: `title`, `description`, `actionLabel`, `onAction`, `icon`
- 쓸 화면: 고객 없음, 예약 없음, 검색 결과 없음
- 모바일/웹 공용 여부: 공용

### ConfirmDialog

- 목적: 위험 행동 최종 확인
- props 후보: `open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone`
- 쓸 화면: 삭제, 환불, 정지, 취소
- 모바일/웹 공용 여부: 공용

### SearchBar

- 목적: 검색 입력 구조 통일
- props 후보: `value`, `onChange`, `placeholder`, `trailingAction`
- 쓸 화면: 고객관리, 예약조회, 관리자 목록
- 모바일/웹 공용 여부: 공용

### FormField

- 목적: label + helper/error 묶음 통일
- props 후보: `label`, `required`, `helperText`, `errorText`, `children`
- 쓸 화면: 설정, 인증, 관리자 상세
- 모바일/웹 공용 여부: 공용

### SettingsSection

- 목적: 설정 섹션 블록 통일
- props 후보: `title`, `description`, `children`
- 쓸 화면: 오너 설정
- 모바일/웹 공용 여부: 모바일 중심, 필요 시 웹 전용 변형

### BillingStateCard

- 목적: 플랜/구독/서비스 기간 정보 통일
- props 후보: `planName`, `priceLabel`, `status`, `startDate`, `endDate`, `action`
- 쓸 화면: 오너 결제, 설정
- 모바일/웹 공용 여부: 모바일 중심

### CustomerListItem

- 목적: 고객 row 정보 위계 통일
- props 후보: `name`, `phone`, `pets`, `selected`, `onSelect`, `onOpen`
- 쓸 화면: 고객관리 모바일, 향후 고객관리 PC
- 모바일/웹 공용 여부: 공용, 단 레이아웃 변형 필요

### AppointmentListItem

- 목적: 예약 row 정보 위계 통일
- props 후보: `status`, `customerName`, `petName`, `serviceName`, `dateTime`, `onOpen`
- 쓸 화면: 예약조회, 소비자 예약 관리
- 모바일/웹 공용 여부: 공용, 단 레이아웃 변형 필요

---

## 5. 작업 순서

1. 기준표 확정
2. 디자인 토큰 정리
3. 공통 컴포넌트 생성
4. 오너 앱 적용
5. 예약/고객관리/설정 적용
6. 결제/관리자 적용
7. 소비자 예약/인증/랜딩 정리

---

## 6. 주의사항

- 이번 작업에서는 코드 수정하지 말고 문서 작성만 한다.
- 추상적인 표현 대신 숫자와 위치 기준을 사용한다.
- 현재 프로젝트 구조에서 실현 가능한 수준으로만 작성한다.
- 과도한 디자인 시스템 구축보다 MVP SaaS 운영에 필요한 수준으로 정리한다.

