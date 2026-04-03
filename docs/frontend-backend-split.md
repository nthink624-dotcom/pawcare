# PawCare 프론트/백엔드 분리 메모

## 실행 명령
- 프론트: 루트에서 `npm run dev:frontend`
- 백엔드: 루트에서 `npm run dev:backend`
- 프론트 기본 주소: `http://localhost:3000`
- 백엔드 기본 주소: `http://localhost:4000`

## 환경 변수 파일
- 프론트: `D:\pawcare\.env.local`
- 백엔드: `D:\pawcare\backend\.env`

## 프론트 env
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 백엔드 env
- `APP_NAME`
- `SITE_URL`
- `FRONTEND_URL`
- `PORT`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEMO_SHOP_ID`
- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_SENDER_KEY`
- `SOLAPI_SENDER_PHONE`

## 현재 인증/권한 흐름
1. 회원가입 화면은 백엔드 `POST /api/auth/signup`으로 아이디 중복 확인과 owner 계정 생성을 요청합니다.
2. 백엔드는 `owner_profiles`와 `shops`를 생성하고, virtual email(`{loginId}@owner.pawcare.local`) 기반 Supabase Auth 유저를 service role로 만듭니다.
3. 로그인 화면은 브라우저 Supabase client로 `signInWithPassword`를 수행하고 세션을 브라우저에 유지합니다.
4. owner 화면과 owner CRUD는 브라우저 세션의 access token을 `Authorization: Bearer`로 백엔드에 전달합니다.
5. 백엔드는 토큰으로 사용자를 검증한 뒤 `owner_profiles.shop_id`, `shops.owner_user_id`를 기준으로 owner scope를 판별하고 service role로 DB 작업을 수행합니다.

## 현재 API 분리 범위
- owner bootstrap: `GET /api/bootstrap`
- 회원가입 중복 확인: `GET /api/auth/check-login-id`
- 회원가입: `POST /api/auth/signup`
- 비밀번호 재설정: `POST /api/auth/reset-password`
- owner CRUD: `appointments`, `guardians`, `pets`, `records`, `notifications`, `services`, `settings`, `customer-page-settings`
- public/customer API: `availability`, `customer-lookup`, `customer-appointments`
- landing API: `landing/interest`, `landing/feedback`

## 수동 체크리스트
- `backend/` 의존성 설치
- `backend/.env`에 실제 `SUPABASE_SERVICE_ROLE_KEY` 입력
- 루트 `.env.local`에 `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` 설정
- Supabase 스키마에 `owner_profiles`, `shops.owner_user_id` 구조가 준비되어 있는지 확인
- 백엔드 실행 환경에서 Supabase 호스트 DNS 해석/HTTPS 접근이 되는지 확인
- 백엔드 실행 후 프론트 로그인, 회원가입, owner CRUD 흐름 점검

## 보류/주의
- 기존 Next `app/api`와 `src/server`는 백엔드 분리 후 제거 대상입니다.
- OAuth callback은 브라우저 세션 교환을 위해 Next 라우트에 최소한으로 남아 있습니다.
