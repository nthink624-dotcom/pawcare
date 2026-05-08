# Read-Only Owner Data Provider Plan

## Summary

오너 앱의 실제 데이터 연결은 앱에서 Supabase를 직접 호출하지 않고, 기존 웹/백엔드의 owner API를 호출하는 방식으로 진행한다.

추천 연결 경로는 `GET /api/bootstrap`이다. 기존 API는 `Authorization: Bearer <access_token>`으로 오너를 검증하고, `shopId` 소유권 확인과 Supabase service role 접근을 서버에서 처리한다. 앱은 API 응답을 `OwnerBootstrapDto`로 정규화한 뒤 기존 ViewModel 변환 함수를 사용한다.

이번 문서는 구현 계획만 정리한다. 실제 Supabase/API 호출, 로그인/session 연결, 쓰기 기능, 푸시 알림 구현은 다음 단계 전까지 추가하지 않는다.

## Current Web Reference

기존 웹 기준본 `D:\petmanager`에서 확인한 흐름은 다음과 같다.

- 오너 웹은 `/api/owner/shops`로 로그인 사용자가 소유한 매장 목록을 먼저 가져온다.
- 선택된 `shopId`를 `localStorage`에 저장한 뒤 `/api/bootstrap?shopId=...`를 호출한다.
- 인증은 Supabase browser session에서 access token을 가져와 `Authorization: Bearer <token>` 헤더로 전달한다.
- 서버는 `requireOwnerShop(request, requestedShopId)`에서 토큰 검증, 계정 정지 여부, 소유 매장 접근 권한을 확인한다.
- `/api/bootstrap` owner scope 응답은 `BootstrapPayload` 전체를 반환한다.

참고한 기존 웹 파일:

- `D:\petmanager\src\app\owner\page.tsx`
- `D:\petmanager\src\app\api\bootstrap\route.ts`
- `D:\petmanager\src\app\api\owner\shops\route.ts`
- `D:\petmanager\src\server\owner-api-auth.ts`
- `D:\petmanager\src\server\bootstrap.ts`
- `D:\petmanager\src\lib\api.ts`
- `D:\petmanager\backend\src\server.ts`
- `D:\petmanager\docs\frontend-backend-split.md`

## Recommended Connection

앱은 직접 Supabase 호출을 보류하고 기존 API 호출을 사용한다.

직접 Supabase 호출을 피하는 이유:

- 앱에 DB schema, row filter, owner 권한 검증 로직이 퍼질 수 있다.
- 운영 DB에 대한 실수 위험이 커진다.
- 기존 서버 API가 이미 owner token 검증과 shop ownership 검증을 수행한다.
- write 기능을 열기 전까지 앱 provider를 read-only `GET` 호출로 제한하기 쉽다.

기존 API 호출을 쓰는 이유:

- `/api/owner/shops`와 `/api/bootstrap` 흐름이 오너 웹에서 이미 검증되어 있다.
- `BootstrapPayload`와 앱 `OwnerBootstrapDto` 구조가 대부분 일치한다.
- `landingInterests`, `landingFeedback`처럼 앱에 필요 없는 필드만 무시하면 된다.

## Provider Shape

`realOwnerDataProvider`는 이후 구현 단계에서 다음 입력으로 생성한다.

```ts
type RealOwnerDataProviderConfig = {
  apiBaseUrl: string;
  accessToken: string;
  shopId?: string;
  ownerEmail?: string | null;
  today?: string;
};
```

동작 순서:

1. 로그인/session 연결 전에는 mock provider를 유지한다.
2. session 연결 후 access token을 확보한다.
3. `GET /api/owner/shops`로 소유 매장 목록을 조회한다.
4. `shopId`가 있으면 해당 매장이 목록에 있는지 확인하고, 없으면 첫 번째 매장을 선택한다.
5. `GET /api/bootstrap?shopId=...`를 호출한다.
6. API 응답을 앱의 `OwnerBootstrapDto`로 normalize한다.
7. `ownerProfile.email`은 bootstrap 응답이 아니라 session user email 또는 provider config의 `ownerEmail`로 채운다.
8. 기존 `buildSettingsSummaryViewModel`, `buildAppointmentRows`, `buildTodayHomeViewModel` 등을 그대로 사용한다.

`OwnerDataProvider` 메서드는 현재 동기 형태이므로 실제 API 연결 단계에서는 다음 중 하나를 선택해야 한다.

- 권장: provider 생성 시 bootstrap을 먼저 load하고, 생성된 provider는 현재처럼 동기 getter를 제공한다.
- 대안: `OwnerDataProvider`를 async getter 기반으로 바꾸고 화면 loading/error 상태를 함께 도입한다.

첫 read-only 연결에서는 변경 범위를 줄이기 위해 “먼저 bootstrap을 load한 뒤 동기 provider 생성” 방식을 사용한다.

## DTO Compatibility

기존 웹 `BootstrapPayload`와 앱 `OwnerBootstrapDto`는 핵심 필드가 일치한다.

- `mode`
- `shop`
- `guardians`
- `deletedGuardians`
- `pets`
- `services`
- `appointments`
- `groomingRecords`
- `notifications`

차이점:

- 기존 웹 응답에는 `landingInterests`, `landingFeedback`가 포함된다.
- 앱 DTO에는 `ownerProfile.email`이 추가되어 있다.
- 앱에서는 landing 관련 필드를 버리고, `ownerProfile.email`을 session/config에서 주입한다.

normalize 정책:

- 알 수 없는 추가 필드는 버린다.
- 필수 배열 필드가 없으면 빈 배열로 보정하지 말고 오류로 처리한다. 서버 계약이 깨진 상태를 조용히 숨기지 않기 위해서다.
- `deletedGuardians`는 없을 수 있으므로 optional로 유지한다.
- status/source 값은 기존 enum 그대로 유지하고 화면 라벨은 ViewModel에서 변환한다.

## Environment Variables

앱에서 사용할 환경변수:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock
EXPO_PUBLIC_OWNER_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OWNER_API_STAGE=development
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
```

의미:

- `EXPO_PUBLIC_OWNER_DATA_PROVIDER`: `mock` 또는 `real`
- `EXPO_PUBLIC_OWNER_API_BASE_URL`: 기존 Next API 또는 분리 백엔드 base URL
- `EXPO_PUBLIC_OWNER_API_STAGE`: `development`, `preview`, `production`
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV`: 개발 앱에서 운영 API 접근을 명시적으로 허용할 때만 `true`

기존 API 서버/웹 기준 환경변수:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 서버 측 `SUPABASE_SERVICE_ROLE_KEY`

개발 base URL 후보:

- Next API: `http://localhost:3000`
- 분리 백엔드: `http://localhost:4000`

운영 base URL:

- `https://www.petmanager.co.kr`

## Safety Rules

read-only 단계에서는 다음 제한을 둔다.

- `realOwnerDataProvider`는 `GET` 요청만 사용한다.
- `POST`, `PATCH`, `PUT`, `DELETE` 요청은 추가하지 않는다.
- `insert`, `update`, `delete`, `upsert` 같은 Supabase write 성격의 호출을 앱에 추가하지 않는다.
- 앱에는 Supabase service role key를 절대 넣지 않는다.
- `EXPO_PUBLIC_OWNER_API_STAGE !== "production"` 상태에서 운영 API base URL을 쓰려면 `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=true`가 필요하다.
- 조건 미충족 시 mock으로 조용히 fallback하지 않고 명시적 오류 상태를 보여준다.

검증 스크립트에서 확인할 항목:

- `realOwnerDataProvider` 코드에 mutation HTTP method가 없는지 확인
- `realOwnerDataProvider` 코드에 직접 Supabase write keyword가 없는지 확인
- base URL 누락 시 명확한 configuration error
- access token 누락 시 API 호출 전 unauthenticated error

## CORS And Auth Risks

가능한 이슈:

- Expo native 앱은 웹과 달리 쿠키 기반 same-origin 전제가 약하다.
- 기존 API는 Bearer token 인증이므로 쿠키보다 앱에 적합하지만, CORS에서 `Authorization` header가 허용되어야 한다.
- Next App Router API를 원격 앱에서 호출할 때 배포 환경의 CORS 정책을 별도로 확인해야 할 수 있다.
- 분리 Express 백엔드는 `CORS_ORIGINS`와 `allowedHeaders: ["Content-Type", "Authorization"]` 설정을 확인해야 한다.
- access token 만료 시 refresh/session 복구는 로그인 단계에서 별도 설계해야 한다.

## First Read-Only Target

첫 연결 대상은 `SettingsSummary`를 권장한다.

이유:

- `shop`, `services`, `notification_settings`, `customer_page_settings` 중심이라 join 위험이 낮다.
- write 버튼은 계속 placeholder/disabled 상태로 유지할 수 있다.
- 운영 DB를 건드리지 않고 API 응답 구조 확인에 적합하다.

이후 연결 순서:

1. `SettingsScreen` summary
2. `ReservationListScreen`
3. `TodayHomeScreen`
4. `ReservationDetailScreen`
5. `CustomerListScreen`
6. `CustomerDetailScreen`

## Implementation Order

1. 앱 env helper를 추가한다.
2. read-only fetch helper를 추가한다.
3. `/api/owner/shops` 응답 타입을 앱 내부 타입으로 정의한다.
4. `/api/bootstrap` 응답을 `OwnerBootstrapDto`로 normalize하는 함수를 추가한다.
5. `createLoadedRealOwnerDataProvider(config, bootstrap)` 형태로 동기 getter provider를 만든다.
6. session 연결 단계에서 access token과 owner email을 받은 뒤 real provider를 생성한다.
7. provider 선택 로직은 `mock` 기본값을 유지하고, 명시적으로 `real`일 때만 real provider를 사용한다.
8. 첫 화면은 `SettingsSummary`만 read-only real data로 검증한다.

## Test Plan

기존 검증:

- `npm run check:viewmodels`
- `npm run typecheck`
- `npm run web`

다음 구현 단계에서 추가할 검증:

- base URL 누락 시 configuration error 확인
- access token 누락 시 API 호출하지 않고 unauthenticated error 확인
- `/api/bootstrap` 응답에서 앱 DTO 필드만 normalize하는지 확인
- `ownerProfile.email`이 provider config에서 주입되는지 확인
- `landingInterests`, `landingFeedback`가 앱 DTO에 남지 않는지 확인
- `realOwnerDataProvider` 코드에 write method와 Supabase write keyword가 없는지 확인
- mock provider 기본 화면이 그대로 동작하는지 확인

## Next Step

다음 단계에서는 문서 기준으로 “read-only real provider 최소 구현”을 진행한다.

아직 포함하지 않을 것:

- 실제 로그인/session 구현
- 예약 상태 변경 저장
- 고객 수정/삭제
- 설정 저장
- 푸시 알림
- 앱에서 직접 Supabase 호출

첫 구현 목표는 access token을 외부에서 주입받는 `realOwnerDataProvider`와 normalize/test까지만 제한한다.
