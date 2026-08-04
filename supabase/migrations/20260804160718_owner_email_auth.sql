-- Owner authentication now uses the owner's real email address. The legacy
-- identity-verification purpose had the same semantics, so existing short-lived
-- requests can be safely renamed before tightening the constraint.
update owner_identity_verifications
set purpose = 'find-email',
    updated_at = now()
where purpose = 'find-login-id';

alter table owner_identity_verifications
  drop constraint if exists owner_identity_verifications_purpose_check;

alter table owner_identity_verifications
  add constraint owner_identity_verifications_purpose_check
  check (purpose in ('signup', 'reset-password', 'find-email'));
