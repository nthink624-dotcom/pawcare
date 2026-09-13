# PM-20260911-RELEASE compact handoff

- Objective: preserve unrelated dirty work, commit verified PC and mobile product changes, build a fresh signed AAB, and use only verified release routes.
- Decisions: mobile keeps the shell-clamped `^` menu; PC floating `^` is removed and the top menu contains only `함께 고쳐요` and `도움 문의`; staff headers retain each saved pale identity background plus the existing bottom line; incomplete shops use an operations hard gate while setup/help/account/legal remain available.
- Changed commits: PC `7b98e10b` plus merge `eceb9ac9` and pending focused rework; mobile `4cb9916`, `6c1204c`, `407e533`.
- Verified: mobile contracts 209/209, typecheck, lint, production build, 1440/1024/430/390 UI P0/P1=0. Fresh signed AAB built from clean HEAD `407e533`, version 1/1.0.0, signing verified.
- Blockers: Production Supabase migration history is missing 39 local migrations, so PC/mobile web Production deployment must not run without a separately approved and verified database rollout. Play upload/release creation is outside this task.
- Next: finish and commit current PC focused rework; map and implement the canonical initial-setup hard gate with independent function/UI QA; rerun PC full tests/type/lint/build; keep existing port 3000/3100 servers and persistent Play Chrome untouched.
