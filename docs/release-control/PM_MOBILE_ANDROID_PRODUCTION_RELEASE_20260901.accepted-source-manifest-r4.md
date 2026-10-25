# Android accepted release source manifest r4

- Work: `PM_MOBILE_ANDROID_PRODUCTION_RELEASE_20260901`
- Stage: `04-accepted-release-source-manifest-r4`
- Canonical base observed: `b7d24a3109a1b8e0dbc8019b1f9c25de27348efe`
- Scope: evidence only. No source merge, reset, restore, staging, build, signing, install, or external write was performed.

## Accepted inputs

### Stage 2 accepted local contract — source worktree `ddf8`

The first 17 paths are the accepted navigation/push contract. The last three paths are the accepted PASS readiness R3 delta. `ownershipReturned=true` applies to these frozen revisions; the source worktree may continue other work, so assembly must use the exact hashes below and must recheck writer ownership immediately before applying them.

| Path | Accepted SHA-256 | Canonical comparison |
|---|---|---|
| `package.json` | `9F627A1955DADFA30328116EF94F4E45D58ADC7CF30248523761076EB2F7BAF1` | divergent |
| `package-lock.json` | `665D79CF5DD3DA793EFFDC22B87762F8D944C5BA891BEC0653242113D4129133` | divergent |
| `android/capacitor.settings.gradle` | `EA7074334B9698C8BA29659C810280852025F3BD027765C09D70F52186E2A663` | divergent |
| `android/app/capacitor.build.gradle` | `19021A670EC5B1E2DCFA4EAD428330B65B42383D0CCECAC199C4252C2AA51BFB` | divergent |
| `android/app/src/main/AndroidManifest.xml` | `EDC6891D6BE8FD4BF48673154F76B2D1B24C184E0A57A6827B0A660C9844EDAD` | divergent |
| `src/app/layout.tsx` | `03651B9CC3448D20E6A28DC03B48ACC470656F8A86E50121E0EB821F37D13764` | divergent |
| `src/app/login/page.tsx` | `8CDE6C1E9296BDB0A73EB2CC50313DB8F86689867718BE97F828E5EE83D733FB` | divergent |
| `src/app/owner/mobile/page.tsx` | `654FDB00C819D68EDCCA0F572440540E0816987D5D547FF02F33B7D4C4785434` | divergent |
| `src/components/native/owner-native-navigation-bridge.tsx` | `86DADCA46617E16CB755CCDD9B4AC4818F8DFA3B9B9C38B580BE269E460824D2` | new |
| `src/components/owner/owner-app.tsx` | `27E30839583239EBADACEB7588D41FC9F98455E4CB63D2A3B3786222911168AF` | divergent |
| `src/lib/native-navigation/owner-navigation.ts` | `F1C1128E4161DA96B538001E95D18E787E623B3FD802CA23C874599B098CA2CE` | new |
| `src/lib/push/owner-push-notifications.ts` | `0E1B04ADC4C0F448ADEE8E9AB0CE4208BD008DA6B226BCABFC8356B05C21942C` | divergent |
| `src/lib/owner-push-payload.ts` | `ED9785C27D40951212DB14E95EDFFA0E663A4B468E4F4B99EA444B76D579E2E0` | divergent |
| `src/server/owner-push-delivery.ts` | `5ED9B8861C002E1EE092E8B1857CA894AB29BF4283F049810D0A096A6D93016B` | divergent |
| `src/lib/account-deletion/owner-account-deletion-adapter.ts` | `50834E47BA7D90B0AEDDF36DA65FF878E39AB068BC58E85F05557E2CF642EFFE` | new; Stage 1 type-only slot |
| `tests/android-production-navigation-contract.test.mjs` | `99976FCB49E0AC9FD884A3B8E8CF3A75EB0768F0D5795AF02853020CFD731A39` | new |
| `docs/engineering/android-production-navigation-contract.md` | `A7577F4027BD5A6A8B6B7F6BDDFA16931876A47BE0217D2210C3A5BF2922B1BE` | new |
| `src/lib/env.ts` | `11893D3C0EE2547FE5218A1A7CA5C790495B630430E7F845F269FD35F40B7151` | divergent; PASS R3 |
| `src/lib/auth/portone-pass-readiness.ts` | `E1763AB0803DCA3B6B80B2ABA5342E9B82900419DEFC0B561D3A3989D808B61D` | new; PASS R3 |
| `tests/portone-pass-readiness-contract.test.mjs` | `08017A19A16E0F23DA553572DA8FE7661DA95A8C411D3A141096329B3E420904` | new; PASS R3 |

### Full-screen login — canonical accepted

| Path | SHA-256 | Comparison |
|---|---|---|
| `src/components/auth/login-form.tsx` | `A31D4ACE58498F703700BFB664E7F6DC3689DCB90EF2D3E26A1AB0FD526473B8` | same |
| `src/components/auth/mobile-login-screen-template.tsx` | `F60433C6616C18FDC061EA7ADFF3F3DFE6A7C3909DF88B562DB0ACAC12B8B178` | same |
| `tests/mobile-owner-login-full-screen-contract.test.mjs` | `8C0EEF86373BC112A0535FA01E14EF6A4D62EF58EC1A27A3B49D54CF746A270D` | same |

### Real photo price integration R3 — canonical accepted

| Path | SHA-256 | Comparison |
|---|---|---|
| `src/components/owner/owner-settings-panel.tsx` | `5F7D106E0DEBCC2082A7DE6138C66BC5049FCB6202E212232A54CD6F13E1872E` | same |
| `src/components/auth/mobile-ai-price-guide-fixture.tsx` | `BC1600B260587DE168E43525066BE5A2C4AD56534E4CD611FEB42A72709AA951` | same |
| `src/lib/price-photo/mobile-price-photo-adapter.ts` | `992FBD98196DB6C20E066D43DA88FA86EEC5805F37443C8E82201516B220818D` | same |
| `src/lib/price-photo/mobile-price-photo-http-adapter.ts` | `7161B509CECD98084433BAD1A9824D6E8DC76E13EA0B6709042957ADC9714CA8` | same |
| `tests/mobile-owner-price-photo-surface-contract.test.mjs` | `EC08724D68E3A4D644583B1B37073BA627B1A468ED43DB7EFC81209CE7917222` | same |
| `tests/mobile-price-photo-adapter-contract.test.mjs` | `798E3988B71B26DFD1BCF41B74FE334E90E911D3FD8719110127A42B957FF136` | same |
| `tests/mobile-price-photo-http-adapter-contract.test.mjs` | `E5E7CB87C6BA212BDA89CF9BABE6F3CF09079AC2306C3887356506D6F7E600D3` | same |

### Stage 3 policy evidence only

- `d130/docs/android-play-stage3-privacy-data-safety.md`
- SHA-256: `B6B8D035A9685355F0DA1183AA8626AA165D3BFAC1592A0841AEBF08C25593A9`
- This is release evidence input, not product AAB source.

## Overlap and semantic merge matrix

- Exact-path overlap between Stage 2, full-screen login, and photo R3 lists: **none**.
- Semantic overlap exists in login/navigation: apply Stage 2 navigation primitives and page callers first, then retain the accepted full-screen login component hashes. Never replace login components from another snapshot.
- Semantic overlap exists in owner shell: `owner-app.tsx` is divergent and must be merged by hunk against canonical; retain canonical Today/schedule/settings/photo callers and add only the accepted navigation dispatcher behavior.
- `package.json` and `package-lock.json` must be regenerated/verified as one dependency transaction after preserving all currently accepted dependencies. Do not copy either file independently.
- Android generated Capacitor Gradle files are release-critical but divergent. Recreate them through the accepted dependency set and `cap sync` only after the clean candidate is assembled; compare semantics to the frozen hashes rather than copying generated files blindly.
- Stage 1 may replace the type-only account-deletion adapter. Its final file list and hashes remain empty until the accepted handoff arrives.

## Merge order

1. Create a clean task-owned worktree at the accepted base; do not mutate canonical.
2. Apply canonical accepted login and photo files by exact hash.
3. Apply Stage 2 new leaf modules/tests/docs.
4. Semantically merge Stage 2 divergent callers in this order: environment contract, package dependency pair, native navigation, login/mobile pages, owner app, push client/server, Android manifest.
5. Insert the accepted Stage 1 account-deletion implementation at its pending slot and rerun Stage 1/2 contracts.
6. Reconcile package lock and Capacitor generated Gradle files from the final dependency graph.
7. Freeze the resulting clean snapshot and only then resolve Play maximum `versionCode`, approved `versionName`, Firebase/signing inputs, build, and sign.

## Exclusions

- All canonical dirty/untracked files not listed above remain user/other-work owned and are excluded until separately accepted.
- Stage 3/6/7 evidence documents, screenshots, temporary files, `next-env.d.ts`, `tsconfig.tsbuildinfo`, build outputs, local env files, secrets, keystores, `google-services.json`, and old APK/AAB artifacts are not product source inputs.
- Existing Stage 4 r3 preassembly was report-only; no standalone manifest artifact was found in the enumerated worktrees. This r4 document reconstructs its accepted base/pending gates without treating the missing report artifact as source.

## Pending gates

- Stage 1: exact accepted file/hash/provenance and QA handoff.
- Play: current highest uploaded `versionCode`; no value is guessed here.
- Product/version owner: approved `versionName`; no placeholder is assigned.
- Release inputs: production HTTPS target acceptance, Firebase package/project match, upload keystore reference, and signing certificate verification.

P0=0 and P1=0 for manifest preparation. Artifact creation remains dependency-blocked by the pending gates above.
