<!-- GENERATED: edit tooling/agents sources, then node scripts/monorepo/sync-agents.cjs. -->
## PetManager 공통 핵심 규칙

### 최신 지시와 작업 범위

- 시스템·개발자·보안 지침 범위 안에서 서로 충돌하는 프로젝트 지침은 대표의 가장 최근 명시적 지시를 우선한다.
- 진행 중인 업무는 대표가 그 업무를 명시적으로 `중지`, `교체`, `취소`하지 않는 한 계속한다. 질문이나 별개의 새 요청만으로 기존 업무를 취소했다고 해석하지 않는다.
- 현재 요청의 범위와 금지사항을 먼저 고정하고, 범위를 넓히는 제품 결정·외부 쓰기·비용·파괴적 작업은 추정해서 실행하지 않는다.

### 미커밋 변경과 작성 소유권

- 기존 수정·미추적 파일은 사용자 소유 작업이다. 관련 없는 변경을 reset, clean, checkout, overwrite, stash, 삭제하거나 커밋에 섞지 않는다.
- 한 업무에서 한 저장소의 제품 파일 작성자는 한 명이다. 같은 파일에 두 작성자를 동시에 배정하지 않으며, 독립적인 읽기·조사만 병렬화한다.
- 새 작성자를 배정하기 전에는 이전 작성자의 쓰기 중지와 소유권 반환, 현재 원본의 브랜치·커밋·보존할 미커밋 기준선을 확인한다.
- 소스 정본은 D:\petmanager 단일 저장소다. 웹은 apps/web, 모바일은 apps/mobile, 공통 컴포넌트·계약은 apps/shared에서 관리한다. shared는 웹·모바일 전용 코드에 의존하지 않는다. 화면 코드를 서로 복제하지 않으며 공용 DB, 마이그레이션, API 계약의 경계를 유지한다.

### 공용 DB·API·스키마·RLS·개인정보

- PC와 모바일은 같은 공유 백엔드/API와 정본 데이터 행을 사용한다. 화면별 복사 데이터, 독립 fallback 행, 로컬 전용 공유 상태를 만들지 않는다.
- DB 스키마 변경의 정본은 `supabase/migrations`이며, DB 컬럼·API payload·프런트 필드 계약은 `D:\petmanager\docs\shared\data-contracts.md`와 함께 갱신한다.
- 개인정보·운영 데이터가 있는 테이블과 Storage는 최소 권한 RLS와 서버 경계를 유지한다. 클라이언트가 서비스 역할 키를 보유하거나 승인되지 않은 직접 DB 쓰기로 API 계약을 우회하면 안 된다.
- 개인정보는 목적에 필요한 최소 범위만 수집·보관·노출한다. 보관 기간, 삭제, 제3자 제공, 외부 AI 전송, RLS가 실제로 확인되지 않았다면 안전하다고 단정하지 않는다.
- 로컬 개발은 고객용 운영 DB를 기본 대상으로 삼지 않는다. 서버 포트, `.env.local`, CLI link 중 하나만 보고 DB 환경을 추정하지 않는다.
- 비밀키·토큰·인증정보·개인정보를 채팅, 명령 인수, 로그, 소스, 업무 문서, Git에 남기지 않는다.

### 승인과 외부 변경 경계

- 요청 범위의 로컬 읽기·수정·집중 테스트·빌드는 일반 구현 작업으로 할 수 있지만, 대표가 금지한 실행은 하지 않는다.
- 커밋, push, 배포, 공개, 운영 환경·스토어 변경, 원격 DB/Auth 쓰기, 실결제, 고객 운영 데이터 변경, 광고, 외부 발송·연락, 데이터 수집, 비용 사용은 대표의 해당 범위 명시적 승인 후에만 실행한다.
- 삭제·덮어쓰기·복구가 어려운 변경은 정확한 대상과 영향, 복구 방법을 먼저 확인한다. 승인된 외부 쓰기는 가능한 경우 dry-run과 readback을 사용하고 불확실한 자동 재시도를 하지 않는다.
- 소스 수정, 테스트 통과, 빌드, 커밋, 서명된 배포 artifact, 배포, 스토어 공개는 서로 다른 상태다. 확인하지 않은 다음 단계를 완료로 보고하지 않는다.

### 위험도별 QA 운영

- 일반 UI·문구·배치 작업은 구현 담당이 대표가 보는 실제 화면에서 직접 확인하고 완료한다. 별도 독립 QA는 기본 단계가 아니다.
- 일반 기능·API 작업은 구현 담당이 관련 기능과 집중 테스트를 직접 확인하고 완료한다.
- 별도 독립 QA는 결제·개인정보·인증·고객용 운영 DB·데이터 손실처럼 대표가 육안으로 확인하기 어려운 고위험 변경 또는 대표가 명시적으로 요청한 경우에만 배정한다.
- 별도 독립 QA가 필요할 때만 구현자와 검수자를 분리하고, 그 검수가 통과해야 완료한다. `검수필요` 상태도 이 경우에만 사용한다.
- 대표의 육안 확인은 QA 단계나 완료 조건이 아니며 검수 대기 상태를 만들지 않는다. 대표가 나중에 발견한 문제는 새 수정 요청으로 처리한다.
- 같은 조건에서 이미 통과한 검사는 새 위험이나 관련 변경이 생기지 않았다면 반복하지 않는다. 검증불가는 통과가 아니다.

### Micro-change fast lane

<!-- MICRO_CHANGE_FAST_LANE_V1 -->
<!-- MICRO_UI_LOW_BUDGET=12_CALLS_OR_8_MINUTES_CHECKPOINT -->
<!-- NORMAL_BUDGET=NO_8_MINUTE_LIMIT -->

- `MICRO_UI_LOW`는 요구사항과 대상 파일·컴포넌트가 명확하고, 로직·상태·API·DB·인증·알림·빌드 설정·교차 화면 영향이 없는 단일 저위험 배치·크기·색상·간격·문구·정렬 수정일 때만 자동 판정한다. 하나라도 불명확하거나 범위를 벗어나면 `NORMAL`이다.
- 주담당은 다음 dispatch 필드를 직접 채우며 대표에게 양식 작성을 요구하지 않는다.

```text
work_id:
risk_tier: MICRO_UI_LOW | NORMAL | P0_P1
write_scope: exact files; one product writer
acceptance_route: exact existing route
required_widths: exact actual widths
focused_check: exact focused check
budget_class: MICRO_UI_LOW=12 calls/8 minutes checkpoint | NORMAL/P0_P1=no 8-minute limit
```

- 보이는 사이드바 작업의 주담당은 1명, 제품 작성자는 1명으로 둔다. 주담당이 직접 작성할 수 있으며 새 내부 하위 에이전트나 추가 QA 작업을 자동 생성하지 않는다. 독립 QA 예외는 위 위험도별 QA 규칙을 따른다.
- 대상 파일에 실제 동시 작성자 충돌이 없으면 원본 저장소에서 직접 수정한다. 단순히 Git 저장소라는 이유만으로 worktree를 만들지 않고, 관련 없는 인접 문제를 현재 업무에 자동 결합하지 않는다.
- 정상으로 확인된 기존 서버와 브라우저를 재사용한다. health 실패 근거 없이 재시작하지 않고, `node_modules`를 자동 재설치하지 않으며, 다른 작업이나 개인 프로세스를 건드리지 않는다.
- 대표가 확인하거나 승인하는 Google Play Console, App Store Connect, 결제, 가입, 계정, 운영 관리자 브라우저 작업은 반드시 대표 화면에 실제로 보이고 대표가 지정·승인한 기존 일반 Chrome 창에서만 수행한다. headless·백그라운드·숨김 창·화면 밖 창·임시 프로필·개인 브라우저의 무단 조작을 금지한다. `Chrome for Testing` 또는 고정 Codex 프로필 `C:\Users\happy\.codex\browser-profiles\codex`는 새 작업에서 실행하지 않는다. 대표가 승인한 기존 창에 연결할 수 없으면 다른 창이나 프로필로 대체하지 말고 작업을 멈춰 연결을 요청한다. 단, 2026-09-14 Apple 등록 작업은 대표가 현재 열린 headed Codex 창으로 계속 진행하라고 명시 승인했으므로 그 작업이 끝날 때까지만 해당 창을 유지한다. 로그인 정보·비밀번호·2단계 인증·CAPTCHA·신분증·결제정보·법적 약관 최종 동의는 대표가 직접 입력·확인한다.
- 집중 검사는 필요한 실제 화면 폭과 함께 한 세션에서 묶어 확인한다. 적용할 surface 계약이 요구하는 폭·상호작용·overflow·오류·접근성 검사는 생략하지 않는다.
- `MICRO_UI_LOW`의 목표 예산·점검 시점은 총 도구 호출 12회 또는 실제 작업 8분이다. 이 시점에 끝나지 않아도 구현물을 버리거나 만들다 멈추지 않고, 범위와 분류를 다시 확인해 안전하게 이어간다.
- 실제로 로직·상태·API·DB·인증·알림·빌드 설정·교차 화면 영향 또는 런타임 장애가 발견되면 근거를 기록하고 `NORMAL`로 승격해 충분히 계속한다. 오분류된 고난도 작업도 같은 방식으로 이어가며, `NORMAL`·P0/P1·고난도 기술 작업에는 8분 제한을 적용하지 않는다.
- 동일 실패 경로를 두 번 넘게 반복하지 않는다. 방법을 바꾸거나 환경 blocker의 정확한 근거와 보존 상태를 보고하며 반복 우회하지 않는다.
- 장기 작업의 도구 40회·큰 결과 읽기 12회·실제 작업 45분 compact handoff는 문맥 절약을 위한 연속 인계이며 작업 폐기 기준이 아니다. 변경과 근거를 보존하고, 필요하면 보이는 새 사이드바 작업으로 인계하거나 대표에게 그 인계를 요청한다. 숨은 내부 에이전트로 자동 인계하지 않는다.

### 필요한 상세 규칙만 읽기

- 현재 작업과 직접 관련된 파일만 추가로 읽고 다른 기능·플랫폼 상세 규칙은 미리 불러오지 않는다.
- 요금표 편집·노출·사진 분석: `D:\petmanager\tooling\agents\details\price-guide.md`
- 케어리포트·미용 사진·미용 시작/완료: `D:\petmanager\tooling\agents\details\care-report.md`
- 알림톡 발송 조건·대상·템플릿/문구·중복 방지·실패·원장·보안: `D:\petmanager\tooling\agents\details\alimtalk.md`
- 예약·일정·상태 동기화·겹침 방지: `D:\petmanager\tooling\agents\details\appointments.md`
- DB/API·스키마·RLS·개인정보·미디어 자산: `D:\petmanager\tooling\agents\details\data.md`

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
