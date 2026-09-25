# 미디어 개발 DB 적용 가이드

이 문서는 운영 적용 전에 개발 Supabase에 미디어 migration을 먼저 적용하기 위한 순서입니다.

운영 Supabase에는 아직 적용하지 마세요.

## 대상

개발 Supabase:

- 프로젝트명: `petmanager-dev`
- 프로젝트 ref: `qefxdtmdtvnzgupmjlom`
- 용도: 개발/테스트

운영 Supabase:

- 프로젝트명: `petmanager`
- 프로젝트 ref: `ysxykikqnneuhypybjry`
- 지금 단계에서는 건드리지 않음

## 현재 상태

`npm run media:schema-rest-check` 기준으로 개발 Supabase에는 아직 아래 항목이 없습니다.

- `media_assets`
- `media_variants`
- `notification_media_attachments`
- `media_send_attempts`
- `shop_media_usage_months`
- `shop_media_limits`
- Storage bucket `petmanager-media`

따라서 다음 단계는 개발 Supabase에 migration을 먼저 적용하는 것입니다.

## 적용 전 확인

로컬에서 아래 명령을 실행합니다.

```bash
npm run check:supabase-env
npm run media:migration-plan
```

정상 기준:

- `.env.local` stage가 `development`
- Supabase ref가 `qefxdtmdtvnzgupmjlom`
- 운영 ref `ysxykikqnneuhypybjry`가 로컬 대상이 아님

## 개발 Supabase에 적용하는 방법

1. Supabase Dashboard에서 개발 프로젝트 `petmanager-dev`로 들어갑니다.
2. 프로젝트 ref가 `qefxdtmdtvnzgupmjlom`인지 확인합니다.
3. SQL Editor를 엽니다.
4. 아래 파일 내용을 전체 복사해서 실행합니다.

```text
supabase/generated/media_development_apply.sql
```

이 파일은 아래 migration을 순서대로 묶은 개발 적용용 bundle입니다.

1. `supabase/migrations/202605180002_owner_scale_indexes.sql`
2. `supabase/migrations/202605180003_media_assets_and_notification_attachments.sql`
3. `supabase/migrations/202605180004_media_cost_controls.sql`
4. `supabase/migrations/202605180005_shop_media_limits.sql`

실패하면 즉시 멈추고 에러 메시지를 확인합니다.

## 적용 후 Supabase SQL Editor에서 확인

개발 Supabase SQL Editor에서 아래 파일 내용을 실행합니다.

```text
supabase/verification/media_schema_readiness.sql
```

정상 기준:

- 모든 row의 `exists`가 `true`
- `storage.petmanager-media`가 `true`
- `public.increment_shop_media_usage`가 `true`

## 적용 후 로컬에서 확인

Supabase SQL Editor 검증이 끝난 뒤 로컬에서 실행합니다.

```bash
npm run media:schema-rest-check
npm run check:media-architecture
npm run typecheck
npm run build
```

정상 기준:

- `media:schema-rest-check`가 모든 media table과 bucket을 `OK`로 표시
- `check:media-architecture` 통과
- `typecheck` 통과
- `build` 통과

## 결과 보고 양식

개발 DB 적용 후 아래 형식으로 결과를 남깁니다.

```text
개발 Supabase media migration 적용 결과

대상 프로젝트:
- petmanager-dev
- qefxdtmdtvnzgupmjlom

적용한 SQL:
- supabase/generated/media_development_apply.sql

SQL Editor 적용 결과:
- 성공/실패:
- 실패 시 에러:

schema readiness 결과:
- 전체 true 여부:
- false 항목:

로컬 REST check:
- npm run media:schema-rest-check 성공/실패:

다음 단계:
- API smoke test 진행 가능/불가:
```

## 운영 적용 금지 조건

아래 중 하나라도 해당하면 운영 적용 금지입니다.

- 개발 Supabase 적용 실패
- `media_schema_readiness.sql`에서 `false`가 하나라도 있음
- `npm run media:schema-rest-check` 실패
- `npm run build` 실패
- 실제 쏘다 이미지 발송 방식이 확정되지 않았는데 고객 발송 UI를 열려고 함

운영 적용은 개발 검증이 끝난 뒤 별도 승인 후 진행합니다.
