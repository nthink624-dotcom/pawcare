# 개발 모드 수동 real provider 연결 계획

## 목적

이 단계의 목적은 운영 기능 전환이 아니라, 개발자가 명시적으로 opt-in 했을 때만 기존 서버 API의 read-only 응답을 앱 provider 경계에서 검증하는 것입니다.

기본 앱 실행은 계속 mock provider를 사용합니다. real provider는 `EXPO_PUBLIC_OWNER_DATA_PROVIDER=real`과 필요한 개발 설정이 모두 준비된 경우에만 후보가 됩니다. 조건이 부족하면 mock으로 조용히 fallback하지 않고, loading/error shell에서 이해 가능한 오류로 다루는 방향을 유지합니다.

이번 계획은 문서화 단계이며, 실제 서버 호출, Supabase 연결, 로그인/session 연결, write 기능 구현은 포함하지 않습니다.

## 수동 access token 주입 방식

로그인/session 연결 전에는 Supabase session에서 access token을 자동으로 가져오지 않습니다. 개발 검증용 access token은 다음 중 하나의 임시 입력 경로로만 주입합니다.

- 개발자 전용 로컬 입력 UI 또는 dev-only 설정 화면에서 런타임에 입력
- 로컬 `.env` 또는 shell 환경변수에서 읽되, git에 커밋되지 않는 파일만 사용
- 테스트/검증 스크립트에서는 injected config 또는 injected loader로 전달

토큰 처리 원칙:

- access token을 소스 코드에 하드코딩하지 않습니다.
- access token을 `docs`, `src`, `scripts`, `package.json`에 기록하지 않습니다.
- `.env.local` 같은 로컬 전용 파일을 쓰는 경우 git ignore 대상인지 먼저 확인합니다.
- 로그, 에러 메시지, 스크린샷에 token 원문을 출력하지 않습니다.
- 실제 session 연결이 들어오기 전까지 token refresh, 자동 재로그인, 저장소 보관은 구현하지 않습니다.

provider에는 최종적으로 다음 형태의 런타임 입력으로 전달하는 것을 권장합니다.

```ts
selectOwnerDataProvider({
  accessToken: manualAccessToken,
  ownerEmail: manualOwnerEmail,
});
```

단, 이 호출을 AppNavigator 기본 경로에 바로 연결하지 않고 dev-only loader나 제한된 화면 연결 단계에서만 사용합니다.

최소 구현 단계에서는 `src/services/manualAccessToken.ts`에 token resolver 타입과 public env guard만 둡니다. 실제 token을 읽거나 저장하지 않으며, `selectOwnerDataProvider()`에는 `accessTokenResolver` 옵션으로만 주입할 수 있게 준비합니다. `options.accessToken` 직접 전달은 기존 테스트 호환용으로 유지하되, 새 개발 경로의 기본값은 resolver 주입입니다.

## 필요한 환경변수

앱 개발 모드 real provider 시범 연결에 필요한 환경변수:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=real
EXPO_PUBLIC_OWNER_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OWNER_API_STAGE=development
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

각 변수의 역할:

- `EXPO_PUBLIC_OWNER_DATA_PROVIDER`: `mock` 또는 `real`. 값이 없으면 mock입니다.
- `EXPO_PUBLIC_OWNER_API_BASE_URL`: 기존 웹/백엔드 API base URL입니다.
- `EXPO_PUBLIC_OWNER_API_STAGE`: `development`, `preview`, `production` 중 하나입니다.
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV`: development/preview에서 production API 접근을 예외적으로 허용할 때만 `true`입니다.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`: 개발 검증 시 사용할 shop id입니다. 없으면 `/api/owner/shops` 응답의 첫 번째 매장을 선택합니다.

access token은 위 환경변수처럼 공개 prefix에 넣는 방식을 기본으로 삼지 않습니다. Expo public env는 번들에 포함될 수 있으므로, 수동 token은 dev-only 런타임 입력 또는 로컬 실행 과정에서만 메모리로 전달하는 방향이 안전합니다.

## 첫 read-only 연결 대상

첫 연결 대상은 `SettingsSummary`를 권장합니다.

이유:

- 예약/고객 화면보다 join 계산과 상태 해석이 적습니다.
- `shop`, `services`, `notification_settings`, `customer_page_settings` 요약 확인에 집중할 수 있습니다.
- 화면에서 write 버튼은 계속 placeholder 또는 disabled 상태로 유지하기 쉽습니다.
- 실제 예약 상태나 고객 목록을 잘못 해석했을 때보다 운영 영향과 혼동 위험이 낮습니다.

권장 순서:

1. Settings summary
2. Reservation list read-only
3. Today home read-only
4. Reservation detail read-only
5. Customer list read-only
6. Customer detail read-only

## 연결 제한 조건

real provider 시범 연결에는 아래 제한을 둡니다.

- 기본값은 항상 mock provider입니다.
- real provider는 `EXPO_PUBLIC_OWNER_DATA_PROVIDER=real`일 때만 후보가 됩니다.
- access token이 없으면 fetch 호출 전에 명확한 error 상태로 중단합니다.
- API base URL이 없으면 fetch 호출 전에 명확한 error 상태로 중단합니다.
- 조건 미충족 시 mock으로 silent fallback하지 않습니다.
- HTTP 요청은 `GET`만 허용합니다.
- `POST`, `PATCH`, `PUT`, `DELETE` 요청을 추가하지 않습니다.
- 예약 상태 변경, 고객 수정/삭제, 설정 저장을 구현하지 않습니다.
- 앱에서 Supabase direct client를 만들지 않습니다.
- `.from()`, `insert`, `update`, `delete`, `upsert` 같은 DB 접근 코드를 추가하지 않습니다.
- development/preview 앱에서 production API를 쓰려면 `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=true`가 명시되어야 합니다.
- 운영 API 연결은 별도 승인 전에는 실행하지 않습니다.

## 예상 구현 순서

다음 구현 단계에서의 권장 순서:

1. dev-only manual token 입력 또는 config 주입 구조를 준비합니다.
2. `useOwnerDataProvider`가 mock 기본값을 유지하면서, dev opt-in 조건에서만 selector를 호출할 수 있게 분리합니다.
3. access token/base URL 누락 시 `ErrorState`로 명확히 표시되는지 확인합니다.
4. real provider를 전체 앱이 아니라 Settings summary 경로에만 제한적으로 연결합니다.
5. `LoadingState`, `ErrorState`, `retry` 경로를 실제 read-only load 흐름에서 확인합니다.
6. env를 `mock` 또는 빈 값으로 되돌렸을 때 즉시 mock provider로 돌아오는지 확인합니다.
7. Settings summary 안정화 후 Reservation list read-only 연결을 검토합니다.

## 위험 요소

주의해야 할 위험:

- access token이 코드, 로그, 스크린샷, 문서, git diff에 노출될 수 있습니다.
- development 앱이 실수로 production API를 바라볼 수 있습니다.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`를 잘못 지정하면 다른 매장 데이터를 검증 대상으로 오해할 수 있습니다.
- `/api/bootstrap` 응답과 `OwnerBootstrapDto`가 어긋나면 화면이 깨질 수 있습니다.
- 401/403, token 만료, shop 권한 없음 상태를 loading/error shell에서 구분해야 합니다.
- Expo public env는 클라이언트 번들에 포함될 수 있으므로 민감 정보를 넣으면 안 됩니다.
- read-only 경계를 유지하지 못하고 write mutation이 섞일 위험이 있습니다.

## 아직 구현하지 않는 항목

이번 계획에는 아래 항목을 포함하지 않습니다.

- 실제 로그인/session 연결
- Supabase access token 자동 획득 또는 refresh
- 앱 내 token 저장
- real provider의 기본 활성화
- 운영 API 호출 실행
- Supabase direct client 연결
- 예약 상태 변경 저장
- 고객 생성/수정/삭제
- 설정 저장
- 알림톡/푸시 알림 구현

## 다음 단계 제안

다음 단계에서는 문서 계획을 기준으로 dev-only manual token loader의 최소 구현 범위를 확정합니다. 구현을 시작하기 전에는 다음 안전 검증을 먼저 유지합니다.

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
```

그 다음 승인된 범위 안에서 Settings summary만 read-only real provider로 시범 연결하고, mock provider로 되돌리는 절차까지 함께 확인합니다.
