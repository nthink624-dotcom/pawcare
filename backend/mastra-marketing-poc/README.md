# PetManager Mastra Marketing POC

펫매니저 성장팀의 로컬 실행·관찰 엔진입니다. 지금 단계는 `측정 신호 → Codex 검토 요청 → 사람 승인 대기`까지만 다룹니다.

## 실행

```powershell
cd D:\petmanager\backend\mastra-marketing-poc
npm.cmd install
npm.cmd run dev
```

Mastra Studio: `http://localhost:4111`

로컬 실행은 회원가입이 필요하지 않습니다. OpenAI 키가 없어도 이 결정론적 POC 워크플로는 실행할 수 있습니다.

## Mastra Platform

클라우드 배포에서는 Mastra Platform의 Google 로그인을 사용해 Studio와 API를 보호합니다. 배포 환경에는 원격 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, 조직 접근을 제한할 `MASTRA_ORGANIZATION_ID`가 모두 필요합니다. 하나라도 빠지면 배포 런타임은 시작하지 않습니다. 로컬 개발에서만 `file:./marketing-agent.db`로 대체됩니다.

```powershell
npm.cmd exec -- mastra auth login
npm.cmd exec -- mastra lint --preflight
npm.cmd exec -- mastra deploy --env production
```

최초 프로젝트 연결 뒤에는 관리형 DB를 붙이고 다시 배포합니다.

```powershell
npm.cmd exec -- mastra env db create production --kind turso
npm.cmd exec -- mastra deploy --env production
```

GitHub 자동 배포를 설정할 때 프로젝트 루트는 `backend/mastra-marketing-poc`으로 지정합니다. 생성되는 `.mastra-project.json`은 프로젝트 연결 정보이므로 커밋하고, `.env`, DB 파일, `.mastra/` 빌드 결과는 커밋하지 않습니다.

## 워룸 연결

개발 환경의 펫매니저 `/admin/marketing`은 기본적으로 `http://localhost:4111`을 확인합니다. Cloud에서는 Next.js 서버 환경의 `MASTRA_MARKETING_URL`에 API Server 주소를, `MASTRA_MARKETING_STUDIO_URL`에 사용자가 여는 Studio 주소를 지정합니다. Mastra 기본 도메인은 API Server 주소에서 Studio 주소를 안전하게 유도할 수 있지만, 운영에서는 두 값을 모두 명시합니다.

## 안전 경계

- 실제 KPI가 없으면 수치를 생성하지 않습니다.
- 광고 집행, 메시지 발송, 외부 게시, 예산 변경 도구가 없습니다.
- 승인 완료도 워크플로 검토 상태만 바꾸며 외부 작업을 실행하지 않습니다.
- OpenAI 호출은 연결하지 않았습니다. API 키·과금 승인 후 별도 단계에서 추가합니다.
- Production Supabase와 외부 마케팅 계정은 변경하지 않습니다.
- 클라우드 API를 펫매니저 관리자 워룸에서 조회할 때는 Mastra Platform API 토큰을 서버 전용 `MASTRA_MARKETING_API_TOKEN` 환경변수로 전달해야 하며 브라우저에 노출하지 않습니다. 이 토큰은 명시적으로 설정된 HTTPS `MASTRA_MARKETING_URL`에만 전송됩니다.
