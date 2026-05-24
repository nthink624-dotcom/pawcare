-- Title: 2026-05-22 고객 작업 메모 저장 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 고객 상세와 스케줄 상세에서 쓰는 스태프 공유 작업 메모를 localStorage가 아니라 DB에 저장할 수 있게 합니다.
-- Note: 보호자 상담 메모는 이미 public.guardians.memo에 있고, 반려동물 기본 메모는 public.pets.notes에 있습니다.

create table if not exists public.pet_staff_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  note text not null default '',
  note_scope text not null default 'staff_shared',
  source text not null default 'owner_web',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_staff_notes_note_scope_check
    check (note_scope in ('staff_shared', 'owner_private')),
  constraint pet_staff_notes_source_check
    check (source in ('owner_web', 'owner_mobile', 'system')),
  constraint pet_staff_notes_pet_guardian_required_check
    check (pet_id is not null or guardian_id is not null)
);

create unique index if not exists pet_staff_notes_shop_pet_unique_idx
  on public.pet_staff_notes (shop_id, pet_id)
  where pet_id is not null;

create unique index if not exists pet_staff_notes_shop_guardian_without_pet_unique_idx
  on public.pet_staff_notes (shop_id, guardian_id)
  where pet_id is null;

create index if not exists pet_staff_notes_shop_guardian_idx
  on public.pet_staff_notes (shop_id, guardian_id, updated_at desc);

create index if not exists pet_staff_notes_shop_updated_at_idx
  on public.pet_staff_notes (shop_id, updated_at desc);

notify pgrst, 'reload schema';
