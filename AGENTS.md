# PetManager Unified Agent Instructions

## Purpose
- This is the single canonical instruction file for the PetManager workspace.
- The same file is synced into both project roots:
  - `D:\petmanager\AGENTS.md`
  - `D:\petmanager-app\AGENTS.md`
- Determine the active project by the current working directory before making changes.

## Project Boundaries
- `D:\petmanager` is the PC/admin web project and the shared backend/API/Supabase authority.
- `D:\petmanager-app` is the mobile web and hybrid mobile app project only.
- `D:\petmanager-shared` is the shared source for env files, agent instructions, checklists, and coordination notes.

## Hard Routing Rules
- If the active workspace is `D:\petmanager-app`, work only on mobile web and hybrid mobile app surfaces.
- If the user asks for PC/admin web changes while in `D:\petmanager-app`, do not implement. Tell the user in Korean that the request belongs in `D:\petmanager`.
- If the active workspace is `D:\petmanager`, work only on PC/admin web, shared backend/API, Supabase, migrations, and shared data contracts.
- If the user asks for mobile web/app UI, native app shell, Android Studio, Capacitor, or app-only screen changes while in `D:\petmanager`, do not implement. Tell the user in Korean that the request belongs in `D:\petmanager-app`.
- Do not move PC code into `petmanager-app`.
- Do not move mobile app code into `petmanager`.
- PC and mobile must stay consistent through Supabase data, migrations, API contracts, and environment variable parity.

## Owner-To-Orchestrator Interaction
- The owner may give work in ordinary Korean using only one or two sentences, such as `로그인 느린 거 고쳐줘` or `관리자 예전 화면 없애줘`.
- Never require the owner to fill in a work ID, acceptance checklist, file list, team assignment, test plan, or reporting template.
- The lead orchestrator must translate the owner's plain-language request into an internal work ID, scope, owner, acceptance criteria, verification plan, and evidence requirements.
- Ask the owner at most one short question only when a material product choice, irreversible action, missing authority, or approval-gated action genuinely requires a decision.
- When the request can be completed safely from repository evidence, proceed through implementation and verification without asking the owner to manage the agents.

## Team Orchestration Rules
- Use a lead orchestrator, an implementation owner, a UI reviewer when visible UI is involved, and an independent QA owner. Create roles only when the work needs them.
- Before spawning any implementation writer in a fresh worktree, verify that its base actually contains the previously accepted commits and uncommitted canonical source relevant to the request. If accepted work is split across branches, detached worktrees, or a dirty canonical checkout, run a read-only baseline reconciliation first and do not implement on a stale base.
- One work ID has one implementation owner from reproduction through implementation, tests, and evidence submission.
- Parallelize only independent work. Never give concurrent write access to the same files.
- Judge activity from the latest actual message, tool call, result, and timestamp rather than an `active` label alone.
- Use task completion/input-needed events and bounded waits instead of fixed-time nudges. If actual evidence shows a stall, preserve the changes, record one blocker, and confirm the writer has stopped before reassigning ownership.
- `completed` or `idle` is not accepted as completion until the full acceptance criteria and independent QA pass.
- A QA failure stays on the same work ID. Return the smallest exact delta once, then re-run independent QA after the fix.
- Preserve unrelated dirty and untracked changes as user-owned work.

## Codex Task-Based Delegation

- 주담당은 대표의 짧은 지시를 업무 ID(`work_id`), 범위, 완료 조건, 필요한 역할로 정리한다. 대표에게 양식 작성이나 팀 관리를 요구하지 않는다.
- AO를 사용하거나 재시작하지 않는다. 영구 대기 팀 카드, 고정 roster, 업무마다 채팅 생성·이름 변경·보관, 새 앱 칸반은 만들지 않는다. 현재 업무에 필요한 Codex 서브에이전트만 배정한다.
- 주담당은 조정뿐 아니라 필요한 코드·문서·Git·실행 결과·관련 Notion 자료를 직접 읽고 판단할 수 있다. 독립적으로 끝낼 수 있는 조사·검수만 병렬화하며, 주담당을 제외한 동시 하위 담당은 최대 3명이다.
- PC 프로젝트의 역할은 `D:\petmanager\.codex\agents\pm-*.toml`에 있다: 조사 `pm-explorer`, UI 설계 `pm-ui-designer`, 구현 `pm-implementer`, 기능 검수 `pm-function-qa`, 화면 검수 `pm-ui-qa`. 사용법과 업무 기록은 `D:\petmanager\docs\work-management\`를 따른다. 이 역할 설치는 PC 전용이며 모바일 작업을 PC로 끌어오지 않는다.
- 한 `work_id`의 제품 작성자는 한 명이다. 쓰기 파일 범위를 먼저 기록하고 같은 파일을 동시에 편집하지 않는다. 기존 AO/다른 담당의 쓰기 중지, 변경 소유권, 수용된 코드·미커밋 변경 기준선을 확인하기 전에는 새 제품 작성자를 배정하지 않는다.
- 새 작업본은 수용된 코드뿐 아니라 현재 공통 지침과 역할 설정을 실제로 포함하는지도 확인한다. 커밋되지 않은 설정, 기존 채팅·AO 작업본의 지침이 자동 반영된 것으로 가정하지 않는다.
- UI 영향이 있으면 `UI_GATE=Y`로 기록한다. 레이아웃·문구·색상·반응형·상호작용·접근성을 바꾸거나 판단이 불확실하면 Y다. 흐름은 실제 화면/소스 확인 → 설계 도면만 → 단일 구현 → 독립 기능·실제 화면 검수 → 완료다.
- UI 설계 담당은 읽기 전용이며 도면만 반환한다: 대상 화면/컴포넌트, 유지·제거 결정, 배치·상호작용·반응형·접근성, 검수 조건. 제품 코드를 수정하거나 구현하지 않는다. UI 작업 경계에서 실제 PetManager UI playbook을 읽고 참조하며 상세 토큰을 역할 설정에 복제하지 않는다.
- UI가 없는 변경은 `UI_GATE=N`으로 기록하고 필요한 조사 → 단일 구현 → 독립 기능 검수를 따른다. 순수 조사·진단은 구현 담당 없이 끝낼 수 있다.
- 기능·화면 검수 담당은 같은 `work_id`의 구현자와 달라야 하며 제품 코드를 절대 수정하지 않는다. 읽기 전용 검토를 기본으로 하고 실제 테스트·캡처가 필요할 때만 상위 권한 안에서 지정한 검증 산출물/임시 경로에 쓴다. 실패는 같은 업무의 구현자에게 정확한 수정 항목으로 반환한다.
- 미해결 P0/P1이 0건이고 전체 완료 조건과 필요한 독립 검수가 모두 PASS인 경우에만 완료로 처리한다. 검수 결과는 P0/P1 수·정확한 수정 항목과 검증불가를 구분하며, 검증불가는 통과가 아니다.
- 역할의 모델·추론 수준·승인 모드는 사용자의 현재 선택을 상속한다. 역할의 읽기 전용/산출물 전용 제한은 상위 실행 권한이 넓더라도 지킨다. 보호 브랜치 갱신과 아래 승인 대상은 대표의 명시적 최종 승인 없이는 실행하지 않는다.
- 사용자에게는 쉬운 한국어로 요청, 실제 현재 상태, 다음 조건, 필요한 결정만 설명한다. 상태는 `지시사항 / 작업중 / 조치필요 / 검수필요 / 완료`를 사용하고 활동·검수 근거 없이 진행이나 완료를 꾸미지 않는다.

## Compact Handoff And Monitoring

- 위임에는 한 가지 좁은 일, 관련 파일, 확정된 결정·근거, 쓰기 소유권, 완료 조건만 전달한다. 원문 대화·전체 로그를 재생하지 않는다. 결과는 600단어 이내와 핵심 근거 최대 10줄로 돌려주고 큰 로그는 필요한 산출물 경로만 남긴다.
- 개별 작업은 도구 40회, 큰 결과 읽기 12회, 실제 작업 45분에 이르기 전에 목적·결정·변경 파일·검증 결과·막힘·다음 단계의 짧은 인계를 만든다. 남은 일은 그 인계와 필수 파일만 받는 새 담당으로 넘기고 작업공간 상태를 다시 확인한다.
- 안전한 인계는 기존 작성자의 쓰기 중지와 소유권 반환 확인 → 인계 기록 → 새 담당의 기준선 확인 순서다. 같은 파일의 두 번째 작성자를 먼저 시작하지 않는다. 새 담당을 시작할 수 없으면 인계를 남기고 새 작업에서 재개하도록 요청한다.
- 고정 시간마다 재지시하거나 반복 상태 polling을 하지 않는다. 기본은 완료/입력 필요 이벤트와 제한된 대기 기능이다. 활동 표지만 믿지 말고 필요한 시점에 실제 메시지·도구 결과·프로세스 소유권을 한 번 확인한다.
- 승인·입력 대기는 한 번 요약하고 추가 재촉·자동 재시도를 멈춘다. 확인된 정체는 변경을 보존하고 한 번의 복구/인계 판단으로 처리한다. 오류나 유휴 표시는 완료가 아니다.
- 매번 자동 감시를 만들지 않는다. 대표가 요청한 후속 감시만 지정 범위에서 사용하며, 목적 달성·폐기·승인 대기로 더 볼 이유가 없으면 해당 감시를 중지/삭제한다. 삭제한 AO 감시를 재생성하지 않는다.
- 시작한 개발 서버·자동 브라우저의 PID, 부모 PID, 실행 인수, 임시 프로필을 기록한다. 완료/인계 전에 해당 작업 소유 프로세스만 닫고 종료를 확인한다. 개인 브라우저·다른 작업 프로세스·대표가 유지 요청한 3000 서버는 건드리지 않는다. 종료를 확인할 수 없으면 남은 정확한 소유권을 보고한다.
- Git 작업은 도구 호출마다 명시적 하위 명령 하나로 실행한다. 배포·외부 쓰기·비용·파괴적 작업은 자동 재시도나 소유권 인계의 실행 대상이 아니다.

## UI Delivery And Independent QA
- For visible UI work, follow: actual/source inspection -> one compact UI direction -> implementation -> actual independent QA.
- The implementing agent must not be the final independent QA owner.
- Unless the surface has a different explicit contract, verify actual UI at 1440px, 1024px, and 390px, including interaction, document overflow, console/page errors, responsive layout, and accessible targets.
- Interactive targets should be at least 44px unless a documented fixed-geometry exception applies.
- When the shared PetManager UI playbook is available, read it once at the start of a new UI work boundary and apply it.

## Price Guide UI Hard Contract
- This section is an explicit surface override. For every PetManager price-guide table on PC, mobile, review fixtures, and evidence HTML, it takes precedence over the general typography guide's 12px/14px dense-table allowances.
- Price-guide table headers, weight/service labels, action labels, validation messages, prices, and durations use 16px font size with 24px line-height. Group labels use 20px/28px and breed lists use 18px/26px. Do not use 12px or 14px anywhere inside a price-guide editing or review surface.
- Each service header shows only the source service name. Do not repeat `가격` or `예상시간` beneath every service name. Each service cell is one horizontal pair: price on the left and expected duration on the right. Both values stay on the same visual row with `white-space: nowrap`; do not use column stacking or manual line breaks.
- Price-guide emphasis is selective: group labels use weight 600, service and first-column headers use weight 500, while breed lists, weight values, prices, and durations use weight 400. Never bold every table label or value. Place the group and its breed list on one wrapping flex row with a subtle divider; only wrap the breed list below when available width is insufficient.
- A missing duration renders as `미정` in the right-hand duration column without changing the horizontal structure. The first table column is always presented as `몸무게`, including source concepts named 체급, 무게, or 몸무게.
- Preserve a minimum 44px interaction target. Contain genuine two-dimensional overflow inside the table and reduce vertical scrolling before considering any density change; never reduce the typography to make the table fit.
- The canonical implementation files carry the marker `PRICE_GUIDE_UI_HARD_CONTRACT`. Contract tests must fail if the price-guide surfaces contain `text-[12px]`, `text-[14px]`, stacked price/time layout, missing nowrap, or sub-44px controls.
- Completion requires computed-style and geometry evidence at 1440, 1024, 430, and 390 widths: 16px/24px text, equal price/time top coordinates, no page-level horizontal overflow, and 44px controls. Source review alone is not sufficient.

## Admin Workroom Presentation
- Show the owner's request as one easy Korean sentence.
- Show the minimum graph `UI 설계 -> 구현 담당 -> UI 최종 검수 -> 완료` and the actual current stage.
- Show a plain-language reason, waiting owner/team, next action, whether the owner must decide, checked time, and evidence source.
- Do not expose generic filler, raw conversations, personal data, internal reasoning, commands, or raw tool output.
- Show at most one CTA, and only when the owner's decision is genuinely required. Otherwise state that no additional instruction is needed.

## Approval, Server, And Cleanup Boundaries
- Local repository reading, editing, tests, builds, and task-owned development servers are allowed as normal implementation work.
- Production deploys, remote database or Auth writes, real payments, operational-data changes, advertising, publishing, data collection, DMs, customer contact, and budget use require explicit owner approval before execution.
- The only owner-facing PC local origin is `http://127.0.0.1:3000`. Never write or present `localhost` as the owner-review address. Other ports are task-internal QA only and must never be presented as the updated product link.
- The only implementation source for the PC/admin product is the current `D:\petmanager` checkout. A detached worktree, copied fixture, old clean build, or isolated QA copy may support internal verification, but it must never be presented as the owner's current local product.
- Canonical owner links are `http://127.0.0.1:3000/owner` and `http://127.0.0.1:3000/admin`. Record or present any other user route only after confirming that exact route exists in the current `D:\petmanager` source.
- Before starting or sharing the owner-review server, run `npm run check:owner-preview` from `D:\petmanager`. A repository, origin, route, stage, or expected validation-project mismatch is a hard stop; do not start the server or substitute another link.
- Keep the canonical port 3000 server running when the owner asks to review it. Clean up only task-owned noncanonical servers, automated browsers, and temporary profiles.
- Never stop or modify a personal browser profile or another task's processes.

## Environment Naming And Owner Reports
- Prefix every owner-facing environment statement with exactly one server label: `[PC 로컬]`, `[검수 서버]`, or `[운영 서버]`.
- A server and a database are different resources. When data connectivity matters, name both, for example `[PC 로컬 + 검수용 연습 DB]`. Never imply that port 3000 is itself a database.
- In easy Korean, call the two data stores `검수용 연습 DB` and `고객용 운영 DB`. Internal code may retain technical environment names and project refs where exact verification requires them.
- `D:\petmanager\.env.local` for `[PC 로컬]` must use the validation project ref `qefxdtmdtvnzgupmjlom`; the preflight must compare it without printing keys or secret values.
- Commit, push, and deployment are owner-owned release actions. Do not perform or repeatedly request them. Run them only after the owner later gives an explicit `커밋해줘` or `배포해줘` instruction.

## Owner-Facing Status
- Do not spam routine unchanged progress. Notify the owner for meaningful completion, a new blocker, or a decision/approval request.
- For a brief operational status, default to four lines: `접수 / 현재 진행 / 대기 순서 / 담당 팀`.
- Use easy Korean and summarize verified outcomes and evidence locations instead of pasting raw logs.

## Shared Folder Rules
- `D:\petmanager-shared` is the canonical source for local env and agent instruction files.
- Env source files:
  - `D:\petmanager-shared\env\petmanager.env.local` -> `D:\petmanager\.env.local`
  - `D:\petmanager-shared\env\petmanager-app.env.local` -> `D:\petmanager-app\.env.local`
- Sync env files with:
  ```powershell
  D:\petmanager-shared\sync-env.ps1
  ```
- Sync this unified AGENTS file with:
  ```powershell
  D:\petmanager-shared\sync-agents.ps1
  ```
- The project-root `.env.local` and `AGENTS.md` files must still exist because local tools read them from each project root. Treat them as synced copies from `D:\petmanager-shared`.
- If a request or file change targets a project-root `AGENTS.md` directly, treat it as the wrong workflow. Do not manually edit project-root `AGENTS.md` files; update `D:\petmanager-shared\AGENTS.md` and sync it down instead.
- Never commit real `.env.local` secrets to git.

## Product Intent
- Build a production-ready grooming shop SaaS with a PC/admin web product and a mobile-first owner/staff app experience.
- Keep Korean-first UX copy natural, practical, and operational.
- Preserve extensibility for owner workflows, notification workflows, and future app store deployment.

## Implementation Defaults
- Frontend: Next.js App Router + TypeScript + Tailwind CSS.
- Backend: Supabase with migrations, seed data, and server-side data access.
- Validation: Zod.
- Forms: React Hook Form for substantial forms.
- Scheduling logic must enforce real booking availability based on business hours, closures, service duration, staff availability, and concurrent capacity.
- Customer-visible grooming price menus must be read-only projections of the detailed price guide source. Do not create independent customer-facing price/time rows, fallback service prices, demo rows, or stale copied values. If a detailed price guide item changes, every customer-facing service menu, booking flow, and mobile/app surface must reflect the updated source item through the shared Supabase-backed data contract.
- Service menu exposure settings may store only presentation concerns such as order, visibility, and source linkage. Price, duration, species, breed group, and service item values must always come from the detailed price guide source row.

## Mobile Web/App Rules (`D:\petmanager-app`)
- This project is strictly for mobile web and the hybrid mobile app.
- Optimize primary app surfaces for a max-width of 430px.
- Mobile app pages must stay clean, simple, white-based, and app-like.
- Owner and staff can use the same app, but the layout must adapt by login role.
- Owner mode may show all staff filters and shop-level controls.
- Staff mode should show only that staff member's relevant reservations unless explicitly approved otherwise.
- Do not add PC/admin desktop surfaces here.
- Do not reintroduce old demo/mobile flows after they have been removed from the active product path.
- Mobile app data should come from the shared Supabase-backed backend and remain consistent with PC.
- Camera/photo flows are mobile-critical. Do not remove or bypass required grooming photo capture unless explicitly requested.

## PC/Admin Web Rules (`D:\petmanager`)
- This project is strictly for PC/admin web, shared backend/API, Supabase, migrations, and shared data contracts.
- Owner schedule bookings must never overlap for the same staff member.
- Schedule boards should stay quiet and operational: white/neutral cards, light grid lines, compact staff headers, and no saturated full-card backgrounds.
- Date navigation on owner web work surfaces should use the schedule pattern: left chevron, centered plain date text, right chevron.
- Staff weekly schedule cells should remain compact and fixed height (`h-9`) unless explicitly approved otherwise.
- Staff weekly schedule edit modal: keep `기본 근무 설정` collapsed by default. Show weekday/time controls only after the owner opens the dropdown header.
- Staff weekly schedule columns are `스태프명` plus weekday columns (`월`, `화`, `수`, `목`, `금`, `토`, `일`). Staff cells show name in bold and role/service as smaller muted text underneath.

## Status Indicator Rules
- PetManager has exactly two reusable status indicator shapes:
  - `상태 점`: a small filled dot for compact rows and badges, usually `h-2 w-2 rounded-full`.
  - `좌측 엣지 인디케이터`: a colored left border edge used on cards, schedule items, calendar items, and staff weekly schedule cells.
- The canonical card indicator is `PM_STATUS_LEFT_EDGE`.
- `PM_STATUS_LEFT_EDGE` CSS contract:
  - parent element has `position: relative`
  - `overflow: hidden`
  - neutral `1px` border on all sides
  - `border-left-width: 3px`
  - `border-left-color: var(--pm-wrap-indicator-color)`
  - `border-radius: 8px`
  - white background
  - no pseudo-element or child span for the indicator
- Do not alter `PM_STATUS_LEFT_EDGE` without explicit owner approval.
- Forbidden regressions: interior vertical line, detached rail, bracket rail, pill chip, thick border, colored full-card background, gradient, heavy shadow, `border-2`, saturated focus ring, or dot-only status on schedule cards.
- Fixed status colors:
  - emerald green `#1f9d55`: confirmed, success
  - clear blue `#2563eb`: active work, 진행 중
  - violet `#7c3aed`: pickup ready, 픽업 준비
  - calm blue-gray `#607080`: 근무`r`n  - amber `#b98121`: pending, 승인대기, 예정, 반차, 변경, warning
  - burgundy `#a04455`: 휴무, 취소, 거절, failure
  - slate `#64748b`: 완료, completed
  - neutral `#b9c3cf`: unknown or inactive only
- In PC/admin web, reuse `src/components/owner-web/status-indicators.ts` for status indicator shapes and colors. Do not hard-code alternative indicator colors in schedule, calendar, staff, or customer screens.

## Appointment Status And Photo Rules
- Owner PC web and owner mobile web must treat appointment status as one shared source of truth through the same appointment APIs.
- Mobile status changes must sync back to PC views.
- PC views must periodically refresh visible schedule data for external changes.
- Grooming-start photo capture is optional. It must never block a grooming-start status update on PC web, mobile web, demo seeds, manual API calls, or future owner/staff surfaces.
- At grooming start, owner/staff surfaces must ask whether to `사진 촬영 후 시작` or `사진 촬영 없이 시작`. The capture option saves the photo before changing status; the no-photo option changes status immediately. Cancel changes nothing.
- `픽업 준비` is the owner/staff action that sends the pickup-ready Alimtalk before grooming is finished. It is not grooming completion, must not request or require a photo, and must remain subject to the existing notification setting, opt-out, duplicate-send, template, and credit rules.
- The schedule board current-work anchor must be the earliest-starting active booking whose scheduled time window contains the current time.
- Active work statuses include `진행 중` and `픽업 준비`.
- Expired active-status bookings must not become anchors.

## Core Reliability Invariants
- Calendar, reservation-management, and schedule-board screens are projections of the same canonical `appointments` rows. Do not create screen-specific reservation copies, fallback rows, or independent demo state in production flows.
- Every visible appointment range must refresh from the server on initial entry and range/date change, then periodically while visible and again on window focus or visibility restoration.
- Range refresh merging must reconcile appointments and grooming records by durable row `id` as well as by date range. Moving one row across a range boundary must never leave the same `id` twice or preserve a stale copy.
- Same-staff active appointment overlap prevention must remain concurrency-safe in PostgreSQL. Client availability checks and a non-locking trigger are not sufficient. Do not remove or weaken the per-shop/per-staff transaction serialization in `prevent_overlapping_staff_appointments()` without an equivalent concurrent-write database test and explicit owner approval.
- Appointment overlap database errors must be translated into an actionable Korean product message; raw PostgreSQL errors must not reach owners or customers.
- Adding shop or staff profile photos must append durable `media_asset_id` values to the current canonical collection. Existing IDs or unresolved legacy URLs may be removed only by an explicit user deletion action.
- Partial upload, partial signed-URL resolution, retry, refresh, or multiple-file upload must preserve every previously saved photo. Never replace the full collection with only the latest upload response.
- Owner photo lists must resolve signed URLs in batches and reuse still-valid URLs. Do not reintroduce one signed-URL API request per photo (`N+1`).
- The owner web app must retain a route-level error recovery boundary so an unexpected client error cannot degrade into an unrecoverable blank production page.
- `npm run build` must execute the reliability regression suite before compiling. Do not bypass or remove this build gate to make a deployment pass.
- Detailed failure scenarios and required validation live in `docs/engineering/core-reliability-invariants.md` in `D:\petmanager`.

## Staff And Schedule Data Rules
- Owner schedule staff columns and staff filter options must come only from saved staff members.
- Do not add synthetic columns/options such as `미배정` unless explicitly requested for that specific surface.
- If exactly one staff member exists, the 담당 filter should be fixed to that staff member and should not show `전체 스태프`.
- Dense schedule views should preserve vertical time placement and non-overlap first.
- If density increases, assign bookings to available staff/time windows rather than visually stacking overlapping cards.

## Notification And Alimtalk Rules
- Customer-facing appointment notifications are owner-action/manual by default, except for reservation visit 안내 reminders defined below.
- Reservation visit 안내 Alimtalk is an approved automatic product flow. Do not describe it as an owner manual-send flow.
- Reservation visit 안내 must send at most one automatic 안내 Alimtalk per appointment, at the most appropriate timing for that appointment.
- Do not send multiple automatic reservation 안내 messages for the same appointment just because several timing windows exist.
- Automatic reservation 안내 timing policy:
  - If the appointment was made well ahead of time, send one "내일 예약 안내" on the day before the appointment.
  - If the appointment is made on the same day and there is enough time before the visit, send one "오늘 예약 안내".
  - If the appointment is made close to the start time, send one "직전 예약 안내" shortly before the visit.
  - Once any one of the reservation 안내 types has been automatically sent for an appointment, do not automatically send another reservation 안내 for that appointment.
- Example: if a customer books three days ahead, do not send an immediate 안내, a today 안내, and a 직전 안내. Send only the one scheduled day-before 안내 at the right timing.
- Example: if a customer books shortly before the appointment, skip the day-before/today 안내 and send only the 직전 안내 if it is still useful.
- Manual owner buttons for reservation 안내, if present, are secondary controls such as resend/test/manual override and must not be treated as the primary flow.
- Automatic reservation 안내 must still respect shop notification settings, guardian/shop-level opt-out, duplicate-send prevention, approved Ssodaa template mappings, and shop Alimtalk credit balance.
- Do not add new background cron or automatic notification categories beyond the approved reservation visit 안내 flow unless the owner explicitly approves that product direction.
- Alimtalk usage is accounted per shop inside PetManager, not by separate Ssodaa accounts.
- Ssodaa balance is the platform pool.
- Each shop has an internal credit balance.
- Sends must be blocked when the shop has no remaining credits.
- Successful sends consume one shop credit with a ledger event.
- Failed provider sends must refund the reserved credit.
- Monthly/plan-included Alimtalk credits reset at each paid period and unused included credits do not carry over.
- Separately purchased paid credits must not expire or reset unless the owner explicitly requests a refund, adjustment, or policy change.
- Alimtalk relay/template environment values must stay identical between local development and Vercel production by default.
- When a Ssodaa template code is approved or changed, update local env source files and Vercel Production environment variables in the same work session, then run the relevant Alimtalk environment check.`r`n- After any Alimtalk env change in `D:\petmanager`, run `npm run sync:alimtalk-relay-env`, restart the local relay process, and verify relay diagnostics before claiming local Alimtalk verification is complete.
- Ssodaa templates must be created, edited, and submitted for review directly in Ssodaa unless the owner explicitly asks PetManager to register them.
- PetManager admin Alimtalk screens are for checking/connecting approved template codes, comparing bodies/buttons, testing sends, and diagnosing relay status. Do not reintroduce an in-app template registration workflow without explicit owner approval.
- Never claim an Alimtalk template change is complete just because code was edited. A complete template change requires all of the following in the same work session: approved Ssodaa template code, shared env source update, env sync, local server/relay restart or production redeploy, Alimtalk env consistency check, and relay/template diagnostics passing.
- Do not rely on template aliases such as `grooming_completed` as real Ssodaa template codes. If the approved template code is missing, block/queue the send and report the missing mapping instead of falling back to an old alias/template.
- For local Alimtalk verification, ensure both the Next.js server and `backend/alimtalk-relay` are running. If relay diagnostics fail, say that Ssodaa body/status verification is unavailable and do not state that the latest template is verified.

## Database Environment Rules
- PetManager has exactly two active hosted Supabase projects:
  - Development: `petmanager-dev` (`qefxdtmdtvnzgupmjlom`), used by local PC/app development, tests, seed data, and screenshots.
  - Production: `petmanager` (`ysxykikqnneuhypybjry`), used by Vercel Production and the real deployed service.
- Local `.env.local` files must point to the Development project by default. Vercel Production environment variables must point to the Production project.
- Supabase CLI link files are mutable connection state, not the environment source of truth. Before any remote CLI command, verify the intended environment, the linked project ref, and the command target together. Never infer the production target from local `.env.local`, and never infer the app runtime target from a stale CLI link.
- Treat `supabase/migrations` as the source of truth for schema changes.
- Avoid manual SQL dashboard edits except for emergencies.
- Backfill any emergency SQL into a migration immediately.
- Local development must not point at production Supabase by default.
- Before any remote Supabase write, state the target project, table, shop, and date.

## File Size And Component Structure
- React UI files should generally stay under 500 lines.
- Files over 500 lines are structure review candidates.
- Files over 800 lines require a split/refactor plan before UI changes.
- Do not split large files blindly by line count.
- Split only by clear responsibility:
  - page shell
  - toolbar
  - list
  - list item/card
  - detail panel
  - form
  - modal/bottom sheet
  - status badge
  - presentational component
- Prefer extracting presentational components first.
- When extracting components, do not change API calls, state logic, validation, routing, billing, auth, notification, or data models.
- If splitting or UI changes may affect behavior, stop and report it as deferred.
- Detailed rules live in `docs/engineering/file-structure-standard.md` when present.



## Shared Data Contract Rules
- DB columns, API payloads, and frontend field names are governed by `D:\petmanager-shared\docs\data-contracts.md`.
- Before and after PC/API/backend changes that affect shared data shape, read this contract file and update it in the same work session.
- The mobile app must follow this contract and must not introduce arbitrary column names, local-only persistence for shared data, or direct Supabase writes that bypass the PC/backend contract.

## Notion Work OS Protocol

- Notion은 대표가 정한 승인 기록과 관련 문서가 필요한 경우에만 해당 범위를 한 번 조회한다. 모든 업무 시작마다 `우진 업무 OS` 전체 조회, `NOTION READY` 선언, 단계별 반복 조회를 강제하지 않는다.
- 주담당이 직접 필요한 자료를 읽을 수 있다. 이미 확인한 결정·승인 근거는 짧게 인계하고, 변경이 알려졌거나 새 결정을 확인해야 할 때만 다시 조회한다.
- 실제 구현 상태는 Notion만으로 결론내리지 않는다. 해당 코드·로컬 결과와 필요할 때 승인된 원격 상태를 근거로 확인한다.
- 외부 Notion 작성·댓글·업무 상태 갱신은 대표의 명시적 요청 또는 이미 승인된 기록 범위에서만 한다. 매 작업 자동 기록 의식은 두지 않는다. `read-only`, `no external writes`, `do not update Notion` 지시는 이를 금지한다.
- 그 외 업무 기록은 활성 프로젝트의 로컬 업무 문서에 필요한 결정·변경·검증·막힘·다음 조건만 남긴다. 비밀, 개인정보, 원시 프롬프트와 전체 대화를 기록하지 않는다. 승인 범위 밖 기록이 필요하면 실행하지 말고 한 번 보고한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

