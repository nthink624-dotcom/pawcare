# 2026-05-22 예약 반려동물 참여자 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 예약 반려동물 참여자 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_appointment_pet_participants.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 다견 예약 API 연결 후 기본/추가 반려동물 연결을 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.appointment_pet_participants') as appointment_pet_participants_table;
```

```sql
select
  count(*) as participant_count
from public.appointment_pet_participants;
```

```sql
select
  appointment_id,
  count(*) as pet_count,
  count(*) filter (where role = 'primary') as primary_count
from public.appointment_pet_participants
group by appointment_id
having count(*) filter (where role = 'primary') <> 1
limit 20;
```

## API 연결 후 테스트

1. 기존 예약마다 `role = 'primary'` 참여자가 1개씩 생성되어야 합니다.
2. 고객 예약에서 추가 반려동물을 함께 입력하면 `role = 'additional'` 참여자가 생성되어야 합니다.
3. 같은 예약에 같은 반려동물이 중복 연결되면 막혀야 합니다.
4. 한 예약에는 `primary` 참여자가 1개만 있어야 합니다.
5. 고객 상세에서는 특정 반려동물 기준으로 과거 예약 참여 이력을 찾을 수 있어야 합니다.
6. 스케줄/알림 문구에서는 대표 반려동물 외 추가 반려동물을 함께 표시할 수 있어야 합니다.

## 주의

- 이 SQL은 기존 `appointments.pet_id`를 제거하지 않습니다.
- `appointments.pet_id`는 대표 반려동물로 유지하고, 다견 예약 확장은 `appointment_pet_participants`로 처리합니다.
- 이 SQL만 적용해도 프론트 화면이 자동으로 다견 표시를 하지는 않습니다. 이후 API 연결 작업이 필요합니다.
