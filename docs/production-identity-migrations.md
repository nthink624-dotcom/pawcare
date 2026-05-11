# 운영 DB 본인인증 마이그레이션

운영 Supabase SQL Editor에서 아래 SQL을 한 번 실행해야 아이디 찾기, 비밀번호 재설정, 회원가입 본인인증을 웹과 앱에서 같이 사용할 수 있습니다.

## 1. 본인인증 요청/결과 테이블

```sql
create table if not exists owner_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup', 'reset-password', 'find-login-id')),
  verification_method text not null check (verification_method in ('local', 'portone')),
  status text not null default 'requested' check (status in ('requested', 'verified', 'consumed', 'failed')),
  name text not null,
  birth_date text not null,
  phone_number text not null,
  challenge_code_hash text,
  challenge_expires_at timestamptz,
  verification_attempt_count int not null default 0,
  verification_token_id uuid,
  verified_at timestamptz,
  verified_expires_at timestamptz,
  consumed_at timestamptz,
  consumed_action text,
  provider_identity_verification_id text,
  provider_status text,
  provider_customer_id text,
  provider_customer_name text,
  provider_customer_phone_number text,
  provider_customer_birth_date text,
  ci text,
  di text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists owner_identity_verifications_provider_identity_verification_id_key
  on owner_identity_verifications(provider_identity_verification_id)
  where provider_identity_verification_id is not null;

create index if not exists owner_identity_verifications_status_idx
  on owner_identity_verifications(status, verified_expires_at desc, challenge_expires_at desc);

create index if not exists owner_identity_verifications_purpose_idx
  on owner_identity_verifications(purpose, created_at desc);
```

## 2. 오너 프로필 본인확인 식별 해시

```sql
alter table if exists owner_profiles
  add column if not exists ci_hash text,
  add column if not exists di_hash text;

create index if not exists owner_profiles_ci_hash_idx
  on owner_profiles(ci_hash)
  where ci_hash is not null;

create index if not exists owner_profiles_di_hash_idx
  on owner_profiles(di_hash)
  where di_hash is not null;
```

## 운영 환경 변수 확인

웹과 앱은 같은 웹 URL/API를 사용하므로 운영 서버에 아래 값이 모두 있어야 합니다.

```env
NEXT_PUBLIC_SUPABASE_ENV_NAME=production
SUPABASE_ENV_NAME=production
NEXT_PUBLIC_PORTONE_STORE_ID=...
NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY=...
PORTONE_API_SECRET=...
AUTH_FLOW_SECRET=...
```

앱은 Capacitor WebView가 운영 웹 URL을 여는 구조입니다. `apps/owner-mobile/.env`의 `OWNER_WEB_URL`을 운영 웹 주소로 두면 웹과 앱이 같은 Supabase/PortOne 설정을 함께 사용합니다.
