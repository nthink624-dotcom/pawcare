# Settings Summary Read-Only Trial Plan

## 목적

이 단계의 목적은 전체 앱을 real provider로 전환하지 않고, 개발자가 명시적으로 opt-in 했을 때만 `SettingsScreen`의 summary 데이터 일부를 기존 서버 API의 read-only 응답으로 확인하는 것입니다.

기본 실행은 계속 mock provider입니다. 예약, 고객, 오늘 홈, 상세 화면은 이번 연결 대상이 아닙니다. 실제 구현 전 이 문서로 연결 범위와 안전장치를 고정합니다.

## Settings Summary를 첫 대상으로 삼는 이유

`SettingsSummary`는 첫 read-only 연결 대상으로 가장 안전합니다.

- 예약/고객 화면보다 join 계산과 상태 전이가 적습니다.
- 확인 대상이 `shop`, `services`, `notification_settings`, `customer_page_settings` 요약에 집중됩니다.
- 설정 저장 버튼이나 로그아웃은 계속 placeholder 상태로 유지할 수 있습니다.
- 실제 예약 상태, 고객 목록, 미용 기록을 잘못 노출하거나 해석할 위험이 낮습니다.
- API 응답과 `OwnerBootstrapDto` 변환 흐름이 맞는지 작은 화면에서 먼저 확인할 수 있습니다.

## 연결 범위

real provider는 전체 앱 provider로 교체하지 않습니다.

권장 연결 방식:

1. `AppNavigator`의 기본 `useOwnerDataProvider()` 흐름은 mock-only로 유지합니다.
2. `Today`, `Reservations`, `Customers` 탭은 계속 mock `ownerDataProvider`를 사용합니다.
3. `SettingsRoute`에서만 dev-only read-only loader를 별도로 호출할 수 있게 준비합니다.
4. loader가 ready 상태이면 `SettingsScreen`에는 real bootstrap에서 만든 `SettingsSummaryViewModel`만 전달합니다.
5. loader가 disabled, idle, missing-token, error 상태이면 기존 mock `ownerDataProvider.getSettingsSummary()`를 유지하거나 명확한 `ErrorState`를 표시합니다.

즉, real 연결의 결과물은 provider 전체가 아니라 `SettingsSummaryViewModel` 하나입니다.

## AppNavigator 변경 방향

`AppNavigator`는 전체 구조를 바꾸지 않습니다.

허용 가능한 최소 변경:

- `SettingsRoute` 내부 또는 별도 `SettingsSummaryRoute` hook에서만 dev-only loader를 사용합니다.
- `MainTabsNavigator`가 예약/고객/오늘 탭에 넘기는 `ownerDataProvider`는 그대로 mock provider입니다.
- real provider, `selectOwnerDataProvider`, manual token resolver는 전체 app data provider 로더에 연결하지 않습니다.

구현 시 AppNavigator 검증 기준:

- `TodayRoute`, `ReservationListRoute`, `CustomerListRoute`는 기존 mock provider 사용을 유지합니다.
- Settings 이외 화면에 real provider 결과를 넘기지 않습니다.
- real mode 조건이 충족되어도 예약/고객 화면은 mock 데이터로 표시됩니다.

## Mock 기본값 유지 방법

기본값은 아래 조건에서 모두 mock입니다.

- `EXPO_PUBLIC_OWNER_DATA_PROVIDER`가 없는 경우
- `EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock`인 경우
- manual access token이 없는 경우
- API base URL이 없는 경우
- public token env guard에 걸리는 경우
- production API가 development/preview에서 차단되는 경우

real 조건 미충족 시 mock으로 조용히 fallback하지 않는 원칙은 유지합니다. 다만 Settings read-only trial의 UI에서는 두 상태를 구분합니다.

- trial 자체가 disabled이면 mock summary를 정상 표시합니다.
- trial이 `real`로 명시되었지만 조건이 부족하면 `ErrorState`를 표시합니다.

## Manual Access Token 주입

access token은 코드, 문서, git tracked 파일에 저장하지 않습니다.

권장 방식:

- `manualAccessToken.ts`의 `ManualAccessTokenResolver`를 통해 런타임에만 전달합니다.
- 개발 검증용 UI를 만들더라도 token은 메모리 상태에만 둡니다.
- `.env`에 token을 넣지 않습니다.
- 특히 `EXPO_PUBLIC_*TOKEN*` 또는 `EXPO_PUBLIC_*ACCESS_TOKEN*` 형태의 public env는 금지합니다.
- `assertNoPublicAccessTokenEnv()`가 real trial 진입 전 실행되어야 합니다.

이번 Settings summary trial 구현 단계에서도 token storage, token refresh, 실제 login/session 연결은 하지 않습니다.

## API Base URL / ShopId 설정

필요한 환경변수:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=real
EXPO_PUBLIC_OWNER_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OWNER_API_STAGE=development
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

설정 방식:

- `EXPO_PUBLIC_OWNER_API_BASE_URL`은 기존 웹/백엔드 API base URL입니다.
- `EXPO_PUBLIC_OWNER_API_STAGE`는 development, preview, production 중 하나입니다.
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=true` 없이는 development/preview에서 production API를 차단합니다.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`가 있으면 해당 매장을 선택하고, 없으면 `/api/owner/shops`의 첫 번째 매장을 선택합니다.
- shop id가 현재 owner token의 소유 매장이 아니면 error 상태로 처리합니다.

## Loading / Error 표시

Settings trial의 상태 처리는 기존 공통 컴포넌트를 사용합니다.

- loading: `LoadingState`
- error: `ErrorState`
- retry: 동일 loader 재실행
- disabled 또는 mock mode: 기존 mock settings summary 표시
- ready: real bootstrap에서 변환한 `SettingsSummaryViewModel` 표시

real mode로 명시했는데 token/base URL/shop 권한/API 응답이 실패하면 Settings 화면 영역 또는 화면 전체에서 명확한 에러를 보여줍니다. 이때 예약/고객 탭의 mock 동작은 영향을 받지 않아야 합니다.

## GET Only 확인 방법

실제 구현 후 검증 기준:

- Settings summary trial loader가 호출하는 경로는 기존 `loadRealOwnerBootstrap()`을 통해 `GET /api/owner/shops`, `GET /api/bootstrap?shopId=...`만 사용합니다.
- `fetch` 호출의 method는 항상 `GET`입니다.
- `POST`, `PATCH`, `PUT`, `DELETE`를 추가하지 않습니다.
- Supabase direct client, `.from()`, `insert`, `update`, `delete`, `upsert`를 추가하지 않습니다.
- `npm run check:provider`에 Settings trial loader의 GET-only 검증을 추가합니다.

## Token이 코드/git에 남지 않게 하는 방법

검증 기준:

- source, scripts, docs에 실제 token/JWT/service key 문자열이 없어야 합니다.
- `EXPO_PUBLIC_*TOKEN*=` 형태의 public token env 예시는 추가하지 않습니다.
- 테스트에는 `test-access-token` 같은 가짜 문자열만 사용합니다.
- 실행 로그와 에러 메시지에는 token 원문을 포함하지 않습니다.
- `.env.local`을 사용해야 하는 단계가 오면 git ignore 상태를 먼저 확인합니다.

## 연결 후 검증 순서

구현 후 검증 순서:

1. `EXPO_PUBLIC_OWNER_DATA_PROVIDER` 값 없음: 앱 전체 mock, Settings mock 표시
2. `EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock`: 앱 전체 mock, Settings mock 표시
3. real mode + token 없음: fetch 전 `ErrorState`, fetch 호출 0회
4. real mode + API base URL 없음: fetch 전 `ErrorState`, fetch 호출 0회
5. real mode + public token env 있음: fetch 전 `ErrorState`, fetch 호출 0회
6. real mode + injected loader: Settings summary만 ready, 예약/고객/오늘 화면은 mock 유지
7. real mode + mock fetch: `/api/owner/shops`, `/api/bootstrap` GET-only 확인
8. mock mode로 되돌리면 Settings도 mock summary로 복귀

실행할 명령:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
npm run web
```

## 아직 구현하지 않는 항목

이번 설계 및 다음 최소 구현에서도 제외할 항목:

- 전체 앱 real provider 전환
- 예약/고객/오늘 홈 real 연결
- 예약 상태 변경 저장
- 고객 생성/수정/삭제
- 설정 저장
- 알림톡/푸시 알림
- Supabase direct client 연결
- 실제 로그인/session 연결
- token 저장, refresh, 자동 재로그인

## 다음 구현 단계 제안

다음 단계에서는 Settings summary 전용 dev-only loader hook을 추가합니다. 이 hook은 mock 기본값을 유지하고, real mode opt-in + manual token resolver가 있을 때만 `selectOwnerDataProvider()`를 호출한 뒤 `provider.getSettingsSummary()` 결과만 Settings 화면에 전달합니다.

구현 완료 기준은 Settings 화면만 read-only real summary를 표시할 수 있고, 다른 탭은 mock provider를 그대로 사용하는 것입니다.
