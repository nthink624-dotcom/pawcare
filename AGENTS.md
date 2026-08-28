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
- If an in-progress task has no real output for 10 minutes, send at most one resume signal. If it remains empty or stalled, record one blocker, preserve its changes, and reassign ownership without repeating the same instruction.
- `completed` or `idle` is not accepted as completion until the full acceptance criteria and independent QA pass.
- A QA failure stays on the same work ID. Return the smallest exact delta once, then re-run independent QA after the fix.
- Preserve unrelated dirty and untracked changes as user-owned work.

## AO UI Gate And Worker Lanes
- Every new request must begin with one internal classification: `UI_GATE=Y` or `UI_GATE=N`, plus one short reason. The owner does not need to provide this classification.
- Use `UI_GATE=Y` when the request can change any user-visible layout, copy, color, typography, responsive behavior, interaction, accessibility behavior, screenshot, admin/owner screen, or other design result. If uncertain, choose `Y`.
- Use `UI_GATE=N` only for work with no user-visible UI judgment, such as backend-only logic, database or Auth internals, performance diagnostics, infrastructure, non-visual tests, or read-only analysis.
- For `UI_GATE=Y`, create separate AO worker sessions and enforce this exact graph: `UI_DESIGN -> IMPLEMENTATION -> UI_QA -> complete`.
- `UI_DESIGN` is strictly read-only. It may inspect actual UI and source, but it must never edit code, implement components, commit, or deploy. Its only deliverable is a compact design packet containing target routes/components, exact keep/remove decisions, design tokens, responsive behavior, interaction/accessibility rules, and measurable acceptance criteria.
- `IMPLEMENTATION` is the only writer for that work ID. It implements the approved design packet, does not invent a separate redesign, tests the result, and commits only task-owned files.
- `UI_QA` is read-only and independent from implementation. It verifies the actual result against the design packet and acceptance criteria at the required viewports, and returns only `PASS` or exact P0/P1 deltas. It must never fix the code itself.
- For `UI_GATE=N`, use `IMPLEMENTATION -> FUNCTION_QA`. `FUNCTION_QA` is a different read-only verifier. Pure read-only research or diagnosis may use one `ANALYSIS` worker without an implementation worker.
- A worker may not switch lanes. A design or QA worker never becomes the implementation writer for the same work ID.
- Every user-visible AO session title must be short, natural Korean and show both the lane and the actual work. Use `[UI 설계] <업무명>`, `[구현] <업무명>`, `[UI 검수] <업무명>`, `[기능 검수] <업무명>`, or `[분석] <업무명>` within AO's title-length limit.
- Do not expose English-only internal labels such as `branch-audit`, `baseline-audit`, `qa-lane-audit`, `impl-*`, or opaque work IDs as the visible title. Internal branch names and work IDs may remain machine-oriented, but the card title must tell the owner in Korean what is being worked on.
- All owner-visible AO content must be Korean-first: worker task prompts, orchestrator-to-worker messages, automation follow-ups, progress updates, approval explanations, QA summaries, blockers, and completion reports. Do not send an English paragraph when a Korean instruction conveys the same meaning.
- Exact code identifiers, command names, file paths, branch names, error strings, and third-party UI labels may remain in their original form, but immediately explain their meaning in easy Korean when they are shown to the owner.
- Keep one reusable AO roster visible at all times. The coordinator title is `[총괄] 대기`, and the five worker titles are exactly `[UI 설계팀] 대기`, `[구현팀 1] 대기`, `[구현팀 2] 대기`, `[UI 검수팀] 대기`, and `[기능 QA팀] 대기`.
- Idle roster sessions do no work but remain visible on the AO board. Reuse them for the next request; do not create duplicate role sessions.
- When an owner request is accepted, the coordinator must first shorten it into one natural Korean work name and rename itself to `[총괄] <업무명>`. Before dispatch, rename each assigned roster card to `[역할] <같은 업무명>` within AO's title-length limit. The visible title must describe the owner's actual order, not a generic phase or opaque work ID.
- Every assigned worker's first update and latest owner-visible update must begin with these easy Korean fields: `대표 요청: ...`, `내 담당: ...`, `현재 상태: 대기/진행/검수/막힘/완료`, and `다음 단계: ...`. Never expose raw reasoning, commands, or internal messages in these fields.
- After the coordinator confirms full acceptance and independent QA, clear the completed task context and rename the reused cards back to their exact `[역할] 대기` titles. Keep them idle and visible instead of terminating them.
- The persistent title does not authorize idle work. Start only the lanes required by `UI_GATE`, and keep at most three roster workers actively working at once. Additional temporary workers are allowed only when the five-role roster is genuinely insufficient for independent work; give each a short Korean title and close it after verified completion.
- After accepting one owner order, the coordinator owns automatic continuation through every required lane, worker handoff, test, and independent QA. The owner must not need to send periodic `continue` messages. Check real session activity and results, dispatch the next eligible lane, and stop only for verified completion, a genuine owner approval boundary, or a blocker that cannot be resolved safely inside the approved scope.

## AO Performance And Safe Rotation
- The AO coordinator is a router and operations controller only. It classifies, coalesces, renames cards, dispatches, observes receipts, advances lanes, and reports compact status; it never performs product research or implementation itself.
- For each new owner intake, the coordinator must classify and dispatch within 60 seconds, using at most three AO control calls, one compact state read, and a 300-token owner-facing update. Apart from the single bounded Notion read defined below, do not browse the repository, web, source files, logs, diffs, tests, builds, browsers, Git, database, or deployment systems from the coordinator session.
- At the start of each new top-level owner work boundary, the AO coordinator must read Notion's `우진 업무 OS` itself once and extract a compact brief of the current goal, priorities, decisions, active work, and waiting dependencies. This is coordinator context, not implementation work.
- The coordinator must not repeat the Notion lookup at every lane handoff. Re-read only when the owner says the plan changed, the Notion state is known to have changed, or a new top-level owner order begins. Keep the retained brief within 300 tokens and do not load raw pages into later turns.
- Required source, repository, runtime, web, or deep external research must be delegated to the appropriate read-only worker and performed in parallel with other independent preflight work. Deep Notion research beyond the one coordinator brief may also be delegated. The coordinator consumes only compact results.
- Worker progress is sent only when state changes and is limited to 120 tokens. A worker final result is limited to 600 tokens and ten evidence lines; raw logs and large diffs stay in files and are referenced by path or ID.
- Give each order a stable `scope_key`, `order_id`, and `revision`. For one `scope_key`, keep only one active revision and one latest pending revision. Merge new same-scope constraints into the latest pending revision instead of creating another queue item. Never merge or automatically retry deploys, external writes, payments, destructive actions, or approval-gated work.
- Keep at most three distinct pending scopes. If the queue reaches three items or the oldest wait exceeds three minutes, stop duplicate dispatch and coalesce the queue before accepting more internal work.
- Do not send periodic keepalive, duplicate continuation, or repeated acceptance messages. At 60 seconds without classification/dispatch, mark the intake late and inspect state once. At 90 seconds without a dispatch receipt, retry once with the same idempotency key. For a worker with no event for five minutes, check actual tool/process activity before judging it stale. Only after two unchanged checks with no active work may it be treated as stalled.
- AO's session status label is not sufficient evidence of activity. For compact checks, run `D:\petmanager-shared\ao-compact-status.ps1` with only the relevant session IDs and use its latest actual message/activity timestamp, running turn, pending approval, and context percentage. Never load the full conversation transcript just to poll status.
- Treat `needs_input` or a pending approval as a real blocker, not active work. Surface one compact owner action and do not add more worker messages while that input is pending.
- Run Git operations as one explicit subcommand per tool call. Never chain `git add`, `git commit`, branch changes, or verification through PowerShell separators. Request only the narrow Git approval actually needed; never ask the owner to remember or allow a broad shell command.
- A failed command does not end or complete a role session. Preserve the worktree, report the exact compact blocker, and remain available for one recovery decision.
- Warn and prepare a compact handoff when a coordinator reaches 45% context. Rotate at 55%. At 65%, stop new assignments until rotation completes. If context usage is unavailable, rotate at the first of: 20 coordinator tool calls, six substantial reads, 30 active minutes, or three accepted top-level owner orders.
- Rotate a persistent worker after the first of: 55% context, 40 tool calls, 45 active minutes, or three completed work IDs. Preserve the visible Korean role title by replacing only the underlying session after a safe handoff.
- A rotation handoff is at most 800 tokens and contains only: objective, decisions, active order/revision, worker session IDs and lease, changed files, verified results, blockers, and one next action.
- Safe rotation order is: lock new dispatch -> write compact handoff -> verify existing worker IDs and actual activity -> connect the fresh coordinator to those existing workers -> make the old coordinator read-only and stop it. Never create a second writer for the same work ID or file set. Use one `(order_id, revision, role)` idempotency key and one active lease.
- A coordinator turn lasting eight minutes is a warning. At twelve minutes, take over only when no real worker/tool/process activity exists. An approval-gated or externally destructive action is never an automatic takeover or retry target.

## UI Delivery And Independent QA
- For visible UI work, follow: actual/source inspection -> one compact UI direction -> implementation -> actual independent QA.
- The implementing agent must not be the final independent QA owner.
- Unless the surface has a different explicit contract, verify actual UI at 1440px, 1024px, and 390px, including interaction, document overflow, console/page errors, responsive layout, and accessible targets.
- Interactive targets should be at least 44px unless a documented fixed-geometry exception applies.
- When the shared PetManager UI playbook is available, read it once at the start of a new UI work boundary and apply it.

## Admin Workroom Presentation
- Show the owner's request as one easy Korean sentence.
- Show the minimum graph `UI 설계 -> 구현 담당 -> UI 최종 검수 -> 완료` and the actual current stage.
- Show a plain-language reason, waiting owner/team, next action, whether the owner must decide, checked time, and evidence source.
- Do not expose generic filler, raw conversations, personal data, internal reasoning, commands, or raw tool output.
- Show at most one CTA, and only when the owner's decision is genuinely required. Otherwise state that no additional instruction is needed.

## Approval, Server, And Cleanup Boundaries
- Local repository reading, editing, tests, builds, and task-owned development servers are allowed as normal implementation work.
- Production deploys, remote database or Auth writes, real payments, operational-data changes, advertising, publishing, data collection, DMs, customer contact, and budget use require explicit owner approval before execution.
- `127.0.0.1:3000` is the canonical owner-review server. Do not present a different port as the updated canonical product unless the owner explicitly requests it.
- Keep the canonical port 3000 server running when the owner asks to review it. Clean up only task-owned noncanonical servers, automated browsers, and temporary profiles.
- Never stop or modify a personal browser profile or another task's processes.

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

- In direct single-agent work outside AO, before starting a task, open Notion's `우진 업무 OS` and inspect this project's current goal, this week's deliverable, in-progress/today/P0-P1 work, latest session log, decision log, and waiting/external dependencies.
- In direct single-agent work outside AO, only after that review, reply to the user with exactly `✅ NOTION READY — 펫매니저 PC`.
- In an AO hierarchy, the coordinator itself performs the one bounded `우진 업무 OS` read at the start of each new top-level owner work boundary. It uses that brief to set priority, UI gate, worker order, dependencies, and acceptance criteria while remaining a coordination-only role.
- The coordinator does not inspect product repository files, source, runtime logs, or deployment systems itself. If Notion requires deep cross-page research, delegate only that deeper research to one temporary Korean-titled read-only `ANALYSIS` worker and consume a compact result.
- AO workers must not repeat the coordinator's Notion lookup, emit their own `NOTION READY`, or write separate Notion handoffs; they use the compact context supplied by the coordinator and return their role result to it.
- A task-specific `read-only`, `no external writes`, or `do not update Notion` instruction overrides the generic Notion logging steps for that task. In that case, neither the lead nor workers may create or update Notion records; report that logging was intentionally skipped.
- When asked about actual implementation state, treat Notion as work context only. Also inspect the relevant repository/code and, when relevant, GitHub or deployed state before concluding.
- Before finishing, leave a `[CODEX HANDOFF]` covering: completed work, changed files, verification results, current state, unfinished work, blockers, one next action, repository/branch, and commit/PR.
- If Notion is connected and writable, update the relevant task-page comment and the session-log database before finishing. If it is unavailable or not writable, include the full `[CODEX HANDOFF]` block in the final response instead.
- This protocol is a shared operating rule. Keep it compatible with the project-specific safety and release instructions above; where a conflict appears, preserve the stricter project-specific safety constraint and report the conflict.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

