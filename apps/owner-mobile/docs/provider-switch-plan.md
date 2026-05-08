# Provider Switch Plan

## Summary

오너 앱의 기본 데이터 provider는 계속 mock provider로 유지한다. 개발자가 명시적으로 환경변수를 설정하고 access token을 주입한 경우에만 read-only real provider를 시범 로드할 수 있게 한다.

이번 단계는 설계 문서 작성 단계다. 실제 화면을 real provider로 전환하지 않고, 실제 서버 호출도 실행하지 않는다. 로그인/session 연결, 쓰기 기능, 알림톡/푸시 구현도 포함하지 않는다.

## Provider Selection

provider 선택 기본 규칙:

| `EXPO_PUBLIC_OWNER_DATA_PROVIDER` | 선택 provider |
| --- | --- |
| 값 없음 | mock |
| `mock` | mock |
| `real` | real 후보 |
| 그 외 값 | mock |

real provider는 후보일 뿐이며, 아래 조건이 모두 충족되어야 실제로 로드한다.

- `EXPO_PUBLIC_OWNER_API_BASE_URL`이 설정되어 있다.
- owner access token이 외부에서 주입되어 있다.
- development/preview 앱에서 production API를 사용할 경우 `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=true`가 명시되어 있다.
- `shopId`는 `EXPO_PUBLIC_OWNER_DEV_SHOP_ID` 또는 `/api/owner/shops` 응답에서 선택할 수 있다.

조건이 충족되지 않으면 mock으로 조용히 fallback하지 않는다. real provider를 명시했는데 조건이 부족하면 화면에 명확한 개발용 오류 상태를 보여주는 방식으로 처리한다.

## Environment Variables

앱 환경변수:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock
EXPO_PUBLIC_OWNER_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OWNER_API_STAGE=development
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

의미:

- `EXPO_PUBLIC_OWNER_DATA_PROVIDER`: `mock` 또는 `real`. 기본값은 mock.
- `EXPO_PUBLIC_OWNER_API_BASE_URL`: 기존 Next API 또는 분리 백엔드 base URL.
- `EXPO_PUBLIC_OWNER_API_STAGE`: `development`, `preview`, `production`.
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV`: development/preview에서 production API 접근을 허용할 때만 `true`.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`: 개발 검증용 shop 선택값. 없으면 `/api/owner/shops`의 첫 번째 shop 사용.

access token은 환경변수로 장기 저장하지 않는다. 로그인/session 구현 전까지는 개발 검증용 수동 입력 또는 임시 TODO 주입 지점으로만 다룬다.

## Real Provider Load Flow

개발 모드 real provider 시범 로드 순서:

1. 앱 시작 시 `getOwnerApiConfig()`로 provider mode와 API 설정을 읽는다.
2. mode가 `mock`이거나 비어 있으면 `createMockOwnerDataProvider()`를 사용한다.
3. mode가 `real`이면 access token 존재 여부를 먼저 확인한다.
4. access token이 없으면 API 호출을 하지 않고 개발용 오류 상태를 반환한다.
5. `assertOwnerApiConfigIsSafe()`로 production API 차단 조건을 확인한다.
6. `GET /api/owner/shops`로 소유 매장 목록을 읽는다.
7. `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`가 있으면 해당 shop을 선택하고, 없으면 첫 번째 shop을 선택한다.
8. `GET /api/bootstrap?shopId=...`를 호출한다.
9. `toOwnerBootstrapDto()`로 응답을 앱 DTO로 변환한다.
10. 변환된 bootstrap으로 `createRealOwnerDataProvider(bootstrap)`을 생성한다.

현재 화면 구조의 `OwnerDataProvider`는 동기 getter 기반이다. 따라서 real provider는 화면 렌더 전 bootstrap을 먼저 비동기로 로드한 뒤, 로드된 bootstrap을 가진 동기 provider를 생성하는 방식이 가장 작다.

## Screen Attachment Policy

이번 단계에서는 화면을 real provider로 전환하지 않는다.

다음 구현 단계에서 화면 연결을 하더라도 한 번에 전체 화면을 바꾸지 않는다. 권장 순서:

1. 개발용 provider selection hook 또는 loader shell 추가
2. real mode일 때 loading/error 상태만 표시
3. `SettingsScreen` summary만 read-only real data로 검증
4. 그 뒤 예약/고객 화면으로 확대

`AppNavigator.tsx`는 현재처럼 mock provider 기본값을 유지한다. real provider import와 호출은 다음 승인 단계에서만 추가한다.

## Safety Guardrails

반드시 유지할 안전장치:

- 기본값은 mock provider.
- real provider는 `EXPO_PUBLIC_OWNER_DATA_PROVIDER=real`일 때만 후보가 된다.
- access token이 없으면 fetch를 호출하지 않는다.
- API 요청은 `GET`만 허용한다.
- `POST`, `PATCH`, `PUT`, `DELETE` 추가 금지.
- Supabase 직접 client, `.from()`, `insert`, `update`, `delete`, `upsert` 추가 금지.
- 앱에 Supabase service role key 저장 금지.
- development/preview에서 production API는 allow flag 없이 차단.
- 조건 미충족 시 silent fallback 금지.

검증 명령:

```bash
npm run check:provider
npm run check:viewmodels
npm run typecheck
```

추가로 코드 검색에서 mutation method와 직접 Supabase client 연결이 없어야 한다.

## Not Implemented Yet

아직 구현하지 않는 항목:

- 실제 로그인/session 연결
- Supabase access token 자동 획득/refresh
- 화면의 real provider 전환
- 예약 상태 변경 저장
- 고객 생성/수정/삭제
- 설정 저장
- 알림톡/푸시 알림
- 앱에서 직접 Supabase DB 접근
- 운영 API 실데이터 연결 실행

## Next Implementation Step

다음 단계에서는 실제 서버 호출을 실행하기 전에 provider 선택 함수 또는 loader hook을 추가한다.

권장 구현 범위:

- `selectOwnerDataProvider()` 또는 `useOwnerDataProvider()` 초안 추가
- 기본 mode에서 mock provider 반환 확인
- `real` mode에서 access token 없으면 fetch 없이 오류 반환 확인
- 화면에는 아직 mock provider 유지 또는 개발용 loading/error shell만 연결
- `npm run check:provider`에 provider 선택 조건 테스트 추가
