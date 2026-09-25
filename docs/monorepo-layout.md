# PetManager 통합 소스 사용 안내

## 작업 위치

| 위치 | 역할 |
|---|---|
| `apps/web` | PC 오너·관리자 웹과 기존 웹 API |
| `apps/mobile` | 모바일 웹·Android 앱과 기존 모바일 API 어댑터 |
| `apps/shared/components` | 웹·모바일이 함께 사용하는 화면 부품 |
| `apps/shared/contracts` | 웹·모바일이 직접 가져오는 알림톡 문구 계약 |
| `apps/shared/lib` | 공통 화면 도우미 |
| `backend` | 기존 공유 백엔드와 알림톡 relay |
| `supabase/migrations` | DB 변경 이력 정본. 이번 작업에서 SQL/DB 변경 없음 |
| `tooling/agents` | 공통 작업 지침의 정본 |
| `docs/shared` | 이전 공통 저장소의 문서 |
| `archive` | 과거 배포/복구 폴더. 실행·배포 정본 아님, Git 제외 |
| `.migration-backup/20260925` | 이관 파일 해시, 기존 설정·diff·검증 로그. Git 제외 |

## 실행

아래 명령은 모두 `D:\petmanager`에서 실행한다.

```powershell
npm ci
npm run dev:web
npm run dev:mobile
npm run typecheck
npm run test:workspace
node --test scripts/monorepo/shared-ui-parity.test.cjs
npm run build:web
npm run build:mobile
```

- 웹은 3000, 모바일은 3100을 사용한다. 기존 서버가 실행 중이면 중복 시작하지 않는다.
- 설치/빌드 캐시는 OneDrive 밖의 이 저장소에서만 만든다.
- 웹과 모바일의 화면/네이티브 기능은 구분한다. 코드 저장소를 합치는 것이 두 실행물을 하나로 만드는 것은 아니다.
- 공통 화면 부품은 apps/shared/components로 뺀다. 현재 일반 버튼, 입력창, 입력 항목, 뒤로가기 버튼 4종을 공유한다. 웹·모바일별 기존 스타일은 보존한다.
- `apps/owner-mobile`은 기존 iOS 셸과 연결된 별도 경로다. Android 모바일 원본과 동일하다고 가정해서 덮어쓰거나 삭제하지 않았다.
- 원래 환경/서명 파일은 보호된 원본에 보존한다. 실행 환경은 앱별 `.env.local`을 사용하며, 공유 환경 정본 `D:\petmanager-shared\env`는 아직 이동하지 않았다.

## 이력과 복구

- 원래 웹 `.git` 및 현재 브랜치는 그대로 유지했다.
- 모바일 로컬 브랜치는 `refs/archive/mobile/heads/*`, 원격 추적 이력은 `refs/archive/mobile/origin/*`로 가져왔다. 원격 fetch/push가 아니라 기존 로컬 저장소에서 가져온 보존용 참조다.
- 모바일 로컬과 원격 추적 브랜치는 서로 다르므로 이번에 자동 병합하지 않았다. 통합 앱의 기준은 기존 로컬 작업본이며, 미커밋 변경도 포함한다.
- 복구 작업 폴더의 고유 코드는 최신 제품 소스로 자동 합치지 않았다. 이전 버전이 최신 수정을 덮어쓰는 일을 막기 위해 그대로 보관한다.
- 이동한 Git 작업 폴더는 `git worktree move`로 연결을 유지했고 HEAD 및 작업 상태가 이동 전후 같음을 확인했다.

## 아직 전환하지 않은 것

- 원래 루트 `src`와 `D:\petmanager-app`, 원래 실행 중인 서버는 통합본 검증/전환이 끝날 때까지 유지한다. 이것은 임시 보존이며 통합 완료를 뜻하지 않는다.
- Vercel 프로젝트의 Root Directory, Codemagic 연결, 배포 브랜치는 변경하지 않았다. 현 설정으로 통합본을 바로 배포하지 않는다.
- 웹은 `apps/web`, 모바일은 `apps/mobile`을 기준으로 배포 설정을 검토해야 한다. 모바일의 이전 Vercel services 설정은 별도 검토가 필요하다.
- 커밋/원격 push/배포와 운영 DB·Ssodaa 쓰기는 이번 이관에서 실행하지 않는다.
