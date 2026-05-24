# 2026-05-22 알림톡 템플릿 현황 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 알림톡 템플릿 현황 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_alimtalk_template_registry.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.platform_alimtalk_templates') as platform_alimtalk_templates_table;
```

```sql
select to_regclass('public.platform_alimtalk_template_events') as platform_alimtalk_template_events_table;
```

```sql
select
  template_alias,
  notification_type,
  provider_template_code,
  template_name,
  is_custom,
  inspection_status,
  service_status,
  rejection_reason,
  last_synced_at
from public.platform_alimtalk_templates
limit 10;
```

## API 연결 후 테스트

아직 프론트/API 연결은 하지 않았으므로 이 SQL만 적용해도 쏘다 현황이 자동 저장되지는 않습니다.

프론트/API 연결을 허용한 다음에는 아래를 확인합니다.

1. 신규 템플릿 등록 시 알림 종류 연결이 없어도 `platform_alimtalk_templates`에 코드, 이름, 본문, 카테고리, 버튼 정보가 저장되어야 합니다.
2. 카카오 검수 요청을 누르면 `inspection_status = requested` 또는 쏘다 응답 기준 상태로 갱신되어야 합니다.
3. 쏘다 새로고침을 누르면 검수 상태, 서비스 상태, 반려 사유가 DB에 반영되어야 합니다.
4. `birthday_greeting`, `revisit_notice`처럼 반려된 템플릿은 `inspection_status = rejected`와 `rejection_reason`이 보여야 합니다.
5. 앱 알림 종류와 템플릿을 연결하면 `template_alias`, `notification_type`, `template_config_key`, `provider_template_code`가 함께 저장되어야 합니다.
6. 템플릿 상태 변경은 `platform_alimtalk_template_events`에도 이력으로 남아야 합니다.
7. 이 테이블은 플랫폼 공용 템플릿 현황입니다. 매장별 알림톡 잔여 건수와 섞으면 안 됩니다.

## 주의

- 이 SQL은 알림톡 자동 발송을 만들지 않습니다.
- 고객 발송은 기존 원칙대로 오너가 직접 누른 액션에서만 일어나야 합니다.
- 쏘다 실제 카테고리 목록 자체는 공급자 API 응답을 캐시하거나 별도 테이블로 확장할 수 있습니다.
