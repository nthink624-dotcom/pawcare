# 오류 관측성 계약

- `/api/healthz`는 프로세스 생존만 확인하고 고객 데이터나 오류 본문을 반환하지 않는다.
- `/api/readyz`는 Supabase 연결 상태만 `ok`/`failed`로 반환한다. 연결 예외와 쿼리 오류 모두 `logOperationalEvent`가 허용된 경로·상태·작업명·오류 코드만 구조화 로그로 남긴다.
- 웹·모바일 `/api/readyz`의 Supabase probe는 2초 `AbortController` timeout을 사용해 provider hang이 장애 감지를 지연시키지 않도록 한다.
- `apps/mobile`도 동일한 `/api/healthz`·`/api/readyz` 계약을 제공해 `petmanager-app` Vercel 프로젝트를 별도로 확인할 수 있다.
- 운영 로그에는 bearer/access/refresh token, 비밀번호, 전화번호, 이메일, 원본 요청 본문, 데이터베이스 오류 상세를 넣지 않는다.
- 로그 수집·보존·알림 대상은 Vercel/호스팅 운영 계정 readback으로 확정해야 한다. 코드의 `console.error` 출력만으로 알림 수신을 완료로 보지 않는다.
- 장애 대응 절차는 [incident-response-runbook.md](./incident-response-runbook.md)를 따른다.
- 관리자 감사 로그는 `/admin/audit`와 `GET /api/admin/audit-events`에서 최대 100건의 주체·작업·대상·시각만 조회한다. `previous_payload`, `next_payload`, 사용자 에이전트와 메시지 원문은 관리자 화면/API 응답에 포함하지 않는다.
