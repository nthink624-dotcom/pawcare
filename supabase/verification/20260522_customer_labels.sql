-- Title: 2026-05-22 고객/반려동물 라벨 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 고객관리/고객 상세에서 오너가 직접 붙이는 태그와 주의 라벨을 DB에 저장합니다.
-- Note: 노쇼 횟수, 다음 예약, 최근 방문처럼 예약 데이터로 계산 가능한 값은 중복 저장하지 않습니다.

create table if not exists public.guardian_labels (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  label text not null,
  tone text not null default 'neutral',
  source text not null default 'owner',
  is_pinned boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_labels_label_not_blank_check
    check (length(btrim(label)) > 0),
  constraint guardian_labels_tone_check
    check (tone in ('neutral', 'teal', 'amber', 'burgundy', 'slate')),
  constraint guardian_labels_source_check
    check (source in ('owner', 'system', 'import'))
);

create unique index if not exists guardian_labels_shop_guardian_label_unique_idx
  on public.guardian_labels (shop_id, guardian_id, lower(btrim(label)));

create index if not exists guardian_labels_guardian_idx
  on public.guardian_labels (guardian_id, is_pinned desc, created_at desc);

create index if not exists guardian_labels_shop_idx
  on public.guardian_labels (shop_id, created_at desc);

create table if not exists public.pet_labels (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  label text not null,
  tone text not null default 'neutral',
  source text not null default 'owner',
  is_pinned boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_labels_label_not_blank_check
    check (length(btrim(label)) > 0),
  constraint pet_labels_tone_check
    check (tone in ('neutral', 'teal', 'amber', 'burgundy', 'slate')),
  constraint pet_labels_source_check
    check (source in ('owner', 'system', 'import'))
);

create unique index if not exists pet_labels_shop_pet_label_unique_idx
  on public.pet_labels (shop_id, pet_id, lower(btrim(label)));

create index if not exists pet_labels_pet_idx
  on public.pet_labels (pet_id, is_pinned desc, created_at desc);

create index if not exists pet_labels_guardian_idx
  on public.pet_labels (guardian_id, created_at desc);

create index if not exists pet_labels_shop_idx
  on public.pet_labels (shop_id, created_at desc);

notify pgrst, 'reload schema';
