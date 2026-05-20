# Media Architecture

PetManager media must support owner uploads, grooming photos, customer-facing message images, and "recently sent images" without forcing `/owner` bootstrap to load image data.

Cost, retention, and relay-server boundaries are defined in `docs/media-cost-and-relay-guide.md`.
Retention decision options are defined in `docs/media-retention-policy-options.md`.
Owner-facing notices are defined in `docs/media-owner-notice-copy.md`.

## Storage Rule

- Store binary files in Supabase Storage bucket `petmanager-media`.
- Store database metadata in `media_assets`.
- Store `bucket` and `storage_path`, not signed URLs.
- Signed URLs are short-lived API responses only.
- Keep image metadata out of `notifications.metadata` except for small provider-specific snapshots.
- Do not proxy media files through Vercel routes. Vercel should only verify permissions, create database rows, and issue short-lived upload/download instructions.
- Upload and download media directly between the client and Supabase Storage whenever possible.

## Cost Control Rule

PetManager media is an operational feature with real storage and transfer cost. It must not behave like unlimited raw photo storage.

- Do not store original phone camera files by default.
- Compress images on the client before upload.
- Target customer-send images at 150-400 KB per image when quality is acceptable.
- Target customer-send images at about 250 KB per image when quality is acceptable.
- Target before/after pairs at about 500 KB total for normal grooming updates.
- Keep original retention opt-in only, usually as a paid plan feature or short temporary processing window.
- Use `retention_policy = 'transient'` for customer-send or temporary images that can be deleted after the retention window.
- Use `retention_policy = 'standard'` only for images the owner intentionally keeps in the grooming/customer record.
- Use `retention_policy = 'archive'` only for paid long-term storage features.
- Do not duplicate files for "recent sent images"; store one media asset and reference it from send history.

Recommended default retention:

- customer-send temporary images: 30-90 days
- grooming record selected images: retained while the shop keeps the record
- original uploads: not stored, or deleted after variants are ready
- archived originals: paid option only

## Vercel Boundary

Vercel must not become the file transport layer.

Use Vercel for:

- checking the signed-in owner and shop access
- creating `media_assets` rows
- issuing short-lived Supabase Storage upload URLs or upload instructions
- writing notification/media attachment records
- returning short-lived signed URLs for authorized reads

Do not use Vercel for:

- streaming image uploads through Next.js API routes
- serving stored images as a CDN proxy
- long-running image conversion jobs
- storing binary image data in server memory, logs, or database JSON

If server-side image processing is needed later, use a background worker or storage-triggered processor. Keep the owner web request fast.

## Relay Server Boundary

The existing relay server is for Ssodaa/Alimtalk integration, not for general media storage.

Use the relay server for:

- hiding Ssodaa provider credentials from Vercel and the browser
- normalizing Alimtalk request payloads
- testing provider connectivity and template configuration
- sending approved Alimtalk messages

Do not use the relay server for:

- storing media files
- proxying image downloads
- resizing or compressing owner-uploaded images
- serving recent sent images

When a message includes images later, PetManager should pass media references or provider-ready URLs to the messaging flow. The canonical file still lives in Supabase Storage, and the canonical audit trail still lives in `media_assets`, `notification_media_attachments`, and `media_send_attempts`.

## Core Tables

### `media_assets`

One row per original uploaded image.

Use this table for:

- grooming before/after/result photos
- images attached to Alimtalk/SMS/MMS-style messages
- customer-shared images
- shop profile images
- memo attachments

Important columns:

- `shop_id`: tenant boundary
- `guardian_id`, `pet_id`, `appointment_id`, `grooming_record_id`: optional business context
- `bucket`, `storage_path`: canonical file location
- `media_kind`: business purpose
- `visibility`: private/customer-shared/public
- `status`: upload/processing lifecycle
- `retention_policy`: transient/standard/archive
- `deleted_at`: soft delete marker

### `media_variants`

One row per generated derivative.

Use this table for:

- thumbnails
- preview-sized images
- optimized delivery images
- provider-ready variants

The original file stays in `media_assets`. Variants can be regenerated later.

### `notification_media_attachments`

Joins notifications to media assets.

Use this table for:

- showing which image was attached to a sent message
- displaying images in notification detail
- resolving the image list for one notification
- quick "recent sent images" queries per shop/customer

### `media_send_attempts`

Append-only delivery history for media sends.

Use this table for:

- retry audit
- provider errors
- recent sent image history
- proving what image was sent, when, and to whom

## Recent Sent Images

Do not copy image files for "recent images".

Query recent successful sends from:

```sql
select *
from media_send_attempts
where shop_id = :shop_id
  and status = 'sent'
order by sent_at desc nulls last, created_at desc
limit 30;
```

Then join `media_assets` and `media_variants` for display URLs.

## Upload Path Convention

Use predictable tenant-scoped paths:

```text
shops/{shopId}/media/{yyyy}/{mm}/{mediaAssetId}/original.{ext}
shops/{shopId}/media/{yyyy}/{mm}/{mediaAssetId}/thumbnail.webp
shops/{shopId}/media/{yyyy}/{mm}/{mediaAssetId}/provider-ready.webp
```

Never put phone numbers, customer names, pet names, or raw memo text in storage paths.

## Owner Flow

1. Owner uploads an image.
2. Client compresses the image before upload.
3. Server creates `media_assets` with status `uploading` and returns a Supabase Storage signed upload instruction.
4. Client uploads the compressed canonical image directly to Supabase Storage.
5. Client calls the completion endpoint.
6. Server updates `media_assets.status` to `ready`.
7. Server or a future worker creates thumbnail/optimized variants if needed.
8. If sent through a notification, create `notification_media_attachments`.
9. For each provider attempt, append `media_send_attempts`.

## Variant Flow

Variants are generated outside the normal Vercel request body. The browser can generate variants immediately, or a future worker can generate them later.

1. Start from a ready `media_assets` row.
2. Generate one or more variants: `thumbnail`, `preview`, `optimized`, `provider_ready`.
3. Request a signed upload URL from `POST /api/owner/media/variants/upload-intents`.
4. Upload the variant directly to Supabase Storage.
5. Finalize with `POST /api/owner/media/variants/complete`.

Vercel must not stream or resize the binary image file.

## Notification Attachment Flow

Notification images should be references.

1. Create or reuse ready `media_assets`.
2. Create the `notifications` row for the message.
3. Link media with `notification_media_attachments`.
4. Resolve delivery media through `src/server/media-delivery-service.ts`.
5. Prefer `provider_ready`, then `optimized`, then `preview`, then the original asset.
6. Pass only short-lived signed URLs to the Alimtalk/relay layer.
7. Record each delivery try in `media_send_attempts`.
8. Query recent sent images from `media_send_attempts`.

Do not copy files when attaching images to messages.
Do not store short-lived Supabase signed URLs in long-term database columns.
If a provider returns its own permanent media id or media URL, store that provider result in `notification_media_attachments` and `media_send_attempts`.

## Alimtalk Media Delivery Adapter

The Alimtalk sender accepts an optional `mediaAttachments` array. Text-only Alimtalk sends are unchanged.

The adapter boundary is:

1. `notification_media_attachments` keeps the canonical media references.
2. `resolveNotificationMediaDelivery()` converts those references into provider-ready signed URLs.
3. `toAlimtalkMediaAttachments()` converts the delivery payload into the sender shape.
4. `sendAlimtalkMessage()` forwards `mediaAttachments` to the relay/direct provider payload only when images exist.
5. `markNotificationMediaDeliveryResult()` can update attachment send status and append media send attempts after a provider response.

The Ssodaa relay still needs provider-specific image payload mapping before real image sending is enabled. Until that mapping exists, this layer is a safe structure for preparing and auditing image attachments without changing existing text notifications.

## Owner Media APIs

These APIs are intentionally separate from `/api/bootstrap`.

- `POST /api/owner/media/upload-intents`
  - verifies owner/shop access
  - creates a `media_assets` row
  - returns a Supabase Storage signed upload instruction
  - rejects uncompressed or oversized uploads
- `POST /api/owner/media/complete`
  - verifies owner/shop access
  - marks a media asset as ready after direct Storage upload
- `GET /api/owner/media/signed-url`
  - returns a short-lived read URL for one asset or variant
- `GET /api/owner/media/assets`
  - lists ready media assets by guardian, pet, appointment, grooming record, or media kind with pagination
- `GET /api/owner/media/recent-sent`
  - returns recent sent media references from send history
- `GET /api/owner/media/usage`
  - returns monthly media usage and plan-limit hints
- `POST /api/owner/media/notification-attachments`
  - links ready media assets to an existing notification without copying files
- `GET /api/owner/media/notification-delivery-payload`
  - resolves an existing notification's attached media into short-lived provider-ready URLs
- `POST /api/owner/media/notification-delivery-results`
  - records provider delivery result for attached media and appends send attempts
- `POST /api/owner/media/variants/upload-intents`
  - returns a signed Storage upload instruction for one variant
- `POST /api/owner/media/variants/complete`
  - records a completed variant in `media_variants`
- `GET /api/owner/media/variants/policy`
  - returns target sizes and max sizes for client-side variant generation
- `GET /api/media/cleanup-expired`
  - dry-run only, lists expired transient media
- `POST /api/media/cleanup-expired`
  - dry-run by default, deletes expired transient media only when `dryRun=false`

Client compression helper:

- `src/lib/media/client-image-compression.ts`

The helper should be used before calling `upload-intents`.

Shared media policy constants and owner-facing copy:

- `src/lib/media/media-policy.ts`

Variant upload service:

- `src/server/media-variant-service.ts`

Notification media delivery service:

- `src/server/media-delivery-service.ts`

Paginated media query service:

- `src/server/media-query-service.ts`

## Bootstrap Rule

Do not include media lists in `/api/bootstrap`.

## Usage Limit Flow

Base policy:

- soft limit: 150 MB per shop/month
- hard limit: disabled by default
- enforcement mode: `warn`
- temporary retention: 30 days

Per-shop overrides can be stored in `shop_media_limits`.

- `enforcement_mode = 'off'`: return usage only
- `enforcement_mode = 'warn'`: return warning status but allow upload
- `enforcement_mode = 'block'`: reject upload intent when projected usage exceeds the hard limit

Hard limits should be enabled only after the owner-facing usage UI exists.

Media should be loaded by dedicated APIs:

- schedule/detail media by appointment or grooming record
- customer media by guardian or pet
- recent sent media by shop with pagination

This keeps `/owner` usable for shops with many customers and many years of images.
