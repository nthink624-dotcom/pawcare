# PM_RELEASE_BLOCKER_PRICING_SIGNUP_AUDIT_20260903 — stage 05c r4 handoff

## Baseline and ownership

- Canonical checkout baseline: `22d0b02b59483f8a32965308e24860e5643d645e`; accepted clean candidate reference: `edf02d05abf9c7e4c896b7cbf8b6f29a6d153787`.
- Preserve unrelated dirty/untracked work. This stage did not edit payment, calendar, reservation, DB schema, migration, Auth provider, or production files.
- Existing identity-binding migration remains `supabase/migrations/20260903064102_bind_owner_identity_request_state.sql`; this stage adds no migration and applies none remotely.

## Accepted behavior

- Reset-password preparation/verification API waits use independent 10-second controllers. The PortOne UI receives a separate 120-second controller, so the earlier API deadline cannot abort an active provider window. No automatic provider retry is introduced.
- Optional marketing consent opens the dedicated `/marketing-consent` legal surface in a new tab, preserving the live signup form and agreement state.
- Initial setup completion is derived per authorized shop in `/api/bootstrap` from persisted valid business hours, persisted active staff schedule, and canonical active service options. Missing or mismatched readiness fails closed. Query/browser state cannot complete setup.
- Final service save hides setup only after the canonical essential-bootstrap response confirms completion. Save/requery failure keeps the modal and recovery message. Completed shops ignore `initialSetup=1`; incomplete shops resume the earliest incomplete step.
- Signup route exports changed from `POST` plus `SignupRequestPayload`, `SignupPriceGuideValidationCode`, `SignupPriceGuideValidationError`, `parseSignupPriceGuideDocument`, `parseSignupRequestPayload`, and `buildSignupServiceRpcPayload` to `POST` only. All helper exports moved to `src/server/signup-price-guide-validation.ts`; consumers are the route and focused server contract.

## Source manifest (SHA-256)

| Path | SHA-256 |
| --- | --- |
| `src/app/api/auth/signup/route.ts` | `270C913E605E76AC27748495954A43D6BC9EBCE821225210E8136EFFA50A6D40` |
| `src/server/signup-price-guide-validation.ts` | `3B318EA1B265F3037191DFD34AB99238F129DB3AF6F22884DB8D77E1C61EAC22` |
| `src/components/auth/reset-password-form.tsx` | `BE1400773FA5F27722942F090FE4B69E1CE39F78CAA8533EF6373FA746C76BA9` |
| `src/lib/auth/bounded-abort-controller.ts` | `2DFD2E6B5FF9E7F8B6DAAC7504891B9DD6F0920DBE43A409A9F057082039C51E` |
| `src/components/auth/signup-redesign-view.tsx` | `8F839AAEE29233226540035D41E83A8315F316C782BC88197319701A1A2A5E8D` |
| `src/app/marketing-consent/page.tsx` | `66B8C3A35967F2E41EED994BACFED53EA060188A8CE9C2E0F4A69D432642E23C` |
| `src/types/domain.ts` | `11040425FE1E6FE69A3A5470D4EFA07F548DB8F33144B2F24415B310352FF46D` |
| `src/server/bootstrap.ts` | `8068A03614183FD8E2A6EE534DA6EB6F6920ECBF9A2B31B3A065EB075B01223F` |
| `src/lib/mock-data.ts` | `8C3DD6396E4418BC86E8FE018E01C8E55DAB9B4BDF6AFFD356C6EA7648185693` |
| `src/lib/owner-initial-setup-readiness.ts` | `DC354E596708ACB05A57CE185288654EF4454476B214441B9E791A2138E80CF2` |
| `src/components/owner-web/owner-initial-setup-guide.tsx` | `DA05644DC235AB66AD7AF4FA8D3BC1271E6273BF6039C56878495A1F5FF968B7` |
| `src/components/owner-web/owner-web-app-shell.tsx` | `AAFCAA92BE917E5DDACF7F365E499389E0158188BB650F61D2DA5EA4C93F3711` |
| `src/components/owner-web/owner-web-preview.tsx` | `FD838BB2A928BC0924CE1393FB515587E4B6EB358ECE4BC3E726DACEE0FB6A80` |
| `src/components/owner-web/service-management-screen.tsx` | `BBF59EB0460FA28B5F569F57DDA0DA9D30F139C26DB4507D6F757FF558222238` |
| `src/app/dev/initial-setup-guide-preview/initial-setup-guide-preview-client.tsx` | `43FB425FB0F0E461E72E6B1D7D232CBD844390E56ABF00304C7A58728A891AC9` |
| `tests/server/owner-auth-client-bounded-ui-contract.test.mjs` | `905DDED6226F4CE32A2D8D66549C742DE9967D6D444CA2987B8A634AAEA33B29` |
| `tests/server/signup-identity-binding-contract.test.mjs` | `E65974ED370B90E078FF89AD9D5617304EC7471FD2E5C765ED4C1EA03E782919` |
| `tests/server/signup-price-guide-route-contract.test.mjs` | `5EA334403D16E4193F001CAEDD16704BA2B9D717FAF2486961892C3C79856253` |
| `tests/server/signup-price-guide-ui-contract.test.mjs` | `9DF6111E096FD8EAE55DE572A45CC1D8DE8B5471138C5252CCDBCB335A39CB4B` |
| `tests/server/owner-initial-setup-readiness.test.mjs` | `6813BDCE153CE7E344139BB198B6448C94FE06C7C14F3B9BA2B1D71E926DB850` |
| `D:/petmanager-shared/docs/data-contracts.md` | `E90D5E2202C8002C2A3472CC20B78322ABFFB1855BB96CF24316CF6F58FF0BB6` |

## Verification

- Focused signup/security/UI plus timeout/readiness contracts: 72/72 PASS (the requested existing 66 plus 6 new contracts).
- `npm run typecheck`: PASS. `npm run lint`: PASS. `npm run build -- --webpack`: PASS, including 99/99 reliability prebuild and media architecture check.
- Task-owned browser: completed fixture with `initialSetup=1` showed setup entry/modal 0; incomplete fixture showed the modal, 44px minimum visible controls, no horizontal overflow at 1440/1024/430/390, initial dialog focus PASS, page/console errors 0. Signup marketing link measured 44px at 390 and targeted `/marketing-consent` in a new tab.
- External writes/calls: DB/Auth/PASS/PortOne/production/deploy/commit/push 0. Task browser session was closed; canonical port 3000 server was not changed.
