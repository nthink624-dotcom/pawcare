# 2026-05-22 고객 작업 메모 저장 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 고객 작업 메모 저장 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_pet_staff_notes.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select
  id,
  shop_id,
  guardian_id,
  pet_id,
  note,
  note_scope,
  source,
  updated_at
from public.pet_staff_notes
limit 5;
```

```sql
select to_regclass('public.pet_staff_notes') as pet_staff_notes_table;
```

## 화면 연결 후 테스트

아직 프론트/API 연결은 하지 않았으므로 이 SQL만 적용해도 고객 상세 화면 저장 방식은 바로 바뀌지 않습니다.

프론트 연결을 허용한 다음에는 아래를 확인합니다.

1. 고객 상세에서 작업 메모를 수정하고 새로고침해도 유지되어야 합니다.
2. 같은 고객을 스케줄 상세에서 열어도 같은 작업 메모가 보여야 합니다.
3. PC 웹에서 수정한 작업 메모가 모바일 웹에서도 같은 내용으로 보여야 합니다.
4. 모바일 웹에서 수정한 작업 메모가 PC 웹에서도 같은 내용으로 보여야 합니다.
5. 반려동물이 여러 마리인 고객은 반려동물별로 작업 메모가 분리되어야 합니다.
6. 고객 상담 메모(`guardians.memo`)와 작업 메모(`pet_staff_notes.note`)가 섞이면 안 됩니다.
7. 반려동물을 삭제하면 해당 반려동물의 작업 메모도 함께 정리되어야 합니다.

## 주의

- 이 SQL은 기존 고객, 반려동물, 예약, 미용 기록 데이터를 삭제하지 않습니다.
- `pet_staff_notes`는 스태프가 다음 작업 때 참고할 내부 메모용입니다.
- 고객에게 보여줄 메모나 알림톡 문구로 바로 사용하면 안 됩니다.
