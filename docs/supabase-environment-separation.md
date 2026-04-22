# Supabase 환경 분리 가이드

## 왜 나누나요
- 운영 DB는 실제 오너, 고객, 예약, 결제 데이터가 들어 있습니다.
- 로컬 개발이 운영 DB를 같이 보면 테스트 중 실수로 운영 데이터를 건드릴 수 있습니다.
- 특히 결제수단 암호화 키가 섞이면 등록 카드 재결제가 깨질 수 있습니다.

## 가장 쉬운 원칙
- 로컬 개발: 개발용 Supabase
- 실제 서비스(Vercel Production): 운영용 Supabase

즉, 연습장은 개발 DB만 보고 실제 서비스는 운영 DB만 보게 분리합니다.

## 이번 레포에서 추가된 안전장치
- `NEXT_PUBLIC_SUPABASE_ENV_NAME`
- `SUPABASE_ENV_NAME`
- `NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV`
- `ALLOW_PROD_SUPABASE_IN_DEV`

기본 규칙:
- 로컬/프리뷰에서 `*_SUPABASE_ENV_NAME=production` 이면 실행을 막습니다.
- 정말 예외적으로 운영 DB를 봐야 할 때만 `*_ALLOW_PROD_SUPABASE_IN_DEV=true` 로 명시적으로 풀 수 있습니다.

## 로컬 개발용 권장 값
`.env.local`

```env
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_ENV_NAME=development
SUPABASE_ENV_NAME=development
NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
ALLOW_PROD_SUPABASE_IN_DEV=false

NEXT_PUBLIC_SUPABASE_URL=개발용_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=개발용_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=개발용_SERVICE_ROLE_KEY
```

## 운영 서버 권장 값
Vercel Production Environment Variables

```env
NEXT_PUBLIC_SUPABASE_ENV_NAME=production
SUPABASE_ENV_NAME=production
NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
ALLOW_PROD_SUPABASE_IN_DEV=false

NEXT_PUBLIC_SUPABASE_URL=운영용_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=운영용_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=운영용_SERVICE_ROLE_KEY
```

## 실제 작업 순서
1. Supabase에 개발용 프로젝트를 새로 만듭니다.
2. 현재 migration을 개발용 프로젝트에도 적용합니다.
3. 로컬 `.env.local`의 Supabase 값을 개발용으로 바꿉니다.
4. Vercel Production은 운영용 값을 그대로 둡니다.

## 꼭 지켜야 할 것
- 로컬에서 운영 `SUPABASE_SERVICE_ROLE_KEY`를 쓰지 않습니다.
- 결제수단 등록은 운영 서버에서만 진행합니다.
- 로컬에서 운영 DB를 꼭 봐야 하면, 일시적으로만 `ALLOW_PROD_SUPABASE_IN_DEV=true` 를 켭니다.
