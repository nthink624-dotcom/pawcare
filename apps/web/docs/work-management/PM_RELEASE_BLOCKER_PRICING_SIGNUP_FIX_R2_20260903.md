# PM_RELEASE_BLOCKER_PRICING_SIGNUP_AUDIT_20260903 — stage 05 handoff

## Baseline and release-candidate handoff

- Canonical checkout observed at `22d0b02b59483f8a32965308e24860e5643d645e`; accepted clean candidate is `edf02d05abf9c7e4c896b7cbf8b6f29a6d153787` and is not an ancestor of that checkout.
- Preserve every unrelated dirty/untracked hunk. Do not copy whole files or reset the source. Apply only this manifest's task-owned hunks/new files to the clean candidate, then reproduce the focused checks below.
- This stage is source-only. It did not create an Auth user, call PASS/PortOne, write a hosted DB, apply a migration, deploy, commit, or push.

## Task-owned source manifest (SHA-256 after implementation)

| Path | SHA-256 |
| --- | --- |
| `src/lib/auth/owner-identity-binding.ts` | `92B58E50EB54A97DCFD7356FBC02C4E5AD77EA1E6638A88CE79A5BE368717407` |
| `src/lib/portone/identity-verification-client.ts` | `D331B547B5C75E50664F9AD5802BDB51B436F1E148395696D3D01EFDC9125865` |
| `src/lib/auth/find-email-identity.ts` | `B74588DEC22F5D175DB27CDA0B935F006CB193347CF62F4AF4397FE6EAEFC65D` |
| `src/server/owner-identity-verification.ts` | `BBBE68A23B09FAE45FB5D853E5774AF78BFEC044D21747A5E8440F47589E70D9` |
| `src/app/api/auth/request-verification-code/route.ts` | `F460B89F9029B07E666E81A45AEB4A09C842AB708DC4BCEC469BB66E1D847F17` |
| `src/app/api/auth/verify-pass/route.ts` | `42FFA43549468AF9DB6E82ABC69C53ED0162F9B847FBF163D4E279DB1A5B639C` |
| `src/app/api/auth/signup/route.ts` | `A53209EA0137CCEDECCE464038CE6CCA497F03BAAFDA5650AB072DEA4F41AE8B` |
| `src/components/auth/signup-form.tsx` | `3F226FE4A6D1BABD24F76A9C90A917772C6ABD2F9A48EA889A7894FD938B89AF` |
| `src/components/auth/reset-password-form.tsx` | `D3CA8B4EFC263807806BE3DCEB738AB895F5A438BC1890C195A9C4E854AD68B3` |
| `src/components/auth/signup-redesign-view.tsx` | `8D82996F4F70B37E75058423436E760C19ECCB1885989C29EBA13B7BC52A91CB` |
| `src/components/owner-web/settings-shop-info-panel.tsx` | `E1723FD253AF2EFEB9E7EC8210F7C6B90FD0994B170E13CB3CABA14F93118DAA` |
| `supabase/migrations/20260903064102_bind_owner_identity_request_state.sql` | `B3F26A48B6CEF37190D7BA06D717DC76196CF0F99EB4185563DF4EF81FEF0E11` |
| `tests/server/signup-identity-binding-contract.test.mjs` | `EC48F936ECDD406F9E7480B1C2A0AC3BE347607BDA143CD0FE82E2EF930E4D7F` |
| `tests/server/signup-price-guide-route-contract.test.mjs` | `5B814EF2F46D59B4085514AB759BAACCD27C038FC7D6F792F9A0CE40A8389D4E` |
| `tests/server/signup-price-guide-ui-contract.test.mjs` | `139B1AE93F0B5A935986621B6BC62B04168C432D653EB6AA635E4E82B99F54E6` |
| `D:/petmanager-shared/docs/data-contracts.md` | `77B59E249B8B6BA1F61DBBCE5B6E065D1D39571B98F6053C0B79F3C6675BB363` |

## Migration order and apply gate

1. Preserve the accepted owner identity migrations `202604010001`, `202604230001`, and `202605190004`.
2. Preserve the accepted atomic-signup chain through `202608270001`, `20260827064926`, `20260827152726`, `20260827153014`, `20260827153221`, `20260829023403`, and `20260830090000`.
3. Append `20260903064102_bind_owner_identity_request_state.sql` once. It adds the provider-state hash/expiry contract and fail-closes older active PortOne requests that lack that binding.
4. Before any hosted apply, release ownership must separately verify the target project and migration ledger. This implementation gives no remote-apply approval.

## Security and legal contract

- Before: provider ID plus purpose could locate/reuse a completed row, while the browser generated the provider ID. After: the server generates the request ID, provider ID, and random state; stores only the state hash and a five-minute expiry; and verify/reuse require the exact unexpired, unconsumed tuple with conditional consumption.
- PortOne UI wait is bounded to 120 seconds; signup identity API requests are bounded to 10 seconds; each provider result fetch is bounded to 4 seconds. Timeouts stop and show a Korean retry/recovery message without an automatic new verification request.
- Owner signup accepts only the server constant `OWNER_SIGNUP_TERMS_VERSION` (`2026-09-02` at this handoff). A stale or invented client version is rejected.

## Business-registration decision packet (not implemented)

- Product decision required: whether PetManager should collect a normalized 10-digit `businessRegistrationNumber` for business identity/duplicate-shop prevention and invoicing.
- If approved, proposed server fields are encrypted `business_registration_number_ciphertext`, lookup-only HMAC `business_registration_number_hmac`, `business_registration_verified_at`, and `business_registration_verification_source`; plaintext must never enter logs.
- Retention proposal: keep encrypted data only while the shop/account is active or a separately confirmed legal duty applies, then delete it. Retaining a one-way duplicate-prevention marker after deletion also requires explicit legal/privacy approval.
- Lower-data alternative: collect no business number, retain verified-phone one-trial enforcement plus email uniqueness, and handle legitimate multi-shop ownership through the existing membership model.

## Verification evidence

- Focused signup/security/UI suite: 75/75 PASS.
- TypeScript: PASS. ESLint: PASS.
- 1440/1024/390 signup terms smoke: checkbox row and `보기` targets at least 44px, CTA 62px, no horizontal overflow, page errors 0.
- Full build currently stops in a pre-existing unrelated dirty admin-home typography guard (`text-[12px]` at `src/components/admin/admin-home.tsx:377`). This stage did not edit that file; release ownership must resolve/reconcile it before claiming a green build.

