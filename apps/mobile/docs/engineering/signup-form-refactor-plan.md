# Signup form structure review

`src/components/auth/signup-form.tsx` is larger than the UI-file threshold. Split future work by responsibility without changing authentication or signup semantics: entry/consent, account/shop profile, identity sheets, address handoff, and mobile price-guide stage.

The price-guide fixture stage is deliberately extracted into `mobile-ai-price-guide-fixture.tsx`. It owns only mobile UI, ephemeral source-photo handling, keyboard/safe-area handling, and fixture validation. It does not own AI, storage, canonical service writes, or signup atomicity.
