# 2026-05-22 예약 담당자 시간 겹침 방지 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 예약 담당자 시간 겹침 방지 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_appointment_staff_overlap_guard.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 겹치는 테스트 예약 저장이 막히는지 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.appointment_staff_overlap_conflicts') as appointment_staff_overlap_conflicts_view;
```

```sql
select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'appointments'
  and trigger_name = 'appointments_prevent_staff_overlap';
```

```sql
select *
from public.appointment_staff_overlap_conflicts
order by appointment_date, staff_id, overlap_starts_at
limit 50;
```

## API 연결 후 테스트

1. 같은 담당자에게 `10:00-11:00` 활성 예약이 있을 때 `10:30-11:30` 활성 예약 저장은 실패해야 합니다.
2. 같은 담당자라도 `11:00-12:00`처럼 끝나는 시각과 시작 시각이 딱 맞는 예약은 저장되어야 합니다.
3. 담당자가 다른 예약은 시간이 같아도 저장 가능해야 합니다.
4. `cancelled`, `rejected`, `noshow`, `completed` 상태 예약은 겹침 검사 대상에서 빠져야 합니다.
5. 담당자 없는 예약은 이 트리거가 막지 않아야 합니다.
6. 화면에서 시간 조절 핸들로 변경한 예약도 저장 시 같은 검사를 통과해야 합니다.

## 주의

- 이 SQL은 기존 겹친 예약을 자동으로 고치지 않습니다.
- 기존 겹침은 `appointment_staff_overlap_conflicts` 뷰에서 확인하고 별도 정리해야 합니다.
- 예약 생성/수정 API도 같은 규칙으로 에러 메시지를 부드럽게 변환해야 합니다.
