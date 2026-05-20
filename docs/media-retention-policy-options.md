# Media Retention Policy Options

PetManager should not keep every uploaded image forever by default. Photo storage must be predictable for the business and easy for owners to understand.

## Terms

- Temporary send image: a photo attached to a message or sent to a customer, not intentionally saved as a grooming record.
- Grooming record image: a photo intentionally saved to the customer's grooming history.
- Original: the uncompressed phone camera source file.
- Optimized image: the compressed canonical file used by the app.
- Archive: paid long-term original or high-resolution storage.

## Option A: Cost-Safe Default

Selected for initial launch.

- Temporary send images: 30 days
- Recent sent image list: 30 days
- Grooming record selected images: keep
- Originals: do not keep
- Archive: paid option later

Pros:

- Lowest cost
- Clear storage control
- Easy to explain as "sent photos are temporary unless saved to record"

Cons:

- Owners may expect old sent photos to remain visible.

## Option B: Balanced Default

Good default if image history is a key selling point.

- Temporary send images: 90 days
- Recent sent image list: 90 days
- Grooming record selected images: keep
- Originals: do not keep
- Archive: paid option later

Pros:

- Better customer support history
- Still avoids unlimited storage
- Good fit for most grooming shops

Cons:

- Higher storage usage than Option A

## Option C: Owner-Friendly History

Use only if plans include enough margin.

- Temporary send images: 180 days
- Recent sent image list: 180 days
- Grooming record selected images: keep
- Originals: do not keep by default
- Archive: paid option

Pros:

- Owners can look back further
- More premium feeling

Cons:

- Storage grows faster
- Needs stricter quota warnings

## Option D: Plan-Based Retention

Best long-term SaaS model.

- Basic: temporary send images 30 days
- Standard: temporary send images 90 days
- Pro: temporary send images 180 days
- Archive add-on: selected originals/high-resolution images retained long-term

Pros:

- Storage cost is controlled by plan/usage tier
- Easy upsell path
- Heavy photo shops pay more fairly

Cons:

- Needs plan/usage UI and support copy

## Selected Decision

Start with Option A:

- default temporary retention: 30 days
- original storage: off
- grooming record selected images: keep
- monthly soft limit: 150 MB per shop
- target before/after pair: about 500 KB

Then expose pricing as Option D later.

This keeps the base plan safe while still allowing owners to save important photos into grooming records intentionally.

## Cleanup Route

The cleanup route is:

```text
GET  /api/media/cleanup-expired
POST /api/media/cleanup-expired
```

Safety rule:

- `GET` is always dry-run.
- `POST` defaults to dry-run.
- `POST /api/media/cleanup-expired?dryRun=false` performs deletion.
- Production requires `MEDIA_CLEANUP_CRON_SECRET`, falling back to `NOTIFICATION_CRON_SECRET` if unset.

Run dry-run first in production before enabling actual cleanup.
