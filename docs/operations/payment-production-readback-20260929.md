# PortOne production environment readback

Date: 2026-09-29

Command:

```text
npm run check:payment-env:vercel
```

The command pulls the web project's Vercel production environment into a
task-scoped temporary file, checks only the presence of required payment
configuration, prints no secret values, and deletes the temporary file. It
does not create, update, or remove any Vercel variable.

Read-only result:

- `PORTONE_API_SECRET`: present
- `PORTONE_STORE_ID` / `NEXT_PUBLIC_PORTONE_STORE_ID`: present
- `PORTONE_WEBHOOK_SECRET`: missing
- `BILLING_KEY_ENCRYPTION_SECRET`: missing
- `PORTONE_BILLING_CHANNEL_KEY` / `NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY`: missing
- `PORTONE_PAYMENT_CHANNEL_KEY` / `NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY`: missing

The check exited non-zero by design. Recurring billing and PortOne webhook
operations remain blocked until the missing production values are supplied via
an explicitly approved Vercel environment update and read back successfully.
