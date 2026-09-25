## PC/Admin 전용 규칙

### 저장소와 책임

- 이 출력은 `D:\petmanager\apps\web`에서만 적용한다. PC 관리자·오너 웹, Next.js 서버, 공유 백엔드/API, Supabase 마이그레이션과 공유 데이터 계약이 이 저장소의 범위다.
- 모바일 앱 전용 변경은 여기서 구현하지 않고 `D:\petmanager\apps\mobile` 작업으로 분리한다.
- 프런트엔드는 Next.js App Router, TypeScript, Tailwind CSS를 기본으로 하고, 공유 백엔드는 Supabase·Zod 기반 계약을 유지한다.

### 관리자·오너 화면

- 한국어 우선의 실무형 화면을 유지하고, 관리자·오너 일정 화면은 흰색/중립 카드와 가벼운 구분선을 사용해 조용하고 읽기 쉽게 만든다.
- 오너 일정 예약은 같은 스태프의 시간대가 겹치면 안 되며, 저장된 스태프와 공유 예약 데이터를 정본으로 사용한다.
- 일반 UI 확인은 공통 QA 규칙에 따라 구현 담당이 실제 `D:\petmanager\apps\web` 원본의 대표용 화면에서 수행한다.

### PC 로컬과 3000 포트

- 대표에게 안내하는 PC 로컬 origin은 오직 `http://127.0.0.1:3000`이다. `localhost`나 다른 포트를 대표용 최신 화면 주소로 쓰지 않는다.
- 정본 링크는 `http://127.0.0.1:3000/owner`와 `http://127.0.0.1:3000/admin`이다. 다른 경로는 현재 원본에 실제 route가 있는지 확인한 뒤만 안내한다.
- 대표용 서버를 시작하거나 링크를 공유하기 전 `D:\petmanager\apps\web`에서 `npm run check:owner-preview`를 실행한다. 저장소·origin·route·환경·검수용 연습 DB 기준 불일치는 중단 조건이다.
- `[PC 로컬]`의 `.env.local`은 검수용 연습 DB 프로젝트를 가리켜야 하며 키 값을 출력하지 않고 프로젝트 ref만 확인한다.
- 대표가 3000 서버 유지를 요청했다면 종료하지 않는다. 작업이 시작한 비정본 서버와 자동 브라우저만 소유권을 확인해 정리한다.

### Next.js와 Vercel

- 현재 설치된 Next.js의 API·파일 규칙은 학습 지식으로 추정하지 말고 코드 변경 전 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- Vercel Production, 환경변수, 배포와 운영 확인은 공통 승인 경계를 따른다. 로컬 성공이나 빌드는 운영 배포가 아니다.

### PC 상세 규칙 라우팅

- 관리자·오너 UI, 일정 카드, 상태 표시, 반응형, 컴포넌트 분리: `D:\petmanager\tooling\agents\details\pc-ui.md`와 사용 가능한 경우 PetManager UI playbook
- PC 로컬 서버, 환경 이름, Vercel, 배포·복구·릴리스: `D:\petmanager\tooling\agents\details\deployment-pc.md`
- 공유 백엔드 relay URL·서버 health·Vercel 알림톡 env·재배포·장애 진단: `D:\petmanager\tooling\agents\details\alimtalk-relay-operations.md`
- UI 파일 구조·크기 조정: `D:\petmanager\tooling\agents\details\ui-structure.md`
- 다중 담당 배정·업무 인계·상태 관리가 실제로 필요한 PC 작업: `D:\petmanager\docs\work-management\README.md`와 `WORK-TEMPLATE.md`
- 공통 기능 상세는 공통 규칙의 라우팅 표에서 현재 작업에 해당하는 파일만 읽는다.

<!-- BEGIN:nextjs-agent-rules -->

### This is NOT the Next.js you know

This version can have breaking changes in APIs, conventions, and file structure. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code and heed deprecation notices.

This block may be maintained by `next dev`; keep the markers so the generated instruction file does not accumulate a duplicate block.

<!-- END:nextjs-agent-rules -->
