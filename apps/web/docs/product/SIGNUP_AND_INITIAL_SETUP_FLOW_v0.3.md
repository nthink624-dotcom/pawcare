# SIGNUP_AND_INITIAL_SETUP_FLOW v0.3

Status: local/development review draft  
Owner decision date: 2026-08-27  
Scope: signup ordering, temporary-data boundary, PC/mobile preview, post-signup setup contract  
Excluded: Production deployment, database migration, real owner data changes, external execution

## 1. One-screen signup order

```text
1. 서비스·상세 요금 등록
   가격표 사진 우선 → 인식 실패 시 직접 입력 → 판독 초안 확인·수정
          ↓
2. 개인정보·계정 정보 및 필수 동의
          ↓
3. 가입 내용 최종 확인
   매장/계정 정보 + 확인된 서비스 요금
          ↓
4. 회원가입 완료
   계정·매장·서비스 요금을 함께 최종 저장
```

The progress UI stays short: `서비스 요금 → 계정 정보 → 최종 확인`. Completion is the result, not another form page.

## 2. Service-price registration screen

### PC

- Left: source-photo selection, up to five images, and manual-entry fallback.
- Right: editable AI draft containing service name, price, expected duration, breed/species, and weight bands.
- The confirmation button advances to account information; it does not persist canonical data yet.

### Mobile

- One primary 4:3 photo area.
- Two compact actions: `직접 입력`, `사진 확인`.
- After extraction, show one service row at a time and keep `다음` fixed at the bottom.
- No dense desktop table is squeezed into the mobile frame.

Development preview: `/dev/signup-and-initial-setup-preview`

## 3. Storage boundary before and after personal information

### Before personal/account information

- Keep selected image `File` objects in browser memory only.
- Do not create durable `media_assets` rows or permanent Storage objects.
- If AI extraction must run before account creation, send image bytes to a dedicated unauthenticated signup-extraction endpoint that processes them in memory and returns only a draft.
- The endpoint must not log image bytes and must not retain the source after the request.
- Leaving or refreshing the signup page discards the images and draft unless the browser keeps an explicitly temporary local draft.
- A temporary browser draft must contain no account identity and must be cleared after completion or cancellation.

### After personal/account information

- Account and identity fields remain client-side signup state until final confirmation.
- Email and identity checks may call validation APIs, but those calls must not persist the service-price source.

### Final confirmation and save

1. Validate price draft and account data.
2. Create auth user, shop, owner profile, and membership.
3. Create canonical service/detail-guide rows from the owner-confirmed draft.
4. Only now, if source retention is approved, upload source images as private `price_guide_source` media and link them to the shop.
5. If any required save fails, run compensating cleanup and show that signup did not complete.
6. Never append imported values beside seeded placeholders. Replace/reconcile placeholders in place.

This sequence is a server-side signup saga because Auth, Storage, and Postgres cannot be one database transaction. The API must report success only after every required final-save step succeeds.

## 4. Photo, extraction, review, and manual path

```text
photo chosen in browser
  → memory-only image preprocessing
  → non-persistent extraction request
  → editable draft
  → owner confirmation
  → account entry and final review
  → final signup save to canonical source
```

Failure rules:

- Missing vision key: show `사진 자동 인식을 사용할 수 없습니다` and open direct entry.
- Extraction error: preserve the local image selection, show the error, and offer retry/direct entry.
- Low-confidence value: leave blank and label `확인 필요`.
- Never invent a price, duration, breed, species, or weight range.
- Never show a successful registration before final signup save.

## 5. Canonical mapping and duplicate prevention

| Draft value | Final canonical destination | Duplicate rule |
| --- | --- | --- |
| service name | `services.name` / detailed item label | reconcile seeded placeholder; do not append copy |
| base price | `services.price` / detailed cell price | one confirmed source |
| expected duration | `services.duration_minutes` / detailed cell duration | one confirmed source |
| breed/species | `services.price_guide.sections[].species/note` | no onboarding-only field |
| weight band | `services.price_guide.sections[].weightBands` and cells | no customer-menu copy |
| customer-visible menu | read-only projection of canonical service/detail guide | exposure stores order/visibility/source link only |
| source photos | private media assets created only after final signup | no pre-account durable source |

Forbidden:

- signup-only service table;
- local onboarding service copy that later drifts;
- independent customer-facing prices/durations;
- adding imported services alongside the seven seeded example services.

## 6. Post-signup initial setup

Only two steps remain:

1. `영업시간·휴무일`
2. `직원·근무표`

Removed permanently from this guide:

- shop basic information;
- service/detailed pricing;
- booking operation standards;
- customer booking page;
- notification check/test booking.

The actual PC guide is locally updated to guide version 4. Mobile must use the same order and shared backend contract; app-only UI implementation belongs to `D:\petmanager-app`.

## 7. Current implementation state

| Area | State | Note |
| --- | --- | --- |
| Existing owner-authenticated photo import | Implemented | current endpoint persists private source media before extraction |
| Existing AI extraction normalizer | Implemented | vision provider required; uncertain values are flagged |
| Existing service-management review/save | Implemented | owner confirmation precedes canonical save |
| Signup-first pricing screen | Interactive development demo | full local stage movement and final non-persistent request verified; not wired into live signup |
| Non-persistent pre-account extraction endpoint | **Not implemented** | required by v0.3 privacy boundary |
| Final combined signup save/saga | **Not implemented** | account and canonical price save are currently separate |
| Seed-placeholder reconciliation | **Not implemented** | current signup creates example services and guide |
| Post-signup two-step guide | Implemented locally | hours → staff only |
| Local vision execution | **Key-blocked** | local has DeepSeek text key; current parser requires a vision-capable OpenAI key |
| Production | Not touched | explicitly prohibited |

## 8. Review acceptance

- [x] Preview shows the complete signup order on one screen.
- [x] PC and mobile service-price concepts are visible.
- [x] Post-signup guide contains only hours and staff.
- [x] The contract distinguishes temporary pre-account state from final canonical storage.
- [x] Duplicate mappings and current blockers are documented.
- [x] Operations approved the non-persistent extraction and final-save direction for the local demo.
- [x] Local development demo verifies one final request with `persisted:false`.
- [ ] Live signup integration, production-safe extraction, and final-save saga are implemented after release approval.
